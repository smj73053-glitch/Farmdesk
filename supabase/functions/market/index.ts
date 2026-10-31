import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AuthError, isoDate, requireUser, safeNumber, serviceClient } from '../_shared/auth.ts';

const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const API_BASE = `https://api.data.gov.in/resource/${RESOURCE_ID}`;
const SOURCE_URL = `https://data.gov.in/resource/daily-market-prices-agricultural-commodities`;

interface ApiRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  arrival_date?: string;
  min_price?: string | number;
  max_price?: string | number;
  modal_price?: string | number;
}

interface MarketRow {
  commodity: string;
  state: string;
  district: string;
  market_name: string;
  variety: string | null;
  min_price: number | null;
  max_price: number | null;
  modal_price: number | null;
  arrival_date: string;
  source: string;
  source_url: string;
  fetched_at: string;
  obs_key: string;
}

function obsKey(row: Omit<MarketRow, 'obs_key'>): string {
  const n = (v: string | null | undefined) => (v ?? '').toLowerCase().trim();
  return [n(row.commodity), n(row.state), n(row.district), n(row.market_name), n(row.variety), row.arrival_date].join('|');
}

function mapRecord(record: ApiRecord, fetchedAt: string): MarketRow | null {
  const commodity = String(record.commodity ?? '').trim();
  const market = String(record.market ?? '').trim();
  const arrival = isoDate(record.arrival_date);
  if (!commodity || !market || !arrival) return null;
  const base = {
    commodity,
    state: String(record.state ?? '').trim(),
    district: String(record.district ?? '').trim(),
    market_name: market,
    variety: record.variety ? String(record.variety).trim() : null,
    min_price: safeNumber(record.min_price),
    max_price: safeNumber(record.max_price),
    modal_price: safeNumber(record.modal_price),
    arrival_date: arrival,
    source: 'data.gov.in / AGMARKNET',
    source_url: SOURCE_URL,
    fetched_at: fetchedAt,
  };
  return { ...base, obs_key: obsKey(base) };
}

async function fallback(
  req: Request,
  admin: ReturnType<typeof serviceClient>,
  filters: Record<string, string | null>,
  limit: number,
  reason: string,
  status = 200
) {
  let query = admin
    .from('market_prices')
    .select('*', { count: 'exact' })
    .order('arrival_date', { ascending: false })
    .limit(limit);
  if (filters.commodity) query = query.ilike('commodity', `%${filters.commodity}%`);
  if (filters.state) query = query.eq('state', filters.state);
  if (filters.district) query = query.eq('district', filters.district);
  if (filters.market) query = query.ilike('market_name', `%${filters.market}%`);
  const { data, error, count } = await query;

  if (error) {
    return jsonResponse(req, {
      available: false,
      records: [],
      total: 0,
      count: 0,
      source: 'data.gov.in / AGMARKNET',
      sourceUrl: SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      reason: `Live price service unavailable (${reason}) and the local snapshot could not be read.`,
      message: 'No market prices are shown rather than estimating them.',
    }, status);
  }

  const rows = (data ?? []) as MarketRow[];
  if (!rows.length) {
    return jsonResponse(req, {
      available: false,
      records: [],
      total: 0,
      count: 0,
      source: 'data.gov.in / AGMARKNET',
      sourceUrl: SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      reason,
      message: 'No saved observations match this search. Try another commodity or import an official AGMARKNET CSV export.',
    }, status);
  }

  return jsonResponse(req, {
    available: true,
    records: rows,
    total: count ?? rows.length,
    count: rows.length,
    source: 'data.gov.in / AGMARKNET (saved snapshot)',
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    observationDate: rows.map((r) => r.arrival_date).sort().at(-1) ?? null,
    cached: true,
    stale: true,
    reason,
    message: 'The live mandi feed could not be reached; these are previously retrieved official observations.',
  }, 200);
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);

  try {
    await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get('DATA_GOV_API_KEY');
    const limit = Math.min(100, Math.max(1, Math.round(Number(body.limit ?? 50)) || 50));
    const offset = Math.max(0, Math.round(Number(body.offset ?? 0)) || 0);
    const filters = {
      commodity: body.commodity ? String(body.commodity).trim() : null,
      state: body.state ? String(body.state).trim() : null,
      district: body.district ? String(body.district).trim() : null,
      market: body.market ? String(body.market).trim() : null,
    };
    const admin = serviceClient();

    if (!apiKey) {
      return fallback(req, admin, filters, limit, 'DATA_GOV_API_KEY is not configured on the server.', 200);
    }

    const url = new URL(API_BASE);
    url.searchParams.set('api-key', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    if (filters.commodity) url.searchParams.set('filters[commodity]', filters.commodity);
    if (filters.state) url.searchParams.set('filters[state]', filters.state);
    if (filters.district) url.searchParams.set('filters[district]', filters.district);
    if (filters.market) url.searchParams.set('filters[market]', filters.market);

    let res: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (error) {
      return fallback(
        req,
        admin,
        filters,
        limit,
        `live request failed: ${error instanceof Error ? error.message : 'network error'}`,
        200
      );
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      return fallback(
        req,
        admin,
        filters,
        limit,
        `data.gov.in rate limit reached${retryAfter ? ` (retry after ${retryAfter}s)` : ''}. Add or rotate your own DATA_GOV_API_KEY or use CSV import.`,
        200
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return fallback(
        req,
        admin,
        filters,
        limit,
        `data.gov.in returned ${res.status}. ${detail.slice(0, 120)}`.trim(),
        res.status >= 500 ? 200 : 502
      );
    }

    const json = (await res.json()) as { records?: ApiRecord[]; total?: number; count?: number };
    const fetchedAt = new Date().toISOString();
    const rows = (json.records ?? []).map((r) => mapRecord(r, fetchedAt)).filter((r): r is MarketRow => r != null);

    if (rows.length) {
      const { error } = await admin.from('market_prices').upsert(rows, {
        onConflict: 'obs_key',
        ignoreDuplicates: true,
      });
      if (error) console.warn('market snapshot persistence failed', error.message);
    }

    const observationDate = rows.map((r) => r.arrival_date).sort().at(-1) ?? null;
    return jsonResponse(req, {
      available: rows.length > 0,
      records: rows,
      total: json.total ?? rows.length,
      count: rows.length,
      source: 'data.gov.in / AGMARKNET',
      sourceUrl: SOURCE_URL,
      fetchedAt,
      observationDate,
      cached: false,
      stale: false,
      reason: rows.length ? undefined : 'The official feed returned no matching records for these filters.',
      message: rows.length ? undefined : 'No prices are shown rather than estimating them. Try a broader search or import an official CSV.',
    });
  } catch (error) {
    if (error instanceof AuthError) return jsonResponse(req, { error: error.message }, error.status);
    const message = error instanceof Error ? error.message : 'Market service failed';
    return jsonResponse(req, { available: false, records: [], reason: message, source: 'data.gov.in / AGMARKNET' }, 400);
  }
});
