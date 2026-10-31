import { describe, expect, it } from 'vitest';
import { parseMarketCsv, toCsv } from '@/lib/csv';

describe('toCsv', () => {
  it('writes a BOM, header and escaped rows', () => {
    const csv = toCsv(
      [{ name: 'Onion, red', amount: 1200, note: 'said "good"' }],
      [
        { key: 'name', label: 'Commodity' },
        { key: 'amount', label: 'Amount' },
        { key: 'note', label: 'Note' },
      ]
    );
    expect(csv.startsWith('\uFEFFCommodity,Amount,Note')).toBe(true);
    expect(csv).toContain('"Onion, red"');
    expect(csv).toContain('"said ""good"""');
  });

  it('supports computed columns and empty values', () => {
    const csv = toCsv([{ amount: 10 }], [
      { key: 'amount', label: 'Amount' },
      { key: 'amount', label: 'Doubled', format: (row) => row.amount * 2 },
      { key: 'missing', label: 'Missing' },
    ]);
    expect(csv).toContain('Amount,Doubled,Missing');
    expect(csv).toContain('10,20,');
  });
});

describe('parseMarketCsv', () => {
  it('parses an AGMARKNET-style export with alias headers', () => {
    const text = [
      'Commodity,State,District,Market,Grade,Date,Min Price,Max Price,Modal Price',
      'Onion,Maharashtra,Pune,Pune APMC,FAQ,2026-10-30,1800,2600,2200',
      'Tomato,Maharashtra,Nashik,Nashik,Local,30/10/2026,900,1400,1150',
    ].join('\n');

    const result = parseMarketCsv(text);
    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(2);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      commodity: 'Onion',
      state: 'Maharashtra',
      district: 'Pune',
      market_name: 'Pune APMC',
      variety: 'FAQ',
      arrival_date: '2026-10-30',
      min_price: 1800,
      max_price: 2600,
      modal_price: 2200,
    });
    expect(result.records[1].arrival_date).toBe('2026-10-30');
  });

  it('normalises headers with spaces and punctuation', () => {
    const text = [
      'Commodity Name,Market Name,Arrival Date,Modal Price',
      'Cotton,Amravati,2026-10-29,7100',
    ].join('\n');
    const result = parseMarketCsv(text);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].commodity).toBe('Cotton');
    expect(result.records[0].market_name).toBe('Amravati');
  });

  it('reports missing required fields rather than inventing values', () => {
    const text = [
      'Commodity,Market,Date,Modal Price',
      'Onion,,2026-10-30,2200',
      ',Pune,2026-10-30,2200',
      'Onion,Pune,2026-10-30,',
    ].join('\n');
    const result = parseMarketCsv(text);
    expect(result.records).toHaveLength(0);
    expect(result.errors.length).toBe(3);
    expect(result.errors[0]).toMatch(/commodity, market and date are required/i);
    expect(result.errors[2]).toMatch(/modal price is missing/i);
  });

  it('strips currency symbols and separators from prices', () => {
    const text = [
      'Commodity,Market,Date,Modal Price',
      'Onion,Pune,2026-10-30,"₹2,250"',
    ].join('\n');
    const result = parseMarketCsv(text);
    expect(result.records[0].modal_price).toBe(2250);
  });
});
