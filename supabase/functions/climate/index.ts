import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AuthError, fetchWithTimeout, numberInRange, requireUser, serviceClient } from '../_shared/auth.ts';

const POWER = 'https://power.larc.nasa.gov/api/temporal/monthly/point';
const PARAMS = 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FILL = -999;

interface PowerResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
  header?: { title?: string };
}

function valid(value: number | undefined): number | null {
  return value == null || value <= FILL ? null : Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null;
}

/** NASA POWER monthly PRECTOTCORR is a mean daily rate (mm/day). Convert to monthly total. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildClimate(parameters: Record<string, Record<string, number>>, startYear: number, endYear: number) {
  const rainfall = parameters.PRECTOTCORR ?? {};
  const tempMean = parameters.T2M ?? {};
  const tempMax = parameters.T2M_MAX ?? {};
  const tempMin = parameters.T2M_MIN ?? {};
  const humidity = parameters.RH2M ?? {};
  const solar = parameters.ALLSKY_SFC_SW_DWN ?? {};

  const months: Array<Record<string, unknown>> = [];
  const annual: Array<Record<string, unknown>> = [];
  for (let year = startYear; year <= endYear; year++) {
    let yearRain = 0;
    let yearRainMonths = 0;
    const yearTemps: number[] = [];
    for (let month = 1; month <= 12; month++) {
      const key = `${year}${String(month).padStart(2, '0')}`;
      const rainRaw = valid(rainfall[key]);
      const rain = rainRaw == null ? null : Math.round(rainRaw * daysInMonth(year, month) * 10) / 10;
      const tmean = valid(tempMean[key]);
      const tmax = valid(tempMax[key]);
      const tmin = valid(tempMin[key]);
      if (rain == null && tmean == null) continue;
      months.push({
        month: key,
        year,
        monthNumber: month,
        monthName: MONTHS[month - 1],
        rainfall: rain ?? 0,
        tempMean: tmean,
        tempMax: tmax,
        tempMin: tmin,
        humidity: valid(humidity[key]),
        solarRadiation: valid(solar[key]),
      });
      if (rain != null) { yearRain += rain; yearRainMonths += 1; }
      if (tmean != null) yearTemps.push(tmean);
    }
    if (yearRainMonths === 12 || yearTemps.length === 12) {
      annual.push({
        year,
        rainfall: yearRainMonths === 12 ? Math.round(yearRain * 10) / 10 : null,
        tempMean: average(yearTemps),
      });
    }
  }

  const monthlyNormals = MONTHS.map((monthName, index) => {
    const monthNumber = index + 1;
    const rows = months.filter((m) => m.monthNumber === monthNumber);
    return {
      monthNumber,
      month: monthName,
      rainfall: average(rows.map((r) => Number(r.rainfall ?? 0))),
      tempMean: average(rows.map((r) => Number(r.tempMean)).filter(Number.isFinite)),
      tempMax: average(rows.map((r) => Number(r.tempMax)).filter(Number.isFinite)),
      tempMin: average(rows.map((r) => Number(r.tempMin)).filter(Number.isFinite)),
      years: rows.length,
    };
  });

  const seasonDefs = [
    { season: 'Kharif', months: [6, 7, 8, 9, 10] },
    { season: 'Rabi', months: [11, 12, 1, 2, 3] },
    { season: 'Zaid', months: [4, 5] },
  ];
  const seasons = seasonDefs.map((def) => {
    const rows = months.filter((m) => def.months.includes(Number(m.monthNumber)));
    const perYearRain = new Map<number, number>();
    for (const row of rows) {
      const year = Number(row.year);
      perYearRain.set(year, (perYearRain.get(year) ?? 0) + Number(row.rainfall ?? 0));
    }
    return {
      season: def.season,
      months: def.months.map((m) => MONTHS[m - 1]).join('–'),
      rainfall: average([...perYearRain.values()]),
      tempMean: average(rows.map((r) => Number(r.tempMean)).filter(Number.isFinite)),
      tempMax: average(rows.map((r) => Number(r.tempMax)).filter(Number.isFinite)),
      tempMin: average(rows.map((r) => Number(r.tempMin)).filter(Number.isFinite)),
    };
  });

  return {
    months,
    annual: annual.filter((a) => a.rainfall != null),
    monthlyNormals,
    seasons,
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
    const years = Math.min(20, Math.max(1, Math.round(Number(body.years ?? 5)) || 5));
    const endYear = new Date().getFullYear() - 1;
    const startYear = endYear - years + 1;
    const cacheKey = { latitude, longitude, start_year: startYear, end_year: endYear, source: 'nasa-power' };

    const admin = serviceClient();
    if (body.force !== true) {
      const { data: cached } = await admin
        .from('climate_cache')
        .select('data, fetched_at, expires_at')
        .match(cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (cached?.data) {
        return jsonResponse(req, {
          ...(cached.data as Record<string, unknown>),
          cached: true,
          fetchedAt: cached.fetched_at,
        });
      }
    }

    const url = new URL(POWER);
    url.searchParams.set('parameters', PARAMS);
    url.searchParams.set('community', 'AG');
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('start', String(startYear));
    url.searchParams.set('end', String(endYear));
    url.searchParams.set('format', 'JSON');

    const res = await fetchWithTimeout(url.toString(), {}, 25000, 1);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return jsonResponse(req, {
        available: false,
        reason: `NASA POWER returned ${res.status}. ${text.slice(0, 160)}`.trim(),
        source: 'NASA POWER',
      }, 502);
    }

    const json = (await res.json()) as PowerResponse;
    const parameters = json.properties?.parameter;
    if (!parameters || !parameters.T2M) {
      return jsonResponse(req, {
        available: false,
        reason: 'NASA POWER did not return temperature data for this location.',
        source: 'NASA POWER',
      }, 502);
    }

    const built = buildClimate(parameters, startYear, endYear);
    const fetchedAt = new Date().toISOString();
    const payload = {
      available: true,
      ...built,
      latitude,
      longitude,
      source: 'NASA POWER (MERRA-2)',
      providerUrl: 'https://power.larc.nasa.gov/',
      fetchedAt,
      cached: false,
      gridResolution: '0.5° × 0.625°',
      startYear,
      endYear,
      note: 'Monthly historical values are gridded reanalysis data, not on-farm measurements.',
    };

    const { error: cacheError } = await admin.from('climate_cache').upsert({
      ...cacheKey,
      data: payload,
      fetched_at: fetchedAt,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }, { onConflict: 'latitude,longitude,start_year,end_year,source' });
    if (cacheError) console.error('climate cache write failed', cacheError.message);

    return jsonResponse(req, payload);
  } catch (error) {
    if (error instanceof AuthError) return jsonResponse(req, { error: error.message }, error.status);
    return jsonResponse(req, {
      available: false,
      reason: error instanceof Error ? error.message : 'Climate service failed',
      source: 'NASA POWER',
    }, 400);
  }
});
