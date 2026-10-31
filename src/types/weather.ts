// Weather types for FarmDesk
// Used by weatherService and climateService

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  surfacePressure: number;
  description: string;
  icon: string;
  fetchedAt: string;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  relativeHumidity: number;
  precipitationProbability: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  et0Evapotranspiration: number;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  latitude: number;
  longitude: number;
  timezone: string;
  fetchedAt: string;
}

export type WeatherAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type WeatherAlertType =
  | 'heavy_rain'
  | 'moderate_rain'
  | 'extreme_heat'
  | 'heat_wave'
  | 'cold_snap'
  | 'frost_risk'
  | 'high_wind'
  | 'strong_wind'
  | 'thunderstorm';

export interface WeatherAlert {
  id: string;
  type: WeatherAlertType;
  severity: WeatherAlertSeverity;
  title: string;
  message: string;
  date: string;
  value: number;
  unit: string;
}

export interface HistoricalClimate {
  month: string; // YYYY-MM format
  year: number;
  monthNumber: number; // 1-12
  temperatureMax: number;
  temperatureMin: number;
  temperatureMean: number;
  precipitationSum: number;
  rainSum?: number;
  et0Evapotranspiration: number;
  relativeHumidity?: number;
  solarRadiation?: number;
}

export interface SeasonalAverage {
  season: 'Kharif' | 'Rabi' | 'Zaid';
  months: string;
  temperatureMean: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationMean: number;
  relativeHumidityMean: number;
  solarRadiationMean: number;
}
