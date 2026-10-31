-- ============================================================================
-- Post-launch hardening (applied after the initial schema)
-- ============================================================================

-- Deterministic key for idempotent market snapshot writes from Edge Functions,
-- CSV imports and the client. A plain column + trigger is used instead of a
-- generated column because date -> text casts are not immutable in PostgreSQL.
alter table market_prices add column if not exists obs_key text;

create or replace function public.set_market_obs_key()
returns trigger language plpgsql as $$
begin
  new.obs_key :=
    lower(trim(coalesce(new.commodity, ''))) || '|' ||
    lower(trim(coalesce(new.state, ''))) || '|' ||
    lower(trim(coalesce(new.district, ''))) || '|' ||
    lower(trim(coalesce(new.market_name, ''))) || '|' ||
    lower(trim(coalesce(new.variety, ''))) || '|' ||
    coalesce(to_char(new.arrival_date, 'YYYY-MM-DD'), '');
  return new;
end;
$$;

update market_prices set obs_key = obs_key; -- force trigger below for legacy rows

drop trigger if exists trg_set_market_obs_key on market_prices;
create trigger trg_set_market_obs_key
  before insert or update of commodity, state, district, market_name, variety, arrival_date
  on market_prices
  for each row execute function public.set_market_obs_key();

-- Backfill any rows that existed before the trigger.
update market_prices set
  obs_key =
    lower(trim(coalesce(commodity, ''))) || '|' ||
    lower(trim(coalesce(state, ''))) || '|' ||
    lower(trim(coalesce(district, ''))) || '|' ||
    lower(trim(coalesce(market_name, ''))) || '|' ||
    lower(trim(coalesce(variety, ''))) || '|' ||
    coalesce(to_char(arrival_date, 'YYYY-MM-DD'), '');

drop index if exists uq_market_price_observation;
create unique index if not exists uq_market_prices_obs_key on market_prices(obs_key);

-- Weather alerts are written by the signed-in user from real forecast results.
drop policy if exists "Users insert own weather alerts" on weather_alerts;
create policy "Users insert own weather alerts" on weather_alerts
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from farms f where f.id = farm_id and f.user_id = auth.uid())
  );

-- Users may create their own notifications (e.g. task reminders) but not impersonate others.
drop policy if exists "Users insert own notifications" on notifications;
create policy "Users insert own notifications" on notifications
  for insert with check (auth.uid() = user_id);

-- Shared cache writes are service-role only. Explicitly deny client writes by not
-- creating INSERT/UPDATE policies on weather_cache, climate_cache and weather_records.

-- Faster financial aggregation.
create index if not exists idx_expenses_user_date on expenses(user_id, expense_date desc);
create index if not exists idx_income_user_date on income_records(user_id, income_date desc);
create index if not exists idx_expenses_farm_date on expenses(farm_id, expense_date desc);
create index if not exists idx_income_farm_date on income_records(farm_id, income_date desc);
create index if not exists idx_weather_alerts_farm_active on weather_alerts(farm_id, is_dismissed, alert_date);

-- Server-side import audit is written by the Edge Function; keep counts consistent.
alter table market_imports
  add constraint market_import_counts_check check (
    row_count >= 0 and inserted_count >= 0 and skipped_count >= 0
  );
