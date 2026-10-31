import { supabase, functionsUrl, isSupabaseConfigured } from '@/lib/supabase';
import { AppError } from '@/lib/errors';
import type { ClimateData, ClimateMonth, MarketPrice, MarketQuery, MarketResponse, WeatherData } from '@/types/models';

async function invokeFunction<T>(name: string, body: Record<string, unknown>, timeoutMs = 20000): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${functionsUrl}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session.session?.access_token
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (json as { reason?: string; message?: string; error?: string })?.reason
        ?? (json as { message?: string })?.message
        ?? (json as { error?: string })?.error
        ?? `Service returned ${res.status}`;
      throw new AppError(message, `FN_${res.status}`);
    }
    return json as T;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AppError('The data service took too long to respond.', 'TIMEOUT');
    }
    throw new AppError(
      err instanceof Error ? err.message : 'The data service is unavailable.',
      'NETWORK'
    );
  } finally {
    clearTimeout(timer);
  }
}

/* -----------------------------------------------------------------------------
 * Weather (Open-Meteo, via Edge Function with a direct CORS-safe fallback)
 * -------------------------------------------------------------------------- */

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

function mapOpenMeteo(raw: Record<string, unknown>, cached = false): WeatherData {
  const r = raw as {
    latitude: number; longitude: number; timezone: string; elevation?: number;
    current: Record<string, number | string>;
    hourly: Record<string, (number | string | null)[]>;
    daily: Record<string, (number | string | null)[]>;
  };
  const current = r.current;
  const hourly = r.hourly;
  const daily = r.daily;
  const fetchedAt = new Date().toISOString();
  const nowIndex = (hourly.time as string[]).findIndex((t) => new Date(t).getTime() >= Date.now() - 3600000);
  const startHour = Math.max(0, nowIndex);

  return {
    available: true,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    timezone: r.timezone ?? 'Asia/Kolkata',
    elevation: r.elevation,
    source: 'Open-Meteo',
    providerUrl: 'https://open-meteo.com/',
    fetchedAt,
    expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
    cached,
    stale: false,
    current: {
      time: String(current.time),
      temperature: Number(current.temperature_2m),
      apparentTemperature: Number(current.apparent_temperature),
      humidity: Number(current.relative_humidity_2m),
      precipitation: Number(current.precipitation),
      weatherCode: Number(current.weather_code),
      windSpeed: Number(current.wind_speed_10m),
      windDirection: Number(current.wind_direction_10m),
      pressure: Number(current.surface_pressure),
      isDay: Number(current.is_day) === 1,
    },
    hourly: (hourly.time as string[]).slice(startHour, startHour + 24).map((time, i) => {
      const idx = startHour + i;
      return {
        time,
        temperature: Number(hourly.temperature_2m[idx]),
        humidity: Number(hourly.relative_humidity_2m[idx]),
        rainProbability: Number(hourly.precipitation_probability[idx] ?? 0),
        precipitation: Number(hourly.precipitation[idx] ?? 0),
        weatherCode: Number(hourly.weather_code[idx]),
        windSpeed: Number(hourly.wind_speed_10m[idx]),
        soilMoisture: hourly.soil_moisture_0_to_7cm?.[idx] != null ? Number(hourly.soil_moisture_0_to_7cm[idx]) : null,
        et0: hourly.et0_fao_evapotranspiration?.[idx] != null ? Number(hourly.et0_fao_evapotranspiration[idx]) : null,
      };
    }),
    daily: (daily.time as string[]).map((date, i) => ({
      date,
      weatherCode: Number(daily.weather_code[i]),
      tempMax: Number(daily.temperature_2m_max[i]),
      tempMin: Number(daily.temperature_2m_min[i]),
      rainfall: Number(daily.precipitation_sum[i] ?? 0),
      rainProbability: Number(daily.precipitation_probability_max[i] ?? 0),
      windSpeedMax: Number(daily.wind_speed_10m_max[i]),
      sunrise: String(daily.sunrise[i]),
      sunset: String(daily.sunset[i]),
      uvIndexMax: Number(daily.uv_index_max[i] ?? 0),
      et0: Number(daily.et0_fao_evapotranspiration[i] ?? 0),
    })),
  };
}

export const weatherService = {
  async getForecast(latitude: number, longitude: number): Promise<WeatherData> {
    try {
      const data = await invokeFunction<WeatherData>('weather', { latitude, longitude }, 18000);
      if (!data || data.available === false) {
        throw new AppError(data?.reason || 'Weather service returned no data', 'WEATHER_UNAVAILABLE');
      }
      return data;
    } catch (edgeError) {
      // Open-Meteo supports browser CORS and needs no key. This fallback keeps the
      // forecast available if local Edge Functions are not running, and is labelled.
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day',
          hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,soil_moisture_0_to_7cm,et0_fao_evapotranspiration',
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max,et0_fao_evapotranspiration',
          timezone: 'Asia/Kolkata',
          forecast_days: '7',
          wind_speed_unit: 'kmh',
        });
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`${OPEN_METEO}?${params}`, { signal: controller.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
        const json = await res.json();
        const mapped = mapOpenMeteo(json);
        mapped.source = 'Open-Meteo (direct)';
        return mapped;
      } catch (directError) {
        const reason = edgeError instanceof Error ? edgeError.message : 'Weather data unavailable';
        throw new AppError(
          `Weather data is unavailable right now. ${reason}`,
          'WEATHER_UNAVAILABLE',
          directError
        );
      }
    }
  },
};

/* -----------------------------------------------------------------------------
 * Climate (NASA POWER via Edge Function; NASA does not allow browser CORS)
 * -------------------------------------------------------------------------- */

export const climateService = {
  async getHistory(latitude: number, longitude: number, years = 5): Promise<ClimateData> {
    const data = await invokeFunction<ClimateData>('climate', { latitude, longitude, years }, 30000);
    if (!data?.available) {
      throw new AppError(data?.reason || 'Historical climate data unavailable', 'CLIMATE_UNAVAILABLE');
    }
    return data;
  },
};

/* -----------------------------------------------------------------------------
 * Market (data.gov.in via Edge Function)
 * -------------------------------------------------------------------------- */

export const marketService = {
  async search(query: MarketQuery): Promise<MarketResponse> {
    return invokeFunction<MarketResponse>('market', { ...query, persist: true }, 30000);
  },

  async history(commodity: string, marketName?: string, days = 120): Promise<MarketPrice[]> {
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    let q = supabase
      .from('market_prices')
      .select('*')
      .ilike('commodity', `%${commodity}%`)
      .gte('arrival_date', from)
      .order('arrival_date', { ascending: true })
      .limit(1000);
    if (marketName) q = q.eq('market_name', marketName);
    const { data, error } = await q;
    if (error) throw new AppError(`Could not load price history: ${error.message}`);
    return (data ?? []) as MarketPrice[];
  },

  async importCsv(
    records: Omit<MarketPrice, 'id' | 'fetched_at' | 'source'>[],
    fileName: string,
    userId: string
  ): Promise<{ inserted: number; skipped: number; batch: string }> {
    const batch = crypto.randomUUID();
    const fetchedAt = new Date().toISOString();
    let inserted = 0;
    let skipped = 0;
    const chunkSize = 250;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize).map((r) => ({
        ...r,
        source: 'agmarknet-csv',
        import_batch: batch,
        fetched_at: fetchedAt,
        commodity: r.commodity.trim(),
        state: r.state?.trim() || null,
        district: r.district?.trim() || null,
        market_name: r.market_name.trim(),
        variety: r.variety?.trim() || null,
      }));
      const { data, error } = await supabase
        .from('market_prices')
        .upsert(chunk, {
          onConflict: 'commodity,state,district,market_name,variety,arrival_date',
          ignoreDuplicates: true,
        })
        .select('id');
      if (error) {
        // RLS intentionally prevents client inserts; CSV import goes through the
        // market Edge Function with validation instead.
        throw new AppError(
          'Direct CSV import is restricted. Use the import option which sends rows through the secure import service.',
          'IMPORT_FORBIDDEN',
          error
        );
      }
      inserted += data?.length ?? 0;
    }
    skipped = records.length - inserted;
    await supabase.from('market_imports').insert({
      user_id: userId,
      file_name: fileName,
      row_count: records.length,
      inserted_count: inserted,
      skipped_count: skipped,
      source: 'agmarknet-csv',
      status: 'completed',
    });
    return { inserted, skipped, batch };
  },

  async importRows(payload: {
    records: Omit<MarketPrice, 'id' | 'fetched_at' | 'source'>[];
    fileName: string;
  }): Promise<{ inserted: number; skipped: number; rows: number; errors?: string[] }> {
    return invokeFunction('market-import', payload, 60000);
  },
};

export { isSupabaseConfigured };

export function monthsFromClimate(months: ClimateMonth[]): ClimateMonth[] {
  return months.filter((m) => m.monthNumber >= 1 && m.monthNumber <= 12);
}
