import Papa from 'papaparse';
import type { MarketPrice } from '@/types/models';

export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  format?: (row: T) => string | number | null | undefined;
}

function escapeCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T extends object>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(c.format ? c.format(row) : (row as Record<string, unknown>)[c.key as string])).join(',')
  );
  return `\uFEFF${[header, ...body].join('\r\n')}`;
}

export function downloadCsv<T extends object>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[]
): void {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const HEADER_ALIASES: Record<string, string[]> = {
  commodity: ['commodity', 'commodity_name', 'crop'],
  state: ['state', 'state_name'],
  district: ['district', 'district_name'],
  market_name: ['market', 'market_name', 'mandi', 'mandi_name', 'apmc'],
  variety: ['variety', 'grade'],
  arrival_date: ['arrival_date', 'date', 'price_date', 'arrival'],
  min_price: ['min_price', 'minimum_price', 'min'],
  max_price: ['max_price', 'maximum_price', 'max'],
  modal_price: ['modal_price', 'modal', 'model_price'],
  arrivals: ['arrivals', 'arrival_qty', 'quantity'],
};

function resolveField(row: Record<string, string>, key: string): string | undefined {
  const aliases = HEADER_ALIASES[key] ?? [key];
  for (const alias of aliases) {
    if (row[alias] != null && row[alias] !== '') return row[alias];
  }
  return undefined;
}

function parseNumber(value: string | undefined): number | null {
  if (value == null || value === '' || value === '-') return null;
  const n = Number(String(value).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export interface MarketCsvParseResult {
  records: Omit<MarketPrice, 'id' | 'fetched_at' | 'source'>[];
  errors: string[];
  totalRows: number;
}

/**
 * Parse an official AGMARKNET/Data.gov.in CSV export. Header names are normalised
 * so both underscore and space-separated variants work. Never invents values.
 */
export function parseMarketCsv(fileText: string): MarketCsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(fileText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normaliseHeader,
  });

  const errors: string[] = [];
  if (parsed.errors.length) {
    parsed.errors.slice(0, 3).forEach((e) => errors.push(`Row ${e.row ?? '?'}: ${e.message}`));
  }

  const records: Omit<MarketPrice, 'id' | 'fetched_at' | 'source'>[] = [];
  parsed.data.forEach((row, index) => {
    const commodity = resolveField(row, 'commodity')?.trim();
    const market_name = resolveField(row, 'market_name')?.trim();
    const arrival_date = parseDate(resolveField(row, 'arrival_date'));
    const modal = parseNumber(resolveField(row, 'modal_price'));
    if (!commodity || !market_name || !arrival_date) {
      if (errors.length < 10) errors.push(`Row ${index + 2}: commodity, market and date are required`);
      return;
    }
    if (modal == null) {
      if (errors.length < 10) errors.push(`Row ${index + 2}: modal price is missing`);
      return;
    }
    records.push({
      commodity,
      state: resolveField(row, 'state')?.trim() ?? '',
      district: resolveField(row, 'district')?.trim() ?? '',
      market_name,
      variety: resolveField(row, 'variety')?.trim() ?? null,
      min_price: parseNumber(resolveField(row, 'min_price')),
      max_price: parseNumber(resolveField(row, 'max_price')),
      modal_price: modal,
      arrival_date,
      source_url: null,
    });
  });

  return { records, errors, totalRows: parsed.data.length };
}
