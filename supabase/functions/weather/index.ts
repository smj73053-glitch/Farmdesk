import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AuthError, fetchWithTimeout, numberInRange, requireUser, serviceClient } from '../_shared/auth.ts';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const CACHE_MINUTES = 30;

interface RawOpenMeteo {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
  current: Record<string, number | string>;
  hourly: Record<string, (number | string | null)[]>;
  daily: Record<string, (number | string | null)[]>;
}

function mapWeather(raw: RawOpenMeteo, fetchedAt: string, cached: boolean) {
  const h = raw.hourly;
  const d = raw.daily;
  const times = (h.time ?? []) as string[];
  const now = Date.now();
  const first = Math.max(0, times.findIndex((t) => new Date(t).getTime() >= now - 3600000));
  const hourly = times.slice(first, first + 24).map((time, i) => {
    const idx = first + i;
    return {
      time,
      temperature: Number(h.temperature_2m?.[idx]),
      humidity: Number(h.relative_humidity_2m?.[idx]),
      rainProbability: Number(h.precipitation_probability?.[idx] ?? 0),
      precipitation: Number(h.precipitation?.[idx] ?? 0),
      weatherCode: Number(h.weather_code?.[idx]),
      windSpeed: Number(h.wind_speed_10m?.[idx]),
      soilMoisture: h.soil_moisture_0_to_7cm?.[idx] != null ? Number(h.soil_moisture_0_to_7cm[idx]) : null,
      et0: h.et0_fao_evapotranspiration?.[idx] != null ? Number(h.et0_fao_evapotranspiration[idx]) : null,
    };
  });

  const daily = ((d.time ?? []) as string[]).map((date, i) => ({
    date,
    weatherCode: Number(d.weather_code?.[i]),
    tempMax: Number(d.temperature_2m_max?.[i]),
    tempMin: Number(d.temperature_2m_min?.[i]),
    rainfall: Number(d.precipitation_sum?.[i] ?? 0),
    rainProbability: Number(d.precipitation_probability_max?.[i] ?? 0),
    windSpeedMax: Number(d.wind_speed_10m_max?.[i]),
    sunrise: String(d.sunrise?.[i] ?? ''),
    sunset: String(d.sunset?.[i] ?? ''),
    uvIndexMax: Number(d.uv_index_max?.[i] ?? 0),
    et0: Number(d.et0_fao_evapotranspiration?.[i] ?? 0),
  }));

  const c = raw.current;
  return {
    available: true,
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    timezone: raw.timezone ?? 'Asia/Kolkata',
    elevation: raw.elevation,
    source: 'Open-Meteo',
    providerUrl: 'https://open-meteo.com/',
    fetchedAt,
    expiresAt: new Date(new Date(fetchedAt).getTime() + CACHE_MINUTES * 60000).toISOString(),
    cached,
    stale: false,
    current: {
      time: String(c.time ?? ''),
      temperature: Number(c.temperature_2m),
      apparentTemperature: Number(c.apparent_temperature),
      humidity: Number(c.relative_humidity_2m),
      precipitation: Number(c.precipitation ?? 0),
      weatherCode: Number(c.weather_code),
      windSpeed: Number(c.wind_speed_10m),
      windDirection: Number(c.wind_direction_10m),
      pressure: Number(c.surface_pressure),
      isDay: Number(c.is_day) === 1,
    },
    hourly,
    daily,
  };
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);

  try {
    await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const latitude = numberInRange(body.latitude, 'latitude', -90, 90);
    const longitude = numberInRange(body.longitude, 'longitude', -180, 180);
    const force = body.force === true;

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

    const fetchedAt = new Date().toISOString();
    const res = await fetchWithTimeout(`${OPEN_METEO}?${params}`, {}, 15000, 1);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return jsonResponse(req, {
        available: false,
        reason: `Open-Meteo returned ${res.status}. ${text.slice(0, 160)}`.trim(),
        source: 'Open-Meteo',
        fetchedAt,
      }, 502);
    }

    const raw = (await res.json()) as RawOpenMeteo;
    const data = mapWeather(raw, fetchedAt, false);

    // Persist normalised daily rows (shared reference data) and a short cache.
    try {
      const admin = serviceClient();
      const rows = data.daily.map((day) => ({
        latitude,
        longitude,
        record_date: day.date,
        temp_max: Number.isFinite(day.tempMax) ? day.tempMax : null,
        temp_min: Number.isFinite(day.tempMin) ? day.tempMin : null,
        rainfall_mm: day.rainfall,
        rain_probability: day.rainProbability,
        humidity: null,
        wind_speed: day.windSpeedMax,
        weather_code: day.weatherCode,
        et0_mm: day.et0,
        source: 'open-meteo',
        observation_time: fetchedAt,
        fetched_at: fetchedAt,
      }));
      await admin.from('weather_records').upsert(rows, {
        onConflict: 'latitude,longitude,record_date,source',
        ignoreDuplicates: false,
      });
      await admin.from('weather_cache').insert({
        latitude,
        longitude,
        data,
        data_type: 'forecast',
        fetched_at: fetchedAt,
        expires_at: data.expiresAt,
      });
    } catch (persistError) {
      console.warn('weather cache persistence failed', persistError);
    }

    return jsonResponse(req, data, 200, {
      'Cache-Control': `public, max-age=${force ? 0 : CACHE_MINUTES * 60}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse(req, { error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'Weather service failed';
    return jsonResponse(req, { available: false, reason: message, source: 'Open-Meteo' }, 400);
  }
});
