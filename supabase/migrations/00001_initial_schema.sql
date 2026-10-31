-- ============================================================================
-- FarmDesk Initial Schema Migration
-- Agricultural Intelligence Platform - Database Schema
-- ============================================================================

-- =========================
-- 1. Custom Enum Types
-- =========================

-- Crop growth stages for farm_crops
CREATE TYPE crop_stage AS ENUM (
  'land_preparation',
  'sowing',
  'germination',
  'vegetative',
  'flowering',
  'fruiting',
  'harvesting',
  'completed'
);

-- Farm crop lifecycle status
CREATE TYPE crop_status AS ENUM (
  'active',
  'completed',
  'failed'
);

-- Types of farming activities
CREATE TYPE activity_type AS ENUM (
  'sowing',
  'irrigation',
  'fertilizer',
  'pesticide',
  'weeding',
  'pruning',
  'harvesting',
  'observation',
  'other'
);

-- Expense categories
CREATE TYPE expense_category AS ENUM (
  'seeds',
  'fertilizers',
  'pesticides',
  'labour',
  'machinery',
  'irrigation',
  'electricity',
  'transportation',
  'fuel',
  'land_preparation',
  'equipment',
  'other'
);

-- Income categories
CREATE TYPE income_category AS ENUM (
  'crop_sale',
  'product_sale',
  'subsidy',
  'insurance',
  'other'
);

-- Crop categories in the master crop database
CREATE TYPE crop_category AS ENUM (
  'cereals',
  'pulses',
  'oilseeds',
  'vegetables',
  'fruits',
  'spices',
  'cash_crops',
  'fibers'
);

-- Crop water requirement levels
CREATE TYPE water_requirement_level AS ENUM (
  'low',
  'medium',
  'high'
);

-- Task priority
CREATE TYPE task_priority AS ENUM (
  'low',
  'medium',
  'high'
);

-- Task status
CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);

-- Notification types
CREATE TYPE notification_type AS ENUM (
  'weather_alert',
  'task_reminder',
  'market_alert',
  'system'
);

-- Weather data types
CREATE TYPE weather_data_type AS ENUM (
  'current',
  'forecast',
  'historical'
);


-- =========================
-- 2. Utility Functions
-- =========================

-- Auto-update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =========================
-- 3. Tables
-- =========================

-- -----------------------------------------------
-- 3.1 profiles – extends Supabase auth.users
-- -----------------------------------------------
CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  phone         text,
  email         text,
  avatar_url    text,
  preferred_language  text NOT NULL DEFAULT 'en',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users';

-- -----------------------------------------------
-- 3.2 farms – farm information
-- -----------------------------------------------
CREATE TABLE farms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,
  state           text,
  district        text,
  taluka          text,
  village         text,
  latitude        numeric,
  longitude       numeric,
  total_area      numeric,
  area_unit       text NOT NULL DEFAULT 'acres',
  soil_type       text,
  soil_ph         numeric,
  irrigation_available boolean NOT NULL DEFAULT false,
  water_source    text,
  land_slope      text,
  farming_season  text,
  annual_budget   numeric,
  is_primary      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE farms IS 'Farm locations and characteristics owned by users';

-- -----------------------------------------------
-- 3.3 farm_fields – individual fields within a farm
-- -----------------------------------------------
CREATE TABLE farm_fields (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id         uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name            text NOT NULL,
  area            numeric,
  area_unit       text NOT NULL DEFAULT 'acres',
  soil_type       text,
  soil_ph         numeric,
  irrigation_available boolean NOT NULL DEFAULT false,
  water_source    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE farm_fields IS 'Individual fields/plots within a farm';

-- -----------------------------------------------
-- 3.4 soil_records – soil test data
-- -----------------------------------------------
CREATE TABLE soil_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id         uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id        uuid REFERENCES farm_fields(id) ON DELETE SET NULL,
  test_date       date,
  soil_type       text,
  ph              numeric,
  organic_carbon  numeric,
  nitrogen        numeric,
  phosphorus      numeric,
  potassium       numeric,
  report_url      text,
  lab_name        text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE soil_records IS 'Soil test results linked to farms/fields';

-- -----------------------------------------------
-- 3.5 crops – master crop database (shared)
-- -----------------------------------------------
CREATE TABLE crops (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  name_mr               text,           -- Marathi name
  name_hi               text,           -- Hindi name
  scientific_name       text,
  category              crop_category NOT NULL,
  min_temp              numeric,
  max_temp              numeric,
  optimal_temp_min      numeric,
  optimal_temp_max      numeric,
  min_rainfall          numeric,
  max_rainfall          numeric,
  optimal_rainfall_min  numeric,
  optimal_rainfall_max  numeric,
  suitable_soil_types   text[],
  min_ph                numeric,
  max_ph                numeric,
  water_requirement     water_requirement_level,
  growing_duration_days integer,
  seasons               text[],         -- e.g. {'kharif','rabi','zaid'}
  seed_rate_per_acre    numeric,
  seed_unit             text,
  typical_yield_per_acre numeric,
  yield_unit            text,
  growth_stages         jsonb,          -- [{stage, duration_days}, ...]
  fertilizer_requirements jsonb,
  major_pests           text[],
  major_diseases        text[],
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE crops IS 'Master crop reference database (shared across all users)';

-- -----------------------------------------------
-- 3.6 farm_crops – crops planted by users
-- -----------------------------------------------
CREATE TABLE farm_crops (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id              uuid REFERENCES farm_fields(id) ON DELETE SET NULL,
  crop_id               uuid NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  variety               text,
  sowing_date           date,
  expected_harvest_date date,
  actual_harvest_date   date,
  area_planted          numeric,
  area_unit             text NOT NULL DEFAULT 'acres',
  seed_quantity         numeric,
  seed_cost             numeric,
  current_stage         crop_stage NOT NULL DEFAULT 'land_preparation',
  harvest_quantity      numeric,
  harvest_unit          text,
  status                crop_status NOT NULL DEFAULT 'active',
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE farm_crops IS 'Crops planted by users on their farms/fields';

-- -----------------------------------------------
-- 3.7 crop_activities – farming activity log
-- -----------------------------------------------
CREATE TABLE crop_activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_crop_id    uuid NOT NULL REFERENCES farm_crops(id) ON DELETE CASCADE,
  activity_type   activity_type NOT NULL,
  activity_date   date NOT NULL,
  description     text,
  quantity        numeric,
  unit            text,
  cost            numeric,
  photo_urls      text[],
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE crop_activities IS 'Log of farming activities for each planted crop';

-- -----------------------------------------------
-- 3.8 expenses – expense tracking
-- -----------------------------------------------
CREATE TABLE expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  farm_id         uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farm_crop_id    uuid REFERENCES farm_crops(id) ON DELETE SET NULL,
  category        expense_category NOT NULL,
  amount          numeric NOT NULL,
  currency        text NOT NULL DEFAULT 'INR',
  expense_date    date,
  description     text,
  payment_method  text,
  receipt_url     text,
  vendor          text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE expenses IS 'User expense records for farm operations';

-- -----------------------------------------------
-- 3.9 income_records – income tracking
-- -----------------------------------------------
CREATE TABLE income_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  farm_id         uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farm_crop_id    uuid REFERENCES farm_crops(id) ON DELETE SET NULL,
  category        income_category NOT NULL,
  amount          numeric NOT NULL,
  currency        text NOT NULL DEFAULT 'INR',
  income_date     date,
  description     text,
  quantity        numeric,
  unit            text,
  price_per_unit  numeric,
  buyer           text,
  market_name     text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE income_records IS 'User income records from crop sales, subsidies, etc.';

-- -----------------------------------------------
-- 3.10 market_prices – cached market price data
-- -----------------------------------------------
CREATE TABLE market_prices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity       text NOT NULL,
  state           text,
  district        text,
  market_name     text,
  min_price       numeric,
  max_price       numeric,
  modal_price     numeric,
  arrival_date    date,
  source          text,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE market_prices IS 'Cached commodity market prices (shared data)';

-- -----------------------------------------------
-- 3.11 weather_cache – cached weather data
-- -----------------------------------------------
CREATE TABLE weather_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude        numeric NOT NULL,
  longitude       numeric NOT NULL,
  data            jsonb NOT NULL,
  data_type       weather_data_type NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE weather_cache IS 'Cached weather data for locations (shared data)';

-- -----------------------------------------------
-- 3.12 crop_recommendations – saved AI recommendations
-- -----------------------------------------------
CREATE TABLE crop_recommendations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  farm_id           uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  recommendations   jsonb NOT NULL,
  input_parameters  jsonb NOT NULL,
  generated_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE crop_recommendations IS 'Saved AI-generated crop recommendations for users';

-- -----------------------------------------------
-- 3.13 farm_tasks – user tasks / reminders
-- -----------------------------------------------
CREATE TABLE farm_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  farm_id         uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farm_crop_id    uuid REFERENCES farm_crops(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  due_date        date,
  priority        task_priority NOT NULL DEFAULT 'medium',
  status          task_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE farm_tasks IS 'User farming tasks and reminders';

-- -----------------------------------------------
-- 3.14 notifications – user notifications
-- -----------------------------------------------
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  title           text NOT NULL,
  message         text,
  data            jsonb,
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE notifications IS 'In-app notifications for users';

-- -----------------------------------------------
-- 3.15 user_preferences – app preferences
-- -----------------------------------------------
CREATE TABLE user_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  dashboard_layout      jsonb,
  default_farm_id       uuid REFERENCES farms(id) ON DELETE SET NULL,
  currency              text NOT NULL DEFAULT 'INR',
  area_unit             text NOT NULL DEFAULT 'acres',
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_preferences IS 'Per-user application preferences and settings';


-- =========================
-- 4. Indexes
-- =========================

-- profiles
CREATE INDEX idx_profiles_email ON profiles(email);

-- farms
CREATE INDEX idx_farms_user_id ON farms(user_id);
CREATE INDEX idx_farms_state_district ON farms(state, district);

-- farm_fields
CREATE INDEX idx_farm_fields_farm_id ON farm_fields(farm_id);

-- soil_records
CREATE INDEX idx_soil_records_farm_id ON soil_records(farm_id);
CREATE INDEX idx_soil_records_field_id ON soil_records(field_id);
CREATE INDEX idx_soil_records_test_date ON soil_records(test_date);

-- crops (master)
CREATE INDEX idx_crops_category ON crops(category);
CREATE INDEX idx_crops_name ON crops(name);
CREATE INDEX idx_crops_is_active ON crops(is_active);

-- farm_crops
CREATE INDEX idx_farm_crops_farm_id ON farm_crops(farm_id);
CREATE INDEX idx_farm_crops_field_id ON farm_crops(field_id);
CREATE INDEX idx_farm_crops_crop_id ON farm_crops(crop_id);
CREATE INDEX idx_farm_crops_status ON farm_crops(status);
CREATE INDEX idx_farm_crops_sowing_date ON farm_crops(sowing_date);

-- crop_activities
CREATE INDEX idx_crop_activities_farm_crop_id ON crop_activities(farm_crop_id);
CREATE INDEX idx_crop_activities_activity_date ON crop_activities(activity_date);
CREATE INDEX idx_crop_activities_type ON crop_activities(activity_type);

-- expenses
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_farm_id ON expenses(farm_id);
CREATE INDEX idx_expenses_farm_crop_id ON expenses(farm_crop_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- income_records
CREATE INDEX idx_income_records_user_id ON income_records(user_id);
CREATE INDEX idx_income_records_farm_id ON income_records(farm_id);
CREATE INDEX idx_income_records_farm_crop_id ON income_records(farm_crop_id);
CREATE INDEX idx_income_records_income_date ON income_records(income_date);

-- market_prices
CREATE INDEX idx_market_prices_commodity ON market_prices(commodity);
CREATE INDEX idx_market_prices_state_district ON market_prices(state, district);
CREATE INDEX idx_market_prices_arrival_date ON market_prices(arrival_date);
CREATE INDEX idx_market_prices_market_name ON market_prices(market_name);

-- weather_cache
CREATE INDEX idx_weather_cache_location ON weather_cache(latitude, longitude);
CREATE INDEX idx_weather_cache_data_type ON weather_cache(data_type);
CREATE INDEX idx_weather_cache_expires_at ON weather_cache(expires_at);

-- crop_recommendations
CREATE INDEX idx_crop_recommendations_user_id ON crop_recommendations(user_id);
CREATE INDEX idx_crop_recommendations_farm_id ON crop_recommendations(farm_id);

-- farm_tasks
CREATE INDEX idx_farm_tasks_user_id ON farm_tasks(user_id);
CREATE INDEX idx_farm_tasks_farm_id ON farm_tasks(farm_id);
CREATE INDEX idx_farm_tasks_due_date ON farm_tasks(due_date);
CREATE INDEX idx_farm_tasks_status ON farm_tasks(status);

-- notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- user_preferences
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);


-- =========================
-- 5. updated_at Triggers
-- =========================

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_farms_updated_at
  BEFORE UPDATE ON farms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_farm_fields_updated_at
  BEFORE UPDATE ON farm_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_crops_updated_at
  BEFORE UPDATE ON crops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_farm_crops_updated_at
  BEFORE UPDATE ON farm_crops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_income_records_updated_at
  BEFORE UPDATE ON income_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_farm_tasks_updated_at
  BEFORE UPDATE ON farm_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =========================
-- 6. Auto-create Profile on Signup
-- =========================

-- Trigger function: inserts a profile row when a new auth.users row is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire after every new auth user insertion
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- =========================
-- 7. Row Level Security
-- =========================

-- Enable RLS on every table
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_fields         ENABLE ROW LEVEL SECURITY;
ALTER TABLE soil_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops               ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_crops          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_activities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_cache       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences    ENABLE ROW LEVEL SECURITY;

-- ----- profiles -----
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert handled by the signup trigger (SECURITY DEFINER), but allow explicit insert too
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ----- farms -----
CREATE POLICY "Users can view own farms"
  ON farms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own farms"
  ON farms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own farms"
  ON farms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own farms"
  ON farms FOR DELETE
  USING (auth.uid() = user_id);

-- ----- farm_fields -----
-- Access gated through farm ownership
CREATE POLICY "Users can view own farm fields"
  ON farm_fields FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_fields.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can create farm fields"
  ON farm_fields FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_fields.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own farm fields"
  ON farm_fields FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_fields.farm_id AND farms.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_fields.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own farm fields"
  ON farm_fields FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_fields.farm_id AND farms.user_id = auth.uid()
  ));

-- ----- soil_records -----
CREATE POLICY "Users can view own soil records"
  ON soil_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = soil_records.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can create soil records"
  ON soil_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = soil_records.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own soil records"
  ON soil_records FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = soil_records.farm_id AND farms.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = soil_records.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own soil records"
  ON soil_records FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = soil_records.farm_id AND farms.user_id = auth.uid()
  ));

-- ----- crops (master data – read-only for authenticated users) -----
CREATE POLICY "Authenticated users can view crops"
  ON crops FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies for regular users; managed via service role or admin

-- ----- farm_crops -----
CREATE POLICY "Users can view own farm crops"
  ON farm_crops FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can create farm crops"
  ON farm_crops FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own farm crops"
  ON farm_crops FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own farm crops"
  ON farm_crops FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid()
  ));

-- ----- crop_activities -----
-- Access gated through farm_crops → farms ownership chain
CREATE POLICY "Users can view own crop activities"
  ON crop_activities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM farm_crops
    JOIN farms ON farms.id = farm_crops.farm_id
    WHERE farm_crops.id = crop_activities.farm_crop_id
      AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can create crop activities"
  ON crop_activities FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM farm_crops
    JOIN farms ON farms.id = farm_crops.farm_id
    WHERE farm_crops.id = crop_activities.farm_crop_id
      AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own crop activities"
  ON crop_activities FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM farm_crops
    JOIN farms ON farms.id = farm_crops.farm_id
    WHERE farm_crops.id = crop_activities.farm_crop_id
      AND farms.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM farm_crops
    JOIN farms ON farms.id = farm_crops.farm_id
    WHERE farm_crops.id = crop_activities.farm_crop_id
      AND farms.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own crop activities"
  ON crop_activities FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM farm_crops
    JOIN farms ON farms.id = farm_crops.farm_id
    WHERE farm_crops.id = crop_activities.farm_crop_id
      AND farms.user_id = auth.uid()
  ));

-- ----- expenses -----
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);

-- ----- income_records -----
CREATE POLICY "Users can view own income records"
  ON income_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own income records"
  ON income_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income records"
  ON income_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own income records"
  ON income_records FOR DELETE
  USING (auth.uid() = user_id);

-- ----- market_prices (shared read-only data) -----
CREATE POLICY "Authenticated users can view market prices"
  ON market_prices FOR SELECT
  USING (auth.role() = 'authenticated');

-- ----- weather_cache (shared read-only data) -----
CREATE POLICY "Authenticated users can view weather cache"
  ON weather_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- ----- crop_recommendations -----
CREATE POLICY "Users can view own recommendations"
  ON crop_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recommendations"
  ON crop_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recommendations"
  ON crop_recommendations FOR DELETE
  USING (auth.uid() = user_id);

-- ----- farm_tasks -----
CREATE POLICY "Users can view own tasks"
  ON farm_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON farm_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON farm_tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON farm_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ----- notifications -----
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ----- user_preferences -----
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
