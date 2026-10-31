import type { AreaUnit } from '@/types/models';

export const ACRES_PER_HECTARE = 2.4710538147;
export const GUNTHA_PER_ACRE = 40;

/** Convert any supported area unit to acres. Returns 0 for invalid values. */
export function toAcres(value: number | null | undefined, unit: AreaUnit | string | null | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const v = Number(value);
  switch (unit) {
    case 'hectares':
      return v * ACRES_PER_HECTARE;
    case 'guntha':
      return v / GUNTHA_PER_ACRE;
    case 'acres':
    default:
      return v;
  }
}

export function fromAcres(acres: number, unit: AreaUnit | string): number {
  switch (unit) {
    case 'hectares':
      return acres / ACRES_PER_HECTARE;
    case 'guntha':
      return acres * GUNTHA_PER_ACRE;
    default:
      return acres;
  }
}

export function formatArea(value: number | null | undefined, unit: AreaUnit | string = 'acres'): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const decimals = n < 10 ? 2 : 1;
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: decimals }).format(n)} ${unit}`;
}

/** Localised area label for display. */
export function areaUnitLabel(unit: AreaUnit | string, t?: (key: string) => string): string {
  const key = unit === 'hectares' ? 'units.hectares' : unit === 'guntha' ? 'units.guntha' : 'units.acres';
  return t ? t(key) : unit;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** Score a value inside an optimal band with graceful penalty outside. */
export function bandScore(
  value: number | null,
  optimalMin: number | null,
  optimalMax: number | null,
  hardMin: number | null,
  hardMax: number | null
): number {
  if (value == null) return 55; // neutral, missing
  if (optimalMin != null && optimalMax != null && value >= optimalMin && value <= optimalMax) {
    return 100;
  }
  if (optimalMin != null && value < optimalMin) {
    const span = Math.max(1, optimalMin - (hardMin ?? optimalMin - 10));
    return clamp(100 - ((optimalMin - value) / span) * 55, 0, 100);
  }
  if (optimalMax != null && value > optimalMax) {
    const span = Math.max(1, (hardMax ?? optimalMax + 10) - optimalMax);
    return clamp(100 - ((value - optimalMax) / span) * 55, 0, 100);
  }
  return 55;
}

export function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
