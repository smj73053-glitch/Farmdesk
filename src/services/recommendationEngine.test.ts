import { describe, expect, it } from 'vitest';
import {
  buildRecommendations,
  currentSeason,
  defaultSeason,
  normaliseCommodity,
  summariseClimate,
} from '@/services/recommendationEngine';
import type { ClimateData, Crop, Farm, MarketPrice, WeatherData } from '@/types/models';

function crop(partial: Partial<Crop> & Pick<Crop, 'id' | 'name' | 'slug'>): Crop {
  return {
    is_active: true,
    seasons: ['kharif'],
    growth_stages: [],
    sowing_windows: { kharif: { start: 6, end: 7 }, rabi: { start: 10, end: 11 } },
    ...partial,
  } as Crop;
}

const onion = crop({
  id: 'crop-onion',
  name: 'Onion',
  slug: 'onion',
  seasons: ['kharif', 'rabi'],
  optimal_rainfall_min: 500,
  optimal_rainfall_max: 800,
  min_rainfall: 300,
  max_rainfall: 1100,
  optimal_temp_min: 20,
  optimal_temp_max: 30,
  min_temp: 10,
  max_temp: 38,
  min_ph: 5.5,
  max_ph: 8,
  water_requirement: 'medium',
  growing_duration_days: 120,
  typical_yield_per_acre: 100,
  yield_min_per_acre: 80,
  yield_max_per_acre: 120,
  cost_min_per_acre: 30000,
  cost_max_per_acre: 50000,
  major_pests: [],
  major_diseases: [],
});

const cotton = crop({
  id: 'crop-cotton',
  name: 'Cotton',
  slug: 'cotton',
  seasons: ['kharif'],
  optimal_rainfall_min: 600,
  optimal_rainfall_max: 1000,
  min_rainfall: 400,
  max_rainfall: 1500,
  optimal_temp_min: 21,
  optimal_temp_max: 35,
  min_temp: 15,
  max_temp: 40,
  min_ph: 5.5,
  max_ph: 8.5,
  water_requirement: 'medium',
  growing_duration_days: 180,
  typical_yield_per_acre: 8,
  yield_min_per_acre: 5,
  yield_max_per_acre: 12,
  cost_min_per_acre: 35000,
  cost_max_per_acre: 55000,
  major_pests: [],
  major_diseases: [],
});

const farm = {
  id: 'farm-1',
  name: 'Test farm',
  total_area: 2,
  area_unit: 'acres',
  soil_type: 'black',
  soil_ph: 6.8,
  irrigation_available: true,
  water_source: 'borewell',
  annual_budget: 100000,
  state: 'Maharashtra',
  district: 'Pune',
  latitude: 18.5,
  longitude: 73.8,
} as Farm;

function climateFixture(): ClimateData {
  const months = [];
  for (let year = 2021; year <= 2025; year += 1) {
    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
      months.push({
        year,
        monthNumber,
        month: String(monthNumber),
        rainfall: monthNumber >= 6 && monthNumber <= 9 ? 150 : 10,
        tempMean: 25,
        tempMax: 31,
        tempMin: 19,
        humidity: 65,
        solarRadiation: 18,
      });
    }
  }
  return {
    available: true,
    months,
    annual: [],
    monthlyNormals: [],
    seasons: [],
    latitude: 18.5,
    longitude: 73.8,
    source: 'NASA POWER',
    providerUrl: 'https://power.larc.nasa.gov/',
    fetchedAt: '2026-10-30T00:00:00Z',
    cached: false,
    gridResolution: '0.5°',
  } as ClimateData;
}

const market: MarketPrice[] = [
  {
    commodity: 'Onion',
    state: 'Maharashtra',
    district: 'Pune',
    market_name: 'Pune APMC',
    variety: 'FAQ',
    min_price: 1800,
    max_price: 2600,
    modal_price: 2200,
    arrival_date: '2026-10-30',
    source: 'agmarknet',
    source_url: null,
    fetched_at: '2026-10-30T08:00:00Z',
  },
  {
    commodity: 'Cotton',
    state: 'Maharashtra',
    district: 'Amravati',
    market_name: 'Amravati APMC',
    variety: 'Medium',
    min_price: 6800,
    max_price: 7400,
    modal_price: 7100,
    arrival_date: '2026-10-30',
    source: 'agmarknet',
    source_url: null,
    fetched_at: '2026-10-30T08:00:00Z',
  },
];

const weather: WeatherData = {
  available: true,
  source: 'Open-Meteo',
  fetchedAt: '2026-10-30T00:00:00Z',
  latitude: 18.5,
  longitude: 73.8,
  timezone: 'Asia/Kolkata',
  daily: [],
  hourly: [],
} as unknown as WeatherData;

describe('season helpers', () => {
  it('maps Indian cropping seasons from the month', () => {
    expect(currentSeason(new Date('2026-07-01'))).toBe('kharif');
    expect(currentSeason(new Date('2026-12-01'))).toBe('rabi');
    expect(currentSeason(new Date('2026-03-01'))).toBe('zaid');
    expect(defaultSeason(new Date('2026-03-01'))).toBe('zaid');
  });
});

describe('summariseClimate', () => {
  it('sums monthly rainfall into annual totals', () => {
    const summary = summariseClimate(climateFixture(), 'kharif');
    // 4 months × 150 mm + 8 months × 10 mm = 680 mm
    expect(summary.annualRainfall).toBe(680);
    expect(summary.seasonalTemp).toBe(25);
    expect(summary.years).toBe(5);
  });

  it('does not invent data when climate is unavailable', () => {
    const summary = summariseClimate({ available: false } as ClimateData, 'kharif');
    expect(summary).toMatchObject({ annualRainfall: null, seasonalRainfall: null, seasonalTemp: null, years: 0 });
  });
});

describe('normaliseCommodity', () => {
  it('removes punctuation and case differences', () => {
    expect(normaliseCommodity('Onion, Red')).toBe('onion red');
    expect(normaliseCommodity('  Paddy (Common) ')).toBe('paddy common');
  });
});

describe('buildRecommendations', () => {
  it('ranks real crops and explains the score', () => {
    const result = buildRecommendations({
      crops: [onion, cotton],
      farm,
      climate: climateFixture(),
      marketRecords: market,
      weather,
      season: 'kharif',
      now: new Date('2026-10-30T00:00:00Z'),
    });

    expect(result.recommendations.length).toBe(2);
    expect(result.farmId).toBe('farm-1');
    expect(result.season).toBe('kharif');
    expect(result.inputs.annualRainfallMm).toBe(680);
    expect(result.inputs.areaAcres).toBe(2);

    for (const recommendation of result.recommendations) {
      expect(recommendation.score.overall).toBeGreaterThanOrEqual(0);
      expect(recommendation.score.overall).toBeLessThanOrEqual(100);
      expect(recommendation.reasons.length).toBeGreaterThan(0);
      expect(recommendation.plantingWindow).not.toMatch(/undefined/);
    }
  });

  it('lowers confidence and flags missing inputs instead of inventing them', () => {
    const sparseFarm = { ...farm, soil_type: null, soil_ph: null, annual_budget: null } as Farm;
    const result = buildRecommendations({
      crops: [onion],
      farm: sparseFarm,
      climate: null,
      marketRecords: [],
      weather: null,
      season: 'kharif',
      now: new Date('2026-10-30T00:00:00Z'),
    });

    expect(result.inputs.missing).toEqual(
      expect.arrayContaining(['soil type', 'soil pH', 'historical rainfall', 'historical temperature', 'farming budget', 'current market prices'])
    );
    expect(result.recommendations[0].score.confidence).toBeLessThan(60);
    expect(result.confidenceNote).toMatch(/missing or assumed inputs/i);
  });

  it('does not let market price dominate the agronomic score', () => {
    const noMarket = buildRecommendations({
      crops: [onion, cotton],
      farm,
      climate: climateFixture(),
      marketRecords: [],
      weather,
      season: 'kharif',
      now: new Date('2026-10-30T00:00:00Z'),
    });
    const withMarket = buildRecommendations({
      crops: [onion, cotton],
      farm,
      climate: climateFixture(),
      marketRecords: market,
      weather,
      season: 'kharif',
      now: new Date('2026-10-30T00:00:00Z'),
    });

    for (const cropId of ['crop-onion', 'crop-cotton']) {
      const before = noMarket.allCrops.find((row) => row.crop.id === cropId)!;
      const after = withMarket.allCrops.find((row) => row.crop.id === cropId)!;
      // Market and economics together carry 24% of the weight. Weights are
      // redistributed when market data is absent, so the shift must stay bounded.
      expect(Math.abs(after.score.overall - before.score.overall)).toBeLessThanOrEqual(30);
    }
    expect(withMarket.recommendations[0].market.available).toBe(true);
    expect(withMarket.recommendations[0].market.latestDate).toBe('2026-10-30');
  });
});
