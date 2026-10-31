import type { WeatherAlertItem, WeatherDaily, WeatherData } from '@/types/models';

const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: 'Sun' },
  1: { label: 'Mainly clear', icon: 'Sun' },
  2: { label: 'Partly cloudy', icon: 'CloudSun' },
  3: { label: 'Overcast', icon: 'Cloud' },
  45: { label: 'Fog', icon: 'CloudFog' },
  48: { label: 'Rime fog', icon: 'CloudFog' },
  51: { label: 'Light drizzle', icon: 'CloudDrizzle' },
  53: { label: 'Drizzle', icon: 'CloudDrizzle' },
  55: { label: 'Heavy drizzle', icon: 'CloudDrizzle' },
  56: { label: 'Freezing drizzle', icon: 'CloudHail' },
  57: { label: 'Freezing drizzle', icon: 'CloudHail' },
  61: { label: 'Light rain', icon: 'CloudRain' },
  63: { label: 'Moderate rain', icon: 'CloudRain' },
  65: { label: 'Heavy rain', icon: 'CloudRainWind' },
  66: { label: 'Freezing rain', icon: 'CloudHail' },
  67: { label: 'Freezing rain', icon: 'CloudHail' },
  71: { label: 'Light snow', icon: 'CloudSnow' },
  73: { label: 'Snow', icon: 'CloudSnow' },
  75: { label: 'Heavy snow', icon: 'Snowflake' },
  77: { label: 'Snow grains', icon: 'Snowflake' },
  80: { label: 'Rain showers', icon: 'CloudRain' },
  81: { label: 'Rain showers', icon: 'CloudRain' },
  82: { label: 'Violent showers', icon: 'CloudRainWind' },
  85: { label: 'Snow showers', icon: 'CloudSnow' },
  86: { label: 'Snow showers', icon: 'CloudSnow' },
  95: { label: 'Thunderstorm', icon: 'CloudLightning' },
  96: { label: 'Thunderstorm with hail', icon: 'CloudLightning' },
  99: { label: 'Severe thunderstorm', icon: 'CloudLightning' },
};

export function weatherLabel(code: number): string {
  return WMO[code]?.label ?? 'Unknown conditions';
}

export function weatherIconName(code: number): string {
  return WMO[code]?.icon ?? 'CloudSun';
}

export function windDirectionLabel(deg: number | null | undefined): string {
  if (deg == null) return '—';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function startOfDayIso(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * FarmDesk forecast alerts. These are derived from real Open-Meteo forecasts with
 * explicit thresholds. They are NOT official IMD warnings.
 */
export function deriveWeatherAlerts(daily: WeatherDaily[]): WeatherAlertItem[] {
  const alerts: WeatherAlertItem[] = [];
  for (const day of daily.slice(0, 7)) {
    const label = new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
    });

    if (day.rainfall >= 50) {
      alerts.push({
        type: 'heavy_rain', severity: 'critical',
        title: `Very heavy rain forecast for ${label}`,
        message: `${Math.round(day.rainfall)} mm is forecast (FarmDesk threshold: 50 mm/day). Protect harvested produce, check field drainage and avoid fertiliser application before the rain.`,
        date: day.date, value: day.rainfall, unit: 'mm', threshold: '≥ 50 mm/day',
      });
    } else if (day.rainfall >= 25) {
      alerts.push({
        type: 'heavy_rain', severity: 'high',
        title: `Heavy rain forecast for ${label}`,
        message: `${Math.round(day.rainfall)} mm is forecast (FarmDesk threshold: 25 mm/day). Review drainage and irrigation scheduling.`,
        date: day.date, value: day.rainfall, unit: 'mm', threshold: '≥ 25 mm/day',
      });
    } else if (day.rainfall >= 10 && day.rainProbability >= 60) {
      alerts.push({
        type: 'moderate_rain', severity: 'medium',
        title: `Useful rain likely on ${label}`,
        message: `${Math.round(day.rainfall)} mm forecast with ${Math.round(day.rainProbability)}% probability. You may be able to delay the next irrigation; check your field before deciding.`,
        date: day.date, value: day.rainfall, unit: 'mm', threshold: '≥ 10 mm & ≥ 60% probability',
      });
    }

    if (day.tempMax >= 43) {
      alerts.push({
        type: 'heat_wave', severity: 'critical',
        title: `Extreme heat forecast for ${label}`,
        message: `Maximum ${Math.round(day.tempMax)}°C (FarmDesk threshold: 43°C). Irrigate early morning or evening, provide shade where possible and avoid mid-day spraying.`,
        date: day.date, value: day.tempMax, unit: '°C', threshold: '≥ 43°C',
      });
    } else if (day.tempMax >= 40) {
      alerts.push({
        type: 'extreme_heat', severity: 'high',
        title: `Heat stress risk on ${label}`,
        message: `Maximum ${Math.round(day.tempMax)}°C (FarmDesk threshold: 40°C). Monitor soil moisture and avoid mid-day field work.`,
        date: day.date, value: day.tempMax, unit: '°C', threshold: '≥ 40°C',
      });
    }

    if (day.tempMin <= 4) {
      alerts.push({
        type: 'frost_risk', severity: 'critical',
        title: `Frost risk on ${label}`,
        message: `Minimum ${Math.round(day.tempMin)}°C (FarmDesk threshold: 4°C). Protect sensitive crops and young plants.`,
        date: day.date, value: day.tempMin, unit: '°C', threshold: '≤ 4°C',
      });
    } else if (day.tempMin <= 7) {
      alerts.push({
        type: 'cold_snap', severity: 'high',
        title: `Cold conditions on ${label}`,
        message: `Minimum ${Math.round(day.tempMin)}°C (FarmDesk threshold: 7°C). Watch frost-sensitive crops.`,
        date: day.date, value: day.tempMin, unit: '°C', threshold: '≤ 7°C',
      });
    }

    if (day.windSpeedMax >= 50) {
      alerts.push({
        type: 'strong_wind', severity: 'high',
        title: `Strong wind forecast for ${label}`,
        message: `Wind up to ${Math.round(day.windSpeedMax)} km/h (FarmDesk threshold: 50 km/h). Secure shade nets, stakes and harvested produce.`,
        date: day.date, value: day.windSpeedMax, unit: 'km/h', threshold: '≥ 50 km/h',
      });
    }

    if (day.weatherCode >= 95 && day.weatherCode <= 99) {
      alerts.push({
        type: 'thunderstorm', severity: 'medium',
        title: `Thunderstorm possible on ${label}`,
        message: 'Thunderstorms are forecast. Avoid open-field work during lightning and secure loose equipment.',
        date: day.date, value: day.weatherCode, unit: 'WMO code', threshold: 'WMO 95–99',
      });
    }
  }
  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  return alerts.sort((a, b) => rank[b.severity] - rank[a.severity] || a.date.localeCompare(b.date));
}

export function rainfallIntelligence(weather: WeatherData | undefined): {
  total7d: number;
  wetDays: number;
  headline: string;
  detail: string;
  level: 'low' | 'moderate' | 'high';
} | null {
  if (!weather?.available || weather.daily.length === 0) return null;
  const days = weather.daily.slice(0, 7);
  const total7d = days.reduce((sum, d) => sum + (d.rainfall ?? 0), 0);
  const wetDays = days.filter((d) => d.rainfall >= 2.5).length;
  const highDays = days.filter((d) => d.rainfall >= 25).length;

  let level: 'low' | 'moderate' | 'high' = 'low';
  let headline = 'Low rainfall expected this week';
  let detail = `About ${Math.round(total7d)} mm is forecast over the next 7 days. Continue with your normal irrigation plan, but check the field before watering.`;

  if (total7d >= 100 || highDays >= 2) {
    level = 'high';
    headline = 'Significant rainfall expected this week';
    detail = `${Math.round(total7d)} mm is forecast over 7 days, with ${highDays} day(s) at or above 25 mm. Review irrigation, field drainage and harvested produce storage.`;
  } else if (total7d >= 25 || wetDays >= 2) {
    level = 'moderate';
    headline = 'Useful rainfall likely this week';
    detail = `${Math.round(total7d)} mm is forecast over ${wetDays} wet day(s). Consider delaying irrigation where soil moisture is adequate and avoid spraying just before rain.`;
  }

  if (total7d === 0) {
    detail = 'No meaningful rainfall is forecast in the next 7 days. Plan irrigation according to crop stage and soil moisture.';
  }

  return { total7d, wetDays, headline, detail, level };
}

export function isStale(fetchedAt: string, staleMinutes: number): boolean {
  const age = Date.now() - new Date(fetchedAt).getTime();
  return age > staleMinutes * 60 * 1000;
}

export function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
