import type { Crop, Farm } from '@/types/models';
import { bandScore, round } from '@/lib/units';

export interface SoilMatch {
  score: number;
  reason: string | null;
  caution: string | null;
}

export interface RiskFlag {
  penalty: number;
  text: string;
}

function normalise(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(soil|type)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match the farmer's soil description against the crop's reference soil list. */
function soilTypeFit(crop: Crop, farm: Farm): { fit: number | null; matched: string | null } {
  if (!farm.soil_type) return { fit: null, matched: null };
  const soils = crop.suitable_soil_types ?? [];
  if (!soils.length) return { fit: null, matched: null };
  const farmSoil = normalise(farm.soil_type);
  if (!farmSoil) return { fit: null, matched: null };

  for (const soil of soils) {
    const candidate = normalise(soil);
    if (!candidate) continue;
    if (candidate === farmSoil) return { fit: 1, matched: soil };
    if (candidate.includes(farmSoil) || farmSoil.includes(candidate)) {
      return { fit: 0.8, matched: soil };
    }
  }

  // Common Indian soil synonyms used in the reference data.
  const synonyms: Record<string, string[]> = {
    'black cotton': ['black', 'regur', 'vertisol', 'clay'],
    black: ['black cotton', 'regur', 'vertisol'],
    loam: ['loamy', 'sandy loam', 'clay loam'],
    'sandy loam': ['loam', 'sandy'],
    'clay loam': ['loam', 'clay'],
    red: ['red soil', 'laterite'],
    laterite: ['red', 'red soil'],
    alluvial: ['loam', 'clay loam', 'sandy loam'],
    sandy: ['sandy loam'],
    clay: ['clay loam', 'black cotton'],
  };
  const farmAliases = synonyms[farmSoil] ?? [];
  for (const soil of soils) {
    const candidate = normalise(soil);
    if (farmAliases.some((a) => candidate === a || candidate.includes(a))) {
      return { fit: 0.55, matched: soil };
    }
  }
  return { fit: 0.15, matched: null };
}

/**
 * Soil suitability from the farm's recorded soil type and pH against the crop's
 * reference ranges. Missing farm data reduces confidence instead of inventing a fit.
 */
export function soilMatchScore(crop: Crop, farm: Farm): SoilMatch {
  const type = soilTypeFit(crop, farm);
  const pH = farm.soil_ph;
  const phScore = pH != null
    ? bandScore(pH, crop.min_ph, crop.max_ph, crop.min_ph != null ? Math.max(0, crop.min_ph - 1.5) : null, crop.max_ph != null ? crop.max_ph + 1.5 : null)
    : null;

  const parts: { score: number; weight: number }[] = [];
  if (type.fit != null) parts.push({ score: type.fit * 100, weight: 0.55 });
  if (phScore != null) parts.push({ score: phScore, weight: 0.45 });

  if (!parts.length) {
    return {
      score: 55,
      reason: null,
      caution: 'Add your soil type and pH for a soil-specific fit score; a neutral value is used for now.',
    };
  }

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score = round(parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight, 0);

  let reason: string | null = null;
  let caution: string | null = null;

  if (type.fit != null) {
    if (type.fit >= 0.8) {
      reason = `${farm.soil_type} soil is listed as suitable for ${crop.name}.`;
    } else if (type.fit >= 0.5) {
      reason = `${farm.soil_type} is broadly compatible with ${crop.name}; confirm with a soil test.`;
    } else {
      caution = `${crop.name} reference data lists ${crop.suitable_soil_types?.join(', ') || 'different soils'}, not ${farm.soil_type}. Yield may be lower without soil correction.`;
    }
  }

  if (pH != null && crop.min_ph != null && crop.max_ph != null) {
    if (pH < crop.min_ph) {
      caution = `Soil pH ${pH} is below the reference range ${crop.min_ph}–${crop.max_ph} for ${crop.name}.`;
    } else if (pH > crop.max_ph) {
      caution = `Soil pH ${pH} is above the reference range ${crop.min_ph}–${crop.max_ph} for ${crop.name}.`;
    } else if (!caution) {
      reason = reason ?? `Soil pH ${pH} is inside the reference range ${crop.min_ph}–${crop.max_ph} for ${crop.name}.`;
    }
  }

  if (!farm.soil_ph) {
    caution = caution ?? 'Soil pH is not recorded; the soil score relies on soil type alone.';
  }

  return { score, reason, caution };
}

/**
 * Farm-specific risk flags with explicit score penalties. These are planning
 * cautions derived from recorded farm data, not pest or disease diagnoses.
 */
export function cropRiskFlags(crop: Crop, farm: Farm): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const req = crop.water_requirement ?? 'medium';
  const irrigated = farm.irrigation_available && normalise(farm.water_source) !== 'rain fed only';
  const area = farm.total_area;

  if (req === 'high' && !irrigated) {
    flags.push({
      penalty: 14,
      text: `${crop.name} has a high water requirement and your farm is recorded as rain-fed. Assured irrigation is normally needed.`,
    });
  } else if (req === 'medium' && !irrigated) {
    flags.push({
      penalty: 7,
      text: `${crop.name} normally needs moderate irrigation; plan supplemental water for dry spells.`,
    });
  }

  if (farm.water_source === 'Rain-fed only' && req !== 'low') {
    flags.push({
      penalty: 5,
      text: 'Your water source is recorded as rain-fed only; yield is exposed to monsoon variability.',
    });
  }

  if (farm.soil_ph != null && crop.min_ph != null && crop.max_ph != null) {
    const distance = farm.soil_ph < crop.min_ph ? crop.min_ph - farm.soil_ph : farm.soil_ph > crop.max_ph ? farm.soil_ph - crop.max_ph : 0;
    if (distance > 0.8) {
      flags.push({
        penalty: Math.min(12, Math.round(distance * 6)),
        text: `Soil pH ${farm.soil_ph} is ${distance.toFixed(1)} outside this crop's reference range; correction may be needed.`,
      });
    }
  }

  if (farm.land_slope && /steep|moderate/i.test(farm.land_slope) && req !== 'low') {
    flags.push({
      penalty: farm.land_slope.toLowerCase() === 'steep' ? 8 : 4,
      text: `Land slope is recorded as ${farm.land_slope.toLowerCase()}; check erosion and water-logging before planting.`,
    });
  }

  if (farm.annual_budget != null && area != null && crop.cost_min_per_acre != null) {
    const referenceCost = crop.cost_min_per_acre * area;
    if (referenceCost > farm.annual_budget) {
      flags.push({
        penalty: 5,
        text: 'Reference cost for the whole farm area is above your stated annual budget.',
      });
    }
  }

  if ((crop.growing_duration_days ?? 0) >= 150) {
    flags.push({
      penalty: 3,
      text: `This is a long-duration crop (about ${crop.growing_duration_days} days); cash flow and labour must be planned for the full period.`,
    });
  }

  return flags;
}
