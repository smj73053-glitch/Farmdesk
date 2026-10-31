import { describe, expect, it } from 'vitest';
import {
  ACRES_PER_HECTARE,
  GUNTHA_PER_ACRE,
  bandScore,
  clamp,
  fromAcres,
  haversineKm,
  round,
  toAcres,
} from '@/lib/units';

describe('area unit conversion', () => {
  it('treats acres as the internal unit', () => {
    expect(toAcres(2.5, 'acres')).toBe(2.5);
  });

  it('converts hectares to acres using the standard factor', () => {
    expect(toAcres(1, 'hectares')).toBeCloseTo(ACRES_PER_HECTARE, 6);
    expect(fromAcres(ACRES_PER_HECTARE, 'hectares')).toBeCloseTo(1, 6);
  });

  it('converts guntha using 40 guntha per acre', () => {
    expect(GUNTHA_PER_ACRE).toBe(40);
    expect(toAcres(80, 'guntha')).toBe(2);
    expect(fromAcres(2, 'guntha')).toBe(80);
  });

  it('round-trips every supported unit', () => {
    for (const unit of ['acres', 'hectares', 'guntha'] as const) {
      expect(fromAcres(toAcres(7.25, unit), unit)).toBeCloseTo(7.25, 6);
    }
  });

  it('returns 0 for missing or invalid values instead of NaN', () => {
    expect(toAcres(null, 'acres')).toBe(0);
    expect(toAcres(undefined, 'hectares')).toBe(0);
    expect(toAcres(Number.NaN, 'guntha')).toBe(0);
  });
});

describe('scoring helpers', () => {
  it('clamps to the provided bounds', () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(105)).toBe(100);
    expect(clamp(50, 10, 60)).toBe(50);
  });

  it('scores values inside the optimal band at 100', () => {
    expect(bandScore(25, 20, 30, 10, 40)).toBe(100);
  });

  it('penalises values outside the optimal band without going negative', () => {
    const low = bandScore(12, 20, 30, 10, 40);
    const high = bandScore(38, 20, 30, 10, 40);
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(100);
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThan(100);
  });

  it('returns the neutral score for missing values', () => {
    expect(bandScore(null, 20, 30, 10, 40)).toBe(55);
  });

  it('rounds to requested decimals', () => {
    expect(round(12.3456, 2)).toBe(12.35);
    expect(round(12.5, 0)).toBe(13);
  });
});

describe('haversineKm', () => {
  it('returns zero for identical points', () => {
    expect(haversineKm(18.52, 73.85, 18.52, 73.85)).toBe(0);
  });

  it('is close to the known Pune–Mumbai distance', () => {
    const km = haversineKm(18.5204, 73.8567, 19.076, 72.8777);
    expect(km).toBeGreaterThan(115);
    expect(km).toBeLessThan(130);
  });
});
