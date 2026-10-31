import type {
  ClimateData,
  Crop,
  Farm,
  MarketPrice,
  Recommendation,
  RecommendationResult,
  Season,
  WeatherData,
} from '@/types/models';
import { bandScore, clamp, round, toAcres } from '@/lib/units';
import { cropRiskFlags, soilMatchScore } from '@/services/recommendationRules';

const SEASON_MONTHS: Record<Season, number[]> = {
  kharif: [6, 7, 8, 9, 10],
  rabi: [10, 11, 12, 1, 2, 3],
  zaid: [2, 3, 4, 5],
  annual: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function currentSeason(now = new Date()): Season {
  const m = now.getMonth() + 1;
  if (m >= 6 && m <= 10) return 'kharif';
  if (m >= 11 || m <= 2) return 'rabi';
  return 'zaid';
}

export function seasonLabel(season: Season): string {
  return season === 'kharif' ? 'Kharif' : season === 'rabi' ? 'Rabi' : season === 'zaid' ? 'Zaid' : 'Annual';
}

/** Indian cropping season from the calendar month. Used only as a UI default. */
export function defaultSeason(date = new Date()): Season {
  const month = date.getMonth() + 1;
  if (month >= 6 && month <= 10) return 'kharif';
  if (month >= 11 || month <= 2) return 'rabi';
  return 'zaid';
}

function average(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

interface ClimateSummary {
  annualRainfall: number | null;
  seasonalRainfall: number | null;
  seasonalTemp: number | null;
  years: number;
}

/** Turn NASA POWER monthly rows into annual / seasonal context. */
export function summariseClimate(climate: ClimateData | null | undefined, season: Season): ClimateSummary {
  if (!climate?.available || !climate.months?.length) {
    return { annualRainfall: null, seasonalRainfall: null, seasonalTemp: null, years: 0 };
  }
  const byYear = new Map<number, Map<number, { rainfall: number; temp: number }>>();
  for (const m of climate.months) {
    if (m.monthNumber < 1 || m.monthNumber > 12) continue;
    if (!byYear.has(m.year)) byYear.set(m.year, new Map());
    byYear.get(m.year)!.set(m.monthNumber, { rainfall: m.rainfall, temp: m.tempMean });
  }

  const annuals: number[] = [];
  for (const [, months] of byYear) {
    if (months.size === 12) {
      annuals.push([...months.values()].reduce((s, v) => s + v.rainfall, 0));
    }
  }
  // If the API returned a partial year, still show a mean monthly-based estimate only
  // when at least 3 full years exist; otherwise leave annual rainfall missing.
  const annualRainfall = annuals.length ? average(annuals) : null;

  const seasonalRain: number[] = [];
  const seasonalTemps: number[] = [];
  const years = [...byYear.keys()].sort((a, b) => a - b);
  for (const year of years) {
    const months = byYear.get(year)!;
    const monthNums = SEASON_MONTHS[season];
    let rain = 0;
    let rainMonths = 0;
    let tempSum = 0;
    let tempMonths = 0;
    for (const m of monthNums) {
      const entry = season === 'rabi' && (m === 1 || m === 2 || m === 3)
        ? byYear.get(year)?.get(m)
        : months.get(m);
      if (entry) {
        rain += entry.rainfall;
        rainMonths += 1;
        tempSum += entry.temp;
        tempMonths += 1;
      }
    }
    if (rainMonths >= Math.min(3, monthNums.length)) seasonalRain.push(rain);
    if (tempMonths >= Math.min(3, monthNums.length)) seasonalTemps.push(tempSum / tempMonths);
  }

  return {
    annualRainfall: annualRainfall != null ? round(annualRainfall, 0) : null,
    seasonalRainfall: seasonalRain.length ? round(average(seasonalRain)!, 0) : null,
    seasonalTemp: seasonalTemps.length ? round(average(seasonalTemps)!, 1) : null,
    years: annuals.length,
  };
}

export function normaliseCommodity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface CropMarketSummary {
  available: boolean;
  markets: number;
  modalPrice: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  spreadPct: number | null;
  latestDate: string | null;
  matchedCommodities: string[];
  observations: number;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Aggregate the current mandi snapshot for one crop. Prices are never invented. */
export function summariseCropMarket(crop: Crop, records: MarketPrice[]): CropMarketSummary {
  const aliases = new Set(
    [...(crop.market_commodities ?? []), crop.name, crop.name.replace(/\s*\(.*\)$/, '')]
      .map(normaliseCommodity)
      .filter(Boolean)
  );
  const matched = records.filter((r) => {
    if (r.modal_price == null) return false;
    const c = normaliseCommodity(r.commodity);
    if (aliases.has(c)) return true;
    for (const alias of aliases) {
      // Data.gov.in occasionally suffixes commodities, e.g. "Rice(Common)".
      if (c.startsWith(alias) || alias.startsWith(c)) return true;
    }
    return false;
  });
  if (!matched.length) {
    return {
      available: false, markets: 0, modalPrice: null, priceLow: null, priceHigh: null,
      spreadPct: null, latestDate: null, matchedCommodities: [], observations: 0,
    };
  }

  // latest observation per market + commodity + variety
  const latest = new Map<string, MarketPrice>();
  for (const r of matched) {
    const key = `${normaliseCommodity(r.market_name)}|${normaliseCommodity(r.commodity)}|${normaliseCommodity(r.variety ?? '')}`;
    const prev = latest.get(key);
    if (!prev || r.arrival_date > prev.arrival_date) latest.set(key, r);
  }
  const prices = [...latest.values()]
    .map((r) => Number(r.modal_price))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!prices.length) {
    return {
      available: false, markets: 0, modalPrice: null, priceLow: null, priceHigh: null,
      spreadPct: null, latestDate: null, matchedCommodities: [], observations: 0,
    };
  }

  const median = round(percentile(prices, 0.5), 0);
  const low = round(percentile(prices, 0.25), 0);
  const high = round(percentile(prices, 0.75), 0);
  const spreadPct = median > 0 ? round(((high - low) / median) * 100, 1) : null;
  const sortedDates = [...latest.values()].map((r) => r.arrival_date).sort();
  const latestDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : null;
  return {
    available: true,
    markets: latest.size,
    modalPrice: median,
    priceLow: prices.length > 1 ? low : round(median * 0.9, 0),
    priceHigh: prices.length > 1 ? high : round(median * 1.1, 0),
    spreadPct,
    latestDate,
    matchedCommodities: [...new Set([...latest.values()].map((r) => r.commodity))],
    observations: latest.size,
  };
}

function waterScore(crop: Crop, farm: Farm, forecastRain: number | null): number {
  const req = crop.water_requirement ?? 'medium';
  const irrigated = farm.irrigation_available && farm.water_source !== 'Rain-fed only';
  const rainBoost = forecastRain != null && forecastRain >= 25 ? 5 : 0;
  if (req === 'low') return clamp(92 + rainBoost, 0, 100);
  if (req === 'medium') return irrigated ? clamp(90 + rainBoost, 0, 100) : clamp(48 + rainBoost, 0, 70);
  return irrigated ? clamp(86 + rainBoost, 0, 100) : clamp(28 + rainBoost, 0, 45);
}

function seasonScore(crop: Crop, season: Season, now: Date): { score: number; reason: string | null; caution: string | null } {
  const seasons = crop.seasons ?? [];
  const supports = seasons.includes('annual') || seasons.includes(season);
  if (!supports) {
    return {
      score: seasons.length ? 22 : 55,
      reason: null,
      caution: `Usually grown in ${seasons.map((s) => seasonLabel(s as Season)).join(', ') || 'a different season'} — not a normal ${seasonLabel(season)} crop here.`,
    };
  }
  const window = crop.sowing_windows?.[season] ?? crop.sowing_windows?.annual;
  if (!window) return { score: 85, reason: `${seasonLabel(season)} is a listed growing season for this crop.`, caution: null };
  const month = now.getMonth() + 1;
  const inWindow =
    window.start <= window.end
      ? month >= window.start && month <= window.end
      : month >= window.start || month <= window.end;
  const distance = Math.min(
    Math.abs(month - window.start),
    12 - Math.abs(month - window.start),
    Math.abs(month - window.end),
    12 - Math.abs(month - window.end)
  );
  const label = `${MONTH_NAMES[window.start - 1]}–${MONTH_NAMES[window.end - 1]}`;
  if (inWindow) {
    return { score: 98, reason: `The ${seasonLabel(season)} planting window (${label}) is open now.`, caution: null };
  }
  if (distance <= 1) {
    return { score: 90, reason: `The planting window (${label}) is close.`, caution: null };
  }
  return {
    score: 68,
    reason: `${seasonLabel(season)} is suitable; the reference planting window is ${label}.`,
    caution: `You are outside the usual planting window (${label}). Late planting can reduce yield.`,
  };
}

function economicsScore(
  crop: Crop,
  areaAcres: number,
  budget: number | null,
  market: CropMarketSummary
): { score: number; available: boolean; profitMin: number | null; profitMax: number | null; revenueMin: number | null; revenueMax: number | null; costMin: number; costMax: number; caution: string | null } {
  const costMin = (crop.cost_min_per_acre ?? 0) * areaAcres;
  const costMax = (crop.cost_max_per_acre ?? 0) * areaAcres;
  if (!market.available || market.modalPrice == null || market.priceLow == null || market.priceHigh == null || !crop.yield_min_per_acre || !crop.yield_max_per_acre) {
    return {
      score: 50, available: false, profitMin: null, profitMax: null, revenueMin: null, revenueMax: null,
      costMin, costMax, caution: market.available ? null : 'Current market price is unavailable, so no profit projection is shown.',
    };
  }
  const revenueMin = crop.yield_min_per_acre * market.priceLow * areaAcres;
  const revenueMax = crop.yield_max_per_acre * market.priceHigh * areaAcres;
  const profitMin = revenueMin - costMax;
  const profitMax = revenueMax - costMin;
  const costMid = (costMin + costMax) / 2;
  const profitMid = (profitMin + profitMax) / 2;
  const roi = costMid > 0 ? (profitMid / costMid) * 100 : 0;
  let score = roi >= 100 ? 96 : roi >= 50 ? 85 : roi >= 20 ? 72 : roi >= 0 ? 56 : 30;
  let caution: string | null = null;
  if (budget != null && budget > 0 && costMin > budget) {
    score = clamp(score - 18, 0, 100);
    caution = `Reference cost for ${round(areaAcres, 2)} acres starts above your stated budget. Confirm cash flow before choosing.`;
  }
  return { score, available: true, profitMin, profitMax, revenueMin, revenueMax, costMin, costMax, caution };
}

function marketScore(market: CropMarketSummary): { score: number; reason: string | null; caution: string | null } {
  if (!market.available) {
    return {
      score: 45,
      reason: null,
      caution: 'No current mandi price matched this crop. Market attractiveness was not scored; check a nearby mandi before deciding.',
    };
  }
  let score = 58 + Math.min(20, market.markets * 3);
  const spread = market.spreadPct ?? 0;
  if (spread > 60) score -= 18;
  else if (spread > 35) score -= 8;
  else score += 6;
  const freshnessDays = market.latestDate
    ? Math.floor((Date.now() - new Date(`${market.latestDate}T12:00:00`).getTime()) / 86400000)
    : 99;
  if (freshnessDays <= 1) score += 8;
  else if (freshnessDays <= 3) score += 3;
  else if (freshnessDays > 7) score -= 10;
  return {
    score: clamp(score, 0, 100),
    reason: `Current modal price ₹${market.modalPrice?.toLocaleString('en-IN')}/quintal from ${market.markets} market observation(s), dated ${market.latestDate ?? 'unknown'}.`,
    caution: spread > 35 ? 'Prices vary widely between markets; transport and quality discounts matter.' : null,
  };
}

function riskScore(
  crop: Crop,
  farm: Farm,
  market: CropMarketSummary,
  weather: WeatherData | null | undefined
): { score: number; risks: string[] } {
  let score = 86;
  const risks: string[] = [];
  const flags = cropRiskFlags(crop, farm);
  for (const flag of flags) {
    score -= flag.penalty;
    risks.push(flag.text);
  }
  if (market.spreadPct != null && market.spreadPct > 60) {
    score -= 7;
    risks.push('Wide price variation between markets.');
  }
  const hotDays = weather?.available
    ? weather.daily.filter((d) => crop.max_temp != null && d.tempMax > crop.max_temp).length
    : 0;
  if (hotDays >= 2) {
    score -= 6;
    risks.push(`${hotDays} forecast day(s) exceed this crop's reference maximum temperature.`);
  }
  const heavyRain = weather?.available ? weather.daily.filter((d) => d.rainfall >= 50).length : 0;
  if (heavyRain > 0) {
    score -= 4;
    risks.push('Heavy rain is forecast during the next 7 days; check drainage and spraying timing.');
  }
  if ((crop.major_pests?.length ?? 0) + (crop.major_diseases?.length ?? 0) >= 6) {
    score -= 4;
    risks.push('Several major pests/diseases require regular scouting.');
  }
  return { score: clamp(score, 20, 100), risks: [...new Set(risks)] };
}

function plantingWindowText(crop: Crop, season: Season): string {
  const w = crop.sowing_windows?.[season] ?? crop.sowing_windows?.annual;
  if (!w) return 'Confirm the local planting window with your KVK';
  return `${MONTH_NAMES[w.start - 1]} – ${MONTH_NAMES[w.end - 1]}`;
}

export interface RecommendationInput {
  crops: Crop[];
  farm: Farm;
  climate: ClimateData | null;
  marketRecords: MarketPrice[];
  weather: WeatherData | null;
  season: Season;
  now?: Date;
}

export function buildRecommendations(input: RecommendationInput): RecommendationResult {
  const { crops, farm, climate, marketRecords, weather } = input;
  const now = input.now ?? new Date();
  const season = input.season;
  const climateSummary = summariseClimate(climate, season);
  const forecastRain7d = weather?.available
    ? round(weather.daily.slice(0, 7).reduce((s, d) => s + d.rainfall, 0), 0)
    : null;
  const areaAcres = toAcres(farm.total_area, farm.area_unit);

  const missing: string[] = [];
  if (!farm.soil_type) missing.push('soil type');
  if (farm.soil_ph == null) missing.push('soil pH');
  if (climateSummary.annualRainfall == null) missing.push('historical rainfall');
  if (climateSummary.seasonalTemp == null) missing.push('historical temperature');
  if (!farm.irrigation_available) missing.push('irrigation availability (treated as rain-fed)');
  if (!farm.annual_budget) missing.push('farming budget');
  if (!marketRecords.length) missing.push('current market prices');

  const recommendations: Recommendation[] = crops
    .filter((c) => c.is_active)
    .map((crop) => {
      const market = summariseCropMarket(crop, marketRecords);
      const soil = soilMatchScore(crop, farm);
      const climateScore = round(
        0.55 * bandScore(climateSummary.annualRainfall, crop.optimal_rainfall_min, crop.optimal_rainfall_max, crop.min_rainfall, crop.max_rainfall) +
        0.45 * bandScore(climateSummary.seasonalTemp, crop.optimal_temp_min, crop.optimal_temp_max, crop.min_temp, crop.max_temp),
        0
      );
      const water = waterScore(crop, farm, forecastRain7d);
      const seasonResult = seasonScore(crop, season, now);
      const marketResult = marketScore(market);
      const econ = economicsScore(crop, areaAcres, farm.annual_budget, market);
      const risk = riskScore(crop, farm, market, weather);

      const components: { key: string; score: number; weight: number }[] = [
        { key: 'climate', score: climateSummary.annualRainfall != null ? climateScore : 55, weight: 0.24 },
        { key: 'soil', score: soil.score, weight: 0.16 },
        { key: 'water', score: water, weight: 0.16 },
        { key: 'season', score: seasonResult.score, weight: 0.12 },
        { key: 'market', score: marketResult.score, weight: market.available ? 0.12 : 0 },
        { key: 'economics', score: econ.score, weight: econ.available ? 0.12 : 0 },
        { key: 'risk', score: risk.score, weight: 0.08 },
      ];
      // Redistribute weight from unavailable dimensions to the agronomic core.
      const absent = components.filter((c) => c.weight === 0 || (c.key === 'climate' && climateSummary.annualRainfall == null));
      const redistribute = absent.reduce((s, c) => s + (c.key === 'climate' ? c.weight : c.weight), 0);
      const active = components.filter((c) => !absent.includes(c));
      const activeWeight = active.reduce((s, c) => s + c.weight, 0);
      const finalComponents = components.map((c) => {
        if (absent.includes(c)) return { ...c, weight: 0 };
        if (activeWeight <= 0) return c;
        return { ...c, weight: c.weight + (c.weight / activeWeight) * redistribute };
      });
      const totalWeight = finalComponents.reduce((s, c) => s + c.weight, 0) || 1;
      const overall = round(finalComponents.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight, 0);

      const presenceWeights: Record<string, number> = {
        soil: farm.soil_type ? 0.15 : 0,
        ph: farm.soil_ph != null ? 0.05 : 0,
        rainfall: climateSummary.annualRainfall != null ? 0.2 : 0,
        temperature: climateSummary.seasonalTemp != null ? 0.15 : 0,
        irrigation: farm.irrigation_available ? 0.1 : 0.03,
        market: market.available ? 0.2 : 0,
        budget: farm.annual_budget ? 0.15 : 0,
      };
      const confidence = round(Object.values(presenceWeights).reduce((s, n) => s + n, 0) * 100, 0);

      const reasons: string[] = [];
      if (climateSummary.annualRainfall != null) {
        const within = crop.optimal_rainfall_min != null && crop.optimal_rainfall_max != null
          && climateSummary.annualRainfall >= crop.optimal_rainfall_min
          && climateSummary.annualRainfall <= crop.optimal_rainfall_max;
        reasons.push(
          within
            ? `Historical annual rainfall (${Math.round(climateSummary.annualRainfall)} mm) is inside the reference range for this crop.`
            : `Rainfall fit is partial: historical annual rainfall is ${Math.round(climateSummary.annualRainfall)} mm against a reference range of ${crop.min_rainfall ?? '—'}–${crop.max_rainfall ?? '—'} mm.`
        );
      }
      if (soil.reason) reasons.push(soil.reason);
      if (water >= 80) reasons.push('Water availability matches this crop\'s requirement.');
      else if (water < 55) reasons.push('Water availability is below what this crop normally needs.');
      if (seasonResult.reason) reasons.push(seasonResult.reason);
      if (marketResult.reason) reasons.push(marketResult.reason);
      if (econ.available && econ.profitMin != null && econ.profitMax != null) {
        reasons.push(
          `Reference estimate for ${round(areaAcres, 2)} acres: profit range ₹${Math.round(econ.profitMin).toLocaleString('en-IN')} to ₹${Math.round(econ.profitMax).toLocaleString('en-IN')} using current modal prices and reference yield/cost ranges.`
        );
      }

      const cautions: string[] = [];
      if (seasonResult.caution) cautions.push(seasonResult.caution);
      if (marketResult.caution) cautions.push(marketResult.caution);
      if (econ.caution) cautions.push(econ.caution);
      if (soil.caution) cautions.push(soil.caution);
      if (water < 55) cautions.push('Confirm water availability before planting; the reference requirement is higher than your current water profile.');
      if (climateSummary.annualRainfall == null) cautions.push('Historical climate data is missing, so climate fit is less certain.');
      if (confidence < 60) cautions.push('Some farm details are missing. Complete them for a more reliable recommendation.');

      return {
        crop,
        rank: 0,
        score: {
          climate: climateSummary.annualRainfall != null ? climateScore : 55,
          soil: soil.score,
          water,
          season: seasonResult.score,
          market: marketResult.score,
          economics: econ.score,
          risk: risk.score,
          overall,
          confidence,
        },
        reasons: reasons.slice(0, 5),
        cautions: [...new Set(cautions)].slice(0, 5),
        economics: {
          available: econ.available,
          areaAcres: round(areaAcres, 2),
          costMin: Math.round(econ.costMin),
          costMax: Math.round(econ.costMax),
          yieldMin: crop.yield_min_per_acre ?? 0,
          yieldMax: crop.yield_max_per_acre ?? 0,
          priceUsed: market.modalPrice,
          priceLow: market.priceLow,
          priceHigh: market.priceHigh,
          revenueMin: econ.revenueMin != null ? Math.round(econ.revenueMin) : null,
          revenueMax: econ.revenueMax != null ? Math.round(econ.revenueMax) : null,
          profitMin: econ.profitMin != null ? Math.round(econ.profitMin) : null,
          profitMax: econ.profitMax != null ? Math.round(econ.profitMax) : null,
          priceObservationDate: market.latestDate,
          priceMarketCount: market.markets,
        },
        plantingWindow: plantingWindowText(crop, season),
        risks: risk.risks.slice(0, 5),
        market: {
          available: market.available,
          markets: market.markets,
          modalPrice: market.modalPrice,
          priceSpreadPct: market.spreadPct,
          commodityNames: market.matchedCommodities,
          latestDate: market.latestDate,
        },
      };
    });

  // Ranking: season-compatible crops first, then overall score. A crop out of
  // season can still appear in allCrops, but not as a top recommendation unless
  // there are fewer than five compatible crops.
  const seasonCompatible = recommendations.filter((r) => {
    const seasons = r.crop.seasons ?? [];
    return seasons.includes('annual') || seasons.includes(season);
  });
  const ranked = [...(seasonCompatible.length >= 5 ? seasonCompatible : recommendations)]
    .sort((a, b) => b.score.overall - a.score.overall || b.score.confidence - a.score.confidence);
  ranked.forEach((r, i) => { r.rank = i + 1; });

  const allSorted = [...recommendations].sort((a, b) => b.score.overall - a.score.overall);
  allSorted.forEach((r, i) => { r.rank = i + 1; });

  return {
    generatedAt: now.toISOString(),
    farmId: farm.id,
    season,
    inputs: {
      annualRainfallMm: climateSummary.annualRainfall,
      seasonalRainfallMm: climateSummary.seasonalRainfall,
      meanTempC: climateSummary.seasonalTemp,
      soilType: farm.soil_type,
      soilPh: farm.soil_ph,
      irrigationAvailable: farm.irrigation_available,
      waterSource: farm.water_source,
      areaAcres: round(areaAcres, 2),
      budget: farm.annual_budget,
      forecastRain7dMm: forecastRain7d,
      climateSource: climate?.source ?? 'NASA POWER',
      marketSource: 'data.gov.in / AGMARKNET',
      weatherSource: weather?.source ?? 'Open-Meteo',
      missing,
    },
    recommendations: ranked.slice(0, 5),
    allCrops: allSorted,
    confidenceNote: missing.length
      ? `Missing or assumed inputs: ${missing.join(', ')}. Scores use neutral values where data is missing and confidence is shown per crop.`
      : 'All key inputs are available. Scores combine real farm data, historical climate and current mandi observations.',
  };
}

export { MONTH_NAMES, SEASON_MONTHS };
