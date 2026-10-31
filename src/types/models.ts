// Domain models shared across the app. Database rows are mapped into these shapes
// in the service layer so UI components never depend on snake_case directly.

export type AreaUnit = 'acres' | 'hectares' | 'guntha';
export type Language = 'en' | 'mr' | 'hi';
export type Season = 'kharif' | 'rabi' | 'zaid' | 'annual';
export type WaterRequirement = 'low' | 'medium' | 'high';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  preferred_language: Language;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  dashboard_layout: string[] | null;
  default_farm_id: string | null;
  currency: string;
  area_unit: AreaUnit;
  notifications_enabled: boolean;
}

export interface Farm {
  id: string;
  user_id: string;
  name: string;
  state: string | null;
  district: string | null;
  taluka: string | null;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  total_area: number | null;
  area_unit: AreaUnit;
  soil_type: string | null;
  soil_ph: number | null;
  irrigation_available: boolean;
  water_source: string | null;
  land_slope: string | null;
  farming_season: Season | null;
  annual_budget: number | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface FarmField {
  id: string;
  farm_id: string;
  name: string;
  area: number | null;
  area_unit: AreaUnit;
  soil_type: string | null;
  soil_ph: number | null;
  irrigation_available: boolean;
  water_source: string | null;
  notes: string | null;
}

export interface SoilRecord {
  id: string;
  farm_id: string;
  field_id: string | null;
  test_date: string | null;
  soil_type: string | null;
  ph: number | null;
  organic_carbon: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  report_url: string | null;
  lab_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface Crop {
  id: string;
  slug: string;
  name: string;
  name_mr: string | null;
  name_hi: string | null;
  scientific_name: string | null;
  category: string;
  min_temp: number | null;
  max_temp: number | null;
  optimal_temp_min: number | null;
  optimal_temp_max: number | null;
  min_rainfall: number | null;
  max_rainfall: number | null;
  optimal_rainfall_min: number | null;
  optimal_rainfall_max: number | null;
  suitable_soil_types: string[] | null;
  min_ph: number | null;
  max_ph: number | null;
  water_requirement: WaterRequirement | null;
  growing_duration_days: number | null;
  seasons: string[] | null;
  seed_rate_per_acre: number | null;
  seed_unit: string | null;
  typical_yield_per_acre: number | null;
  yield_unit: string | null;
  yield_min_per_acre: number | null;
  yield_max_per_acre: number | null;
  cost_min_per_acre: number | null;
  cost_max_per_acre: number | null;
  market_commodities: string[] | null;
  sowing_windows: Record<string, { start: number; end: number }> | null;
  growth_stages: { stage: string; days: number }[] | null;
  fertilizer_requirements: Record<string, string> | null;
  major_pests: string[] | null;
  major_diseases: string[] | null;
  reference_source: string | null;
  reference_notes: string | null;
  is_active: boolean;
}

export interface CropVariety {
  id: string;
  crop_id: string;
  name: string;
  description: string | null;
  duration_days: number | null;
  seed_rate_per_acre: number | null;
  recommended_season: string | null;
  source: string | null;
}

export type CropStage =
  | 'land_preparation'
  | 'sowing'
  | 'germination'
  | 'vegetative'
  | 'flowering'
  | 'fruiting'
  | 'harvesting'
  | 'completed';

export interface FarmCrop {
  id: string;
  farm_id: string;
  field_id: string | null;
  crop_id: string;
  variety: string | null;
  sowing_date: string | null;
  expected_harvest_date: string | null;
  actual_harvest_date: string | null;
  area_planted: number | null;
  area_unit: AreaUnit;
  seed_quantity: number | null;
  seed_cost: number | null;
  current_stage: CropStage;
  harvest_quantity: number | null;
  harvest_unit: string | null;
  status: 'active' | 'completed' | 'failed';
  notes: string | null;
  created_at: string;
  crop?: Crop;
}

export interface CropActivity {
  id: string;
  farm_crop_id: string;
  activity_type: string;
  activity_date: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  photo_urls: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  user_id: string;
  farm_id: string;
  farm_crop_id: string | null;
  category: string;
  amount: number;
  currency: string;
  expense_date: string;
  description: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  vendor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncomeRecord {
  id: string;
  user_id: string;
  farm_id: string;
  farm_crop_id: string | null;
  category: string;
  amount: number;
  currency: string;
  income_date: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  price_per_unit: number | null;
  buyer: string | null;
  market_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketPrice {
  id?: string;
  commodity: string;
  state: string;
  district: string;
  market_name: string;
  variety: string | null;
  min_price: number | null;
  max_price: number | null;
  modal_price: number | null;
  arrival_date: string;
  source: string;
  source_url?: string | null;
  fetched_at: string;
}

export interface MarketQuery {
  commodity?: string;
  state?: string;
  district?: string;
  market?: string;
  limit?: number;
  offset?: number;
}

export interface MarketResponse {
  available: boolean;
  records: MarketPrice[];
  total: number;
  count: number;
  source: string;
  sourceUrl?: string;
  fetchedAt: string;
  observationDate?: string | null;
  cached?: boolean;
  stale?: boolean;
  reason?: string;
  message?: string;
}

export interface WeatherCurrent {
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  isDay: boolean;
}

export interface WeatherHourly {
  time: string;
  temperature: number;
  humidity: number;
  rainProbability: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  soilMoisture: number | null;
  et0: number | null;
}

export interface WeatherDaily {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  rainfall: number;
  rainProbability: number;
  windSpeedMax: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  et0: number;
}

export interface WeatherData {
  available: boolean;
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
  source: string;
  providerUrl: string;
  fetchedAt: string;
  expiresAt: string;
  cached: boolean;
  stale: boolean;
  reason?: string;
}

export interface WeatherAlertItem {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  date: string;
  value: number;
  unit: string;
  threshold: string;
}

export interface ClimateMonth {
  month: string;
  year: number;
  monthNumber: number;
  rainfall: number;
  tempMean: number;
  tempMax: number;
  tempMin: number;
  humidity: number | null;
  solarRadiation: number | null;
}

export interface ClimateData {
  available: boolean;
  months: ClimateMonth[];
  annual: { year: number; rainfall: number; tempMean: number; tempMax: number; tempMin: number }[];
  monthlyNormals: { monthNumber: number; month: string; rainfall: number; tempMean: number; tempMax: number; tempMin: number }[];
  seasons: { season: string; months: string; rainfall: number; tempMean: number; tempMax: number; tempMin: number }[];
  latitude: number;
  longitude: number;
  source: string;
  providerUrl: string;
  fetchedAt: string;
  cached: boolean;
  gridResolution: string;
  reason?: string;
}

export interface RecommendationScore {
  climate: number;
  soil: number;
  water: number;
  season: number;
  market: number;
  economics: number;
  risk: number;
  overall: number;
  confidence: number;
}

export interface Recommendation {
  crop: Crop;
  score: RecommendationScore;
  rank: number;
  reasons: string[];
  cautions: string[];
  economics: {
    available: boolean;
    areaAcres: number;
    costMin: number;
    costMax: number;
    yieldMin: number;
    yieldMax: number;
    priceUsed: number | null;
    priceLow: number | null;
    priceHigh: number | null;
    revenueMin: number | null;
    revenueMax: number | null;
    profitMin: number | null;
    profitMax: number | null;
    priceObservationDate: string | null;
    priceMarketCount: number;
  };
  plantingWindow: string;
  risks: string[];
  market: {
    available: boolean;
    markets: number;
    modalPrice: number | null;
    priceSpreadPct: number | null;
    commodityNames: string[];
    latestDate: string | null;
  };
}

export interface RecommendationResult {
  generatedAt: string;
  farmId: string;
  season: Season;
  inputs: {
    annualRainfallMm: number | null;
    seasonalRainfallMm: number | null;
    meanTempC: number | null;
    soilType: string | null;
    soilPh: number | null;
    irrigationAvailable: boolean;
    waterSource: string | null;
    areaAcres: number;
    budget: number | null;
    forecastRain7dMm: number | null;
    climateSource: string;
    marketSource: string;
    weatherSource: string;
    missing: string[];
  };
  recommendations: Recommendation[];
  allCrops: Recommendation[];
  confidenceNote: string;
}

export interface FarmTask {
  id: string;
  user_id: string;
  farm_id: string;
  farm_crop_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface WeatherAlertRecord {
  id: string;
  user_id: string;
  farm_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  alert_date: string;
  value: number | null;
  unit: string | null;
  source: string;
  forecast_fetched_at: string;
  is_dismissed: boolean;
}

export interface Scheme {
  id: string;
  slug: string;
  name: string;
  name_mr: string | null;
  name_hi: string | null;
  level: 'central' | 'state';
  state: string | null;
  summary: string;
  benefits: string | null;
  eligibility: string[];
  required_documents: string[];
  application_url: string;
  official_source: string;
  last_verified: string;
  is_active: boolean;
}

export interface KnowledgeArticle {
  id: string;
  slug: string;
  category: string;
  title_en: string;
  title_mr: string | null;
  title_hi: string | null;
  summary_en: string | null;
  summary_mr: string | null;
  summary_hi: string | null;
  body_en: string | null;
  body_mr: string | null;
  body_hi: string | null;
  source: string | null;
  last_verified: string | null;
}

export interface SourceRegistryEntry {
  id: string;
  provider: string;
  dataset: string;
  dataset_url: string | null;
  update_frequency: string | null;
  geographic_coverage: string | null;
  data_quality: string | null;
  retrieval_method: string | null;
  last_verified: string | null;
  notes: string | null;
}

export interface FarmDocument {
  id: string;
  user_id: string;
  farm_id: string | null;
  farm_crop_id: string | null;
  document_type: string;
  title: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
}

export interface AiSource {
  provider: string;
  dataset: string;
  retrievedAt: string;
  observationDate?: string | null;
  note?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AiSource[];
  metadata?: {
    engine?: 'llm' | 'rules';
    model?: string;
    missing?: string[];
    disclaimer?: string;
  };
  created_at: string;
}
