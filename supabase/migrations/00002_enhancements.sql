-- ============================================================================
-- FarmDesk Schema Enhancements
-- Adds reference/cache/AI tables, constraints, storage policies and hardening.
-- ============================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------
-- 1. Column additions
-- ---------------------------------------------------------------

alter table crops
  add column if not exists slug text,
  add column if not exists cost_min_per_acre numeric,
  add column if not exists cost_max_per_acre numeric,
  add column if not exists yield_min_per_acre numeric,
  add column if not exists yield_max_per_acre numeric,
  add column if not exists market_commodities text[] default '{}',
  add column if not exists sowing_windows jsonb default '{}'::jsonb,
  add column if not exists reference_source text,
  add column if not exists reference_notes text;

create unique index if not exists idx_crops_slug on crops(slug) where slug is not null;

alter table market_prices
  add column if not exists variety text,
  add column if not exists source_url text,
  add column if not exists import_batch text;

create unique index if not exists uq_market_price_observation
  on market_prices (commodity, coalesce(state,''), coalesce(district,''),
                    coalesce(market_name,''), coalesce(variety,''), arrival_date);

create index if not exists idx_market_prices_commodity_trgm
  on market_prices using gin (commodity gin_trgm_ops);

alter table expenses
  add column if not exists client_mutation_id uuid,
  add column if not exists synced_at timestamptz;

alter table income_records
  add column if not exists client_mutation_id uuid,
  add column if not exists synced_at timestamptz;

alter table crop_activities
  add column if not exists client_mutation_id uuid,
  add column if not exists updated_at timestamptz not null default now();

alter table farm_tasks
  add column if not exists client_mutation_id uuid,
  add column if not exists recurrence text;

create unique index if not exists uq_expenses_client_mutation
  on expenses(client_mutation_id) where client_mutation_id is not null;
create unique index if not exists uq_income_client_mutation
  on income_records(client_mutation_id) where client_mutation_id is not null;
create unique index if not exists uq_activity_client_mutation
  on crop_activities(client_mutation_id) where client_mutation_id is not null;
create unique index if not exists uq_task_client_mutation
  on farm_tasks(client_mutation_id) where client_mutation_id is not null;

-- ---------------------------------------------------------------
-- 2. Validation constraints
-- ---------------------------------------------------------------

alter table farms
  add constraint farms_latitude_check check (latitude is null or latitude between -90 and 90),
  add constraint farms_longitude_check check (longitude is null or longitude between -180 and 180),
  add constraint farms_area_check check (total_area is null or total_area > 0),
  add constraint farms_ph_check check (soil_ph is null or soil_ph between 0 and 14);

alter table farm_fields
  add constraint farm_fields_area_check check (area is null or area > 0);

alter table soil_records
  add constraint soil_ph_check check (ph is null or ph between 0 and 14),
  add constraint soil_oc_check check (organic_carbon is null or organic_carbon >= 0);

alter table expenses
  add constraint expenses_amount_check check (amount > 0);

alter table income_records
  add constraint income_amount_check check (amount > 0);

alter table market_prices
  add constraint market_prices_nonneg check (
    (min_price is null or min_price >= 0) and
    (max_price is null or max_price >= 0) and
    (modal_price is null or modal_price >= 0)
  );

alter table farm_crops
  add constraint farm_crops_area_check check (area_planted is null or area_planted > 0),
  add constraint farm_crops_dates_check check (
    expected_harvest_date is null or sowing_date is null or expected_harvest_date >= sowing_date
  );

-- Validate that financial rows cannot reference a farm the user does not own.
create or replace function assert_farm_owned(p_farm_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from farms where id = p_farm_id and user_id = p_user_id) then
    raise exception 'Farm not found or not owned by user' using errcode = '42501';
  end if;
end;
$$;

create or replace function validate_expense_farm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform assert_farm_owned(new.farm_id, new.user_id);
  if new.expense_date is null then new.expense_date = current_date; end if;
  return new;
end;
$$;

create trigger trg_validate_expense_farm
  before insert or update on expenses
  for each row execute function validate_expense_farm();

create or replace function validate_income_farm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform assert_farm_owned(new.farm_id, new.user_id);
  if new.income_date is null then new.income_date = current_date; end if;
  return new;
end;
$$;

create trigger trg_validate_income_farm
  before insert or update on income_records
  for each row execute function validate_income_farm();

-- ---------------------------------------------------------------
-- 3. New tables
-- ---------------------------------------------------------------

-- Reference: crop varieties
create table if not exists crop_varieties (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references crops(id) on delete cascade,
  name text not null,
  description text,
  duration_days integer,
  seed_rate_per_acre numeric,
  recommended_season text,
  source text,
  created_at timestamptz not null default now(),
  unique (crop_id, name)
);
create index if not exists idx_crop_varieties_crop on crop_varieties(crop_id);

-- Weather: normalized daily forecast snapshots (shared, provider data)
create table if not exists weather_records (
  id uuid primary key default gen_random_uuid(),
  latitude numeric not null,
  longitude numeric not null,
  record_date date not null,
  temp_max numeric,
  temp_min numeric,
  rainfall_mm numeric,
  rain_probability numeric,
  humidity numeric,
  wind_speed numeric,
  weather_code integer,
  et0_mm numeric,
  source text not null default 'open-meteo',
  observation_time timestamptz,
  fetched_at timestamptz not null default now(),
  unique (latitude, longitude, record_date, source)
);
create index if not exists idx_weather_records_loc_date on weather_records(latitude, longitude, record_date);

-- Weather alerts generated from actual forecasts (per user/farm)
create table if not exists weather_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  farm_id uuid not null references farms(id) on delete cascade,
  alert_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  title text not null,
  message text not null,
  alert_date date not null,
  value numeric,
  unit text,
  source text not null default 'open-meteo',
  forecast_fetched_at timestamptz not null,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, farm_id, alert_type, alert_date, forecast_fetched_at)
);
create index if not exists idx_weather_alerts_user on weather_alerts(user_id, is_dismissed);

-- Climate cache (NASA POWER)
create table if not exists climate_cache (
  id uuid primary key default gen_random_uuid(),
  latitude numeric not null,
  longitude numeric not null,
  start_year integer not null,
  end_year integer not null,
  data jsonb not null,
  source text not null default 'nasa-power',
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (latitude, longitude, start_year, end_year, source)
);

-- Documents
create table if not exists farm_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  farm_id uuid references farms(id) on delete cascade,
  farm_crop_id uuid references farm_crops(id) on delete set null,
  document_type text not null default 'other',
  title text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_farm_documents_user on farm_documents(user_id);
create index if not exists idx_farm_documents_farm on farm_documents(farm_id);

-- Market CSV imports audit
create table if not exists market_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  file_name text not null,
  row_count integer not null default 0,
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  source text not null default 'agmarknet-csv',
  status text not null default 'completed',
  error_message text,
  created_at timestamptz not null default now()
);

-- AI conversations
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  farm_id uuid references farms(id) on delete set null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ai_conversations_user on ai_conversations(user_id, updated_at desc);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  sources jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_messages_conversation on ai_messages(conversation_id, created_at);

create table if not exists ai_rate_limits (
  user_id uuid primary key references profiles(id) on delete cascade,
  window_start timestamptz not null default now(),
  request_count integer not null default 0
);

-- Source registry (shared reference)
create table if not exists source_registry (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  dataset text not null,
  dataset_url text,
  update_frequency text,
  geographic_coverage text,
  data_quality text,
  retrieval_method text,
  last_verified date,
  notes text,
  created_at timestamptz not null default now(),
  unique (provider, dataset)
);

-- Government schemes (shared reference)
create table if not exists schemes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_mr text,
  name_hi text,
  level text not null check (level in ('central','state')),
  state text,
  summary text not null,
  benefits text,
  eligibility text[] not null default '{}',
  required_documents text[] not null default '{}',
  application_url text not null,
  official_source text not null,
  last_verified date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_schemes_level on schemes(level, is_active);

-- Knowledge centre (shared reference)
create table if not exists knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category text not null,
  title_en text not null,
  title_mr text,
  title_hi text,
  summary_en text,
  summary_mr text,
  summary_hi text,
  body_en text,
  body_mr text,
  body_hi text,
  source text,
  last_verified date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_knowledge_category on knowledge_articles(category, is_active);

-- ---------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------

drop trigger if exists set_ai_conversations_updated_at on ai_conversations;
create trigger set_ai_conversations_updated_at before update on ai_conversations
  for each row execute function update_updated_at_column();

drop trigger if exists set_crop_activities_updated_at on crop_activities;
create trigger set_crop_activities_updated_at before update on crop_activities
  for each row execute function update_updated_at_column();

-- Richer signup bootstrap: profile + preferences
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 5. RLS for new tables
-- ---------------------------------------------------------------

alter table crop_varieties enable row level security;
alter table weather_records enable row level security;
alter table weather_alerts enable row level security;
alter table climate_cache enable row level security;
alter table farm_documents enable row level security;
alter table market_imports enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_rate_limits enable row level security;
alter table source_registry enable row level security;
alter table schemes enable row level security;
alter table knowledge_articles enable row level security;

create policy "Authenticated can read crop varieties" on crop_varieties
  for select using (auth.role() = 'authenticated');
create policy "Authenticated can read weather records" on weather_records
  for select using (auth.role() = 'authenticated');
create policy "Authenticated can read climate cache" on climate_cache
  for select using (auth.role() = 'authenticated');
create policy "Authenticated can read source registry" on source_registry
  for select using (auth.role() = 'authenticated');
create policy "Authenticated can read schemes" on schemes
  for select using (auth.role() = 'authenticated');
create policy "Authenticated can read knowledge" on knowledge_articles
  for select using (auth.role() = 'authenticated');

create policy "Users read own weather alerts" on weather_alerts
  for select using (auth.uid() = user_id);
create policy "Users update own weather alerts" on weather_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own weather alerts" on weather_alerts
  for delete using (auth.uid() = user_id);

create policy "Users read own documents" on farm_documents
  for select using (auth.uid() = user_id);
create policy "Users insert own documents" on farm_documents
  for insert with check (auth.uid() = user_id);
create policy "Users update own documents" on farm_documents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own documents" on farm_documents
  for delete using (auth.uid() = user_id);

create policy "Users read own imports" on market_imports
  for select using (auth.uid() = user_id);
create policy "Users insert own imports" on market_imports
  for insert with check (auth.uid() = user_id);

create policy "Users read own conversations" on ai_conversations
  for select using (auth.uid() = user_id);
create policy "Users insert own conversations" on ai_conversations
  for insert with check (auth.uid() = user_id);
create policy "Users update own conversations" on ai_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own conversations" on ai_conversations
  for delete using (auth.uid() = user_id);

create policy "Users read own messages" on ai_messages
  for select using (exists (
    select 1 from ai_conversations c
    where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
  ));
create policy "Users insert own messages" on ai_messages
  for insert with check (exists (
    select 1 from ai_conversations c
    where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
  ));

-- Rate limits: read-only to the user; edge function (service role) writes.
create policy "Users read own rate limit" on ai_rate_limits
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 6. Storage
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 10485760,
   array['image/jpeg','image/png','image/webp','application/pdf']),
  ('field-photos', 'field-photos', false, 10485760,
   array['image/jpeg','image/png','image/webp']),
  ('soil-reports', 'soil-reports', false, 10485760,
   array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Objects live under <bucket>/<auth.uid()>/... ; users can only touch their folder.
create policy "Users read own storage" on storage.objects
  for select using (
    bucket_id in ('receipts','field-photos','soil-reports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users upload own storage" on storage.objects
  for insert with check (
    bucket_id in ('receipts','field-photos','soil-reports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users update own storage" on storage.objects
  for update using (
    bucket_id in ('receipts','field-photos','soil-reports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users delete own storage" on storage.objects
  for delete using (
    bucket_id in ('receipts','field-photos','soil-reports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------
-- 7. Hardening existing policies
-- ---------------------------------------------------------------

-- Financial rows must reference farms owned by the user (defence in depth on top of triggers)
drop policy if exists "Users can create own expenses" on expenses;
create policy "Users can create own expenses" on expenses
  for insert with check (
    auth.uid() = user_id and exists (select 1 from farms f where f.id = farm_id and f.user_id = auth.uid())
  );
drop policy if exists "Users can update own expenses" on expenses;
create policy "Users can update own expenses" on expenses
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from farms f where f.id = farm_id and f.user_id = auth.uid()));

drop policy if exists "Users can create own income records" on income_records;
create policy "Users can create own income records" on income_records
  for insert with check (
    auth.uid() = user_id and exists (select 1 from farms f where f.id = farm_id and f.user_id = auth.uid())
  );
drop policy if exists "Users can update own income records" on income_records;
create policy "Users can update own income records" on income_records
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from farms f where f.id = farm_id and f.user_id = auth.uid()));

-- Farm crops: a field must belong to the same farm.
drop policy if exists "Users can create farm crops" on farm_crops;
create policy "Users can create farm crops" on farm_crops
  for insert with check (
    exists (select 1 from farms f where f.id = farm_id and f.user_id = auth.uid())
    and (field_id is null or exists (select 1 from farm_fields ff where ff.id = field_id and ff.farm_id = farm_crops.farm_id))
  );
drop policy if exists "Users can update own farm crops" on farm_crops;
create policy "Users can update own farm crops" on farm_crops
  for update using (
    exists (select 1 from farms f where f.id = farm_id and f.user_id = auth.uid())
  ) with check (
    exists (select 1 from farms f where f.id = farm_id and f.user_id = auth.uid())
    and (field_id is null or exists (select 1 from farm_fields ff where ff.id = field_id and ff.farm_id = farm_crops.farm_id))
  );

-- ---------------------------------------------------------------
-- 8. Helper RPCs (SECURITY INVOKER so RLS applies)
-- ---------------------------------------------------------------

create or replace function farm_financial_summary(p_farm_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'total_expenses', coalesce((select sum(amount) from expenses where farm_id = p_farm_id), 0),
    'total_income', coalesce((select sum(amount) from income_records where farm_id = p_farm_id), 0),
    'expense_count', (select count(*) from expenses where farm_id = p_farm_id),
    'income_count', (select count(*) from income_records where farm_id = p_farm_id)
  );
$$;

grant execute on function farm_financial_summary(uuid) to authenticated;

-- Prevent negative AI count
alter table ai_rate_limits add constraint ai_request_count_check check (request_count >= 0);
