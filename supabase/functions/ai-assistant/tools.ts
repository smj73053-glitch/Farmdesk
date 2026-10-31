import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

export interface ContextSource {
  provider: string;
  dataset: string;
  retrievedAt: string;
  observationDate?: string | null;
  note?: string;
}

export interface FarmContext {
  generatedAt: string;
  user: { id: string };
  farms: Array<Record<string, unknown>>;
  farm: Record<string, unknown> | null;
  activeCrops: Array<Record<string, unknown>>;
  cropReference: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  income: Array<Record<string, unknown>>;
  soilRecords: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  marketRows: Array<Record<string, unknown>>;
  weather: Record<string, unknown> | null;
  climate: Record<string, unknown> | null;
  sources: ContextSource[];
  missing: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function getWeather(lat: number, lon: number): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    timezone: 'Asia/Kolkata',
    forecast_days: '7',
  });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.daily ?? {};
    const days = ((d.time ?? []) as string[]).map((date, i) => ({
      date,
      tempMax: d.temperature_2m_max?.[i],
      tempMin: d.temperature_2m_min?.[i],
      rainfall: d.precipitation_sum?.[i] ?? 0,
      rainProbability: d.precipitation_probability_max?.[i] ?? 0,
      windMax: d.wind_speed_10m_max?.[i],
      weatherCode: d.weather_code?.[i],
    }));
    return {
      current: json.current ?? null,
      days,
      rain7d: Math.round(days.reduce((s, day) => s + Number(day.rainfall ?? 0), 0) * 10) / 10,
      source: 'Open-Meteo',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function getClimate(admin: SupabaseClient, lat: number, lon: number): Promise<Record<string, unknown> | null> {
  const end = new Date().getFullYear() - 1;
  const start = end - 4;
  const { data: cached } = await admin
    .from('climate_cache')
    .select('data')
    .eq('latitude', lat)
    .eq('longitude', lon)
    .eq('start_year', start)
    .eq('end_year', end)
    .eq('source', 'nasa-power')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (cached?.data) return cached.data as Record<string, unknown>;

  const url = new URL('https://power.larc.nasa.gov/api/temporal/monthly/point');
  url.searchParams.set('parameters', 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR');
  url.searchParams.set('community', 'AG');
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('start', String(start));
  url.searchParams.set('end', String(end));
  url.searchParams.set('format', 'JSON');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const p = json.properties?.parameter ?? {};
    const rain: Record<string, number> = p.PRECTOTCORR ?? {};
    const temp: Record<string, number> = p.T2M ?? {};
    const byYear = new Map<number, number>();
    const temps: number[] = [];
    for (const [key, value] of Object.entries(rain)) {
      const month = Number(key.slice(4));
      if (month >= 1 && month <= 12 && value > -900) {
        const year = Number(key.slice(0, 4));
        const monthlyTotal = value * new Date(year, month, 0).getDate();
        byYear.set(year, (byYear.get(year) ?? 0) + monthlyTotal);
      }
    }
    for (const [key, value] of Object.entries(temp)) {
      const month = Number(key.slice(4));
      if (month >= 1 && month <= 12 && value > -900) temps.push(value);
    }
    const annuals = [...byYear.values()];
    const result = {
      available: true,
      annualRainfallMm: annuals.length ? Math.round(annuals.reduce((s, v) => s + v, 0) / annuals.length) : null,
      meanTempC: temps.length ? Math.round((temps.reduce((s, v) => s + v, 0) / temps.length) * 10) / 10 : null,
      startYear: start,
      endYear: end,
      source: 'NASA POWER (MERRA-2)',
      fetchedAt: new Date().toISOString(),
    };
    await admin.from('climate_cache').upsert({
      latitude: lat,
      longitude: lon,
      start_year: start,
      end_year: end,
      source: 'nasa-power',
      data: result,
      fetched_at: result.fetchedAt,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }, { onConflict: 'latitude,longitude,start_year,end_year,source' });
    return result;
  } catch {
    return null;
  }
}

export async function buildFarmContext(
  admin: SupabaseClient,
  userId: string,
  requestedFarmId: string | null
): Promise<FarmContext> {
  const now = new Date().toISOString();
  const sources: ContextSource[] = [];
  const missing: string[] = [];

  const { data: farms } = await admin
    .from('farms')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  const farmRows = (farms ?? []) as Array<Record<string, unknown>>;
  const farm = farmRows.find((f) => f.id === requestedFarmId) ?? farmRows[0] ?? null;
  if (!farmRows.length) missing.push('farm profile');

  let activeCrops: Array<Record<string, unknown>> = [];
  let expenses: Array<Record<string, unknown>> = [];
  let income: Array<Record<string, unknown>> = [];
  let soilRecords: Array<Record<string, unknown>> = [];
  let tasks: Array<Record<string, unknown>> = [];

  if (farm) {
    const { data } = await admin
      .from('farm_crops')
      .select('*, crop:crops(name,name_mr,name_hi,growing_duration_days,water_requirement,seasons,sowing_windows,major_pests,major_diseases,optimal_rainfall_min,optimal_rainfall_max,min_rainfall,max_rainfall,optimal_temp_min,optimal_temp_max,min_ph,max_ph,suitable_soil_types,market_commodities)')
      .eq('farm_id', farm.id)
      .eq('status', 'active')
      .order('sowing_date', { ascending: false })
      .limit(30);
    activeCrops = (data ?? []) as Array<Record<string, unknown>>;

    const [exp, inc, soil, taskRows] = await Promise.all([
      admin.from('expenses').select('*').eq('farm_id', farm.id).order('expense_date', { ascending: false }).limit(300),
      admin.from('income_records').select('*').eq('farm_id', farm.id).order('income_date', { ascending: false }).limit(200),
      admin.from('soil_records').select('*').eq('farm_id', farm.id).order('test_date', { ascending: false }).limit(20),
      admin.from('farm_tasks').select('*').eq('farm_id', farm.id).neq('status', 'completed').order('due_date', { ascending: true }).limit(40),
    ]);
    expenses = (exp.data ?? []) as Array<Record<string, unknown>>;
    income = (inc.data ?? []) as Array<Record<string, unknown>>;
    soilRecords = (soil.data ?? []) as Array<Record<string, unknown>>;
    tasks = (taskRows.data ?? []) as Array<Record<string, unknown>>;
  }

  const { data: cropRef } = await admin
    .from('crops')
    .select('id,name,seasons,water_requirement,optimal_rainfall_min,optimal_rainfall_max,min_rainfall,max_rainfall,optimal_temp_min,optimal_temp_max,min_ph,max_ph,suitable_soil_types,market_commodities,growing_duration_days,cost_min_per_acre,cost_max_per_acre,yield_min_per_acre,yield_max_per_acre')
    .eq('is_active', true)
    .order('name');

  const { data: market } = await admin
    .from('market_prices')
    .select('commodity,state,district,market_name,variety,modal_price,min_price,max_price,arrival_date,source')
    .order('arrival_date', { ascending: false })
    .limit(500);
  const marketRows = (market ?? []) as Array<Record<string, unknown>>;

  let weather: Record<string, unknown> | null = null;
  let climate: Record<string, unknown> | null = null;
  const lat = farm?.latitude as number | null;
  const lon = farm?.longitude as number | null;
  if (lat != null && lon != null) {
    [weather, climate] = await Promise.all([getWeather(lat, lon), getClimate(admin, lat, lon)]);
    if (!weather) missing.push('live weather forecast');
    if (!climate) missing.push('historical climate');
  } else {
    missing.push('farm coordinates');
  }

  sources.push({
    provider: 'FarmDesk',
    dataset: 'Your farms, crops, expenses, income and soil records',
    retrievedAt: now,
    note: `${farmRows.length} farm(s), ${expenses.length} expense row(s), ${income.length} income row(s)`,
  });
  if (weather) {
    sources.push({
      provider: 'Open-Meteo',
      dataset: '7-day forecast',
      retrievedAt: String(weather.fetchedAt),
      observationDate: now.slice(0, 10),
      note: 'Forecast, not an official IMD warning.',
    });
  }
  if (climate) {
    sources.push({
      provider: 'NASA POWER',
      dataset: 'MERRA-2 monthly climate, 5-year mean',
      retrievedAt: String(climate.fetchedAt),
      note: 'Gridded reanalysis, not on-farm measurement.',
    });
  }
  if (marketRows.length) {
    sources.push({
      provider: 'data.gov.in / AGMARKNET',
      dataset: 'Saved daily mandi price snapshots',
      retrievedAt: now,
      observationDate: String(marketRows.map((r) => r.arrival_date).sort().at(-1) ?? ''),
      note: 'Latest saved official observations; live feed may be newer.',
    });
  } else {
    missing.push('market price observations');
  }

  return {
    generatedAt: now,
    user: { id: userId },
    farms: farmRows,
    farm,
    activeCrops,
    cropReference: (cropRef ?? []) as Array<Record<string, unknown>>,
    expenses,
    income,
    soilRecords,
    tasks,
    marketRows,
    weather,
    climate,
    sources,
    missing,
  };
}

export function seasonNow(date = new Date()): 'kharif' | 'rabi' | 'zaid' {
  const m = date.getMonth() + 1;
  if (m >= 6 && m <= 10) return 'kharif';
  if (m >= 11 || m <= 2) return 'rabi';
  return 'zaid';
}

export function monthName(month: number): string {
  return MONTHS[Math.max(0, Math.min(11, month - 1))];
}
