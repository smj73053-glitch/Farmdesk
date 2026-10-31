import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AuthError, isoDate, requireUser, safeNumber, serviceClient } from '../_shared/auth.ts';

const MAX_ROWS = 20000;
const CHUNK = 500;

interface IncomingRecord {
  commodity?: string;
  state?: string;
  district?: string;
  market_name?: string;
  variety?: string | null;
  min_price?: number | string | null;
  max_price?: number | string | null;
  modal_price?: number | string | null;
  arrival_date?: string;
  source_url?: string | null;
}

function clean(value: unknown, max = 200): string {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function obsKey(row: Record<string, unknown>): string {
  const n = (v: unknown) => clean(v).toLowerCase();
  return [n(row.commodity), n(row.state), n(row.district), n(row.market_name), n(row.variety), row.arrival_date].join('|');
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const fileName = clean(body.fileName ?? 'import.csv', 160);
    const incoming = Array.isArray(body.records) ? (body.records as IncomingRecord[]) : null;
    if (!incoming) return jsonResponse(req, { error: 'records must be an array' }, 400);
    if (incoming.length === 0) return jsonResponse(req, { error: 'No rows to import' }, 400);
    if (incoming.length > MAX_ROWS) {
      return jsonResponse(req, { error: `Import is limited to ${MAX_ROWS.toLocaleString()} rows per file. Split the file and retry.` }, 413);
    }

    const fetchedAt = new Date().toISOString();
    const errors: string[] = [];
    const rows: Record<string, unknown>[] = [];
    incoming.forEach((record, index) => {
      const commodity = clean(record.commodity);
      const market = clean(record.market_name);
      const arrival = isoDate(record.arrival_date);
      const modal = safeNumber(record.modal_price);
      if (!commodity || !market || !arrival) {
        if (errors.length < 20) errors.push(`Row ${index + 2}: commodity, market and arrival date are required.`);
        return;
      }
      if (modal == null || modal < 0) {
        if (errors.length < 20) errors.push(`Row ${index + 2}: a valid modal price is required.`);
        return;
      }
      const min = safeNumber(record.min_price);
      const max = safeNumber(record.max_price);
      if (min != null && max != null && min > max) {
        if (errors.length < 20) errors.push(`Row ${index + 2}: min price is greater than max price.`);
        return;
      }
      const base = {
        commodity,
        state: clean(record.state) || null,
        district: clean(record.district) || null,
        market_name: market,
        variety: clean(record.variety) || null,
        min_price: min,
        max_price: max,
        modal_price: modal,
        arrival_date: arrival,
        source: 'agmarknet-csv',
        source_url: clean(record.source_url) || null,
        fetched_at: fetchedAt,
      };
      rows.push({ ...base, obs_key: obsKey(base) });
    });

    let inserted = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { data, error } = await admin
        .from('market_prices')
        .upsert(chunk, { onConflict: 'obs_key', ignoreDuplicates: true })
        .select('id');
      if (error) {
        failed += chunk.length;
        if (errors.length < 20) errors.push(`Database rejected rows ${i + 1}–${i + chunk.length}: ${error.message}`);
      } else {
        inserted += data?.length ?? 0;
      }
    }

    const skipped = incoming.length - inserted - failed;
    const { error: auditError } = await admin.from('market_imports').insert({
      user_id: user.id,
      file_name: fileName,
      row_count: incoming.length,
      inserted_count: inserted,
      skipped_count: skipped + failed,
      source: 'agmarknet-csv',
      status: errors.length ? 'completed_with_errors' : 'completed',
      error_message: errors.length ? errors.slice(0, 10).join(' | ') : null,
    });
    if (auditError) console.warn('market import audit failed', auditError.message);

    return jsonResponse(req, {
      inserted,
      skipped: skipped + failed,
      failed,
      rows: incoming.length,
      errors,
      source: 'agmarknet-csv',
      message: inserted
        ? `${inserted.toLocaleString()} official observations saved; ${(skipped + failed).toLocaleString()} duplicate or invalid row(s) skipped.`
        : 'No new observations were inserted. Existing observations were not changed.',
    });
  } catch (error) {
    if (error instanceof AuthError) return jsonResponse(req, { error: error.message }, error.status);
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Import failed' }, 400);
  }
});
