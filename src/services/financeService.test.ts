import { describe, expect, it } from 'vitest';
import { buildFinanceSummary } from '@/services/financeService';
import type { Expense, IncomeRecord } from '@/types/models';

function expense(partial: Partial<Expense> & Pick<Expense, 'id' | 'amount' | 'expense_date' | 'category'>): Expense {
  return {
    user_id: 'user-1',
    farm_id: 'farm-1',
    farm_crop_id: null,
    currency: 'INR',
    description: null,
    payment_method: null,
    receipt_url: null,
    vendor: null,
    notes: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...partial,
  };
}

function income(partial: Partial<IncomeRecord> & Pick<IncomeRecord, 'id' | 'amount' | 'income_date' | 'category'>): IncomeRecord {
  return {
    user_id: 'user-1',
    farm_id: 'farm-1',
    farm_crop_id: null,
    currency: 'INR',
    description: null,
    quantity: null,
    unit: null,
    price_per_unit: null,
    buyer: null,
    market_name: null,
    notes: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...partial,
  };
}

describe('buildFinanceSummary', () => {
  const expenses: Expense[] = [
    expense({ id: 'e1', amount: 12500, category: 'fertilizers', expense_date: '2026-10-02', farm_crop_id: 'crop-a' }),
    expense({ id: 'e2', amount: 8000, category: 'labour', expense_date: '2026-10-15', farm_crop_id: 'crop-a' }),
    expense({ id: 'e3', amount: 3000, category: 'seeds', expense_date: '2026-09-20', farm_crop_id: null }),
  ];
  const incomeRows: IncomeRecord[] = [
    income({ id: 'i1', amount: 40000, category: 'crop_sale', income_date: '2026-10-25', farm_crop_id: 'crop-a' }),
    income({ id: 'i2', amount: 5000, category: 'subsidy', income_date: '2026-09-15' }),
  ];

  it('totals income and expenses and computes net', () => {
    const summary = buildFinanceSummary(expenses, incomeRows);
    expect(summary.totalExpenses).toBe(23500);
    expect(summary.totalIncome).toBe(45000);
    expect(summary.net).toBe(21500);
    expect(summary.count).toBe(3);
  });

  it('groups expenses by category, largest first', () => {
    const summary = buildFinanceSummary(expenses, incomeRows);
    expect(summary.byCategory).toEqual([
      { category: 'fertilizers', amount: 12500, count: 1 },
      { category: 'labour', amount: 8000, count: 1 },
      { category: 'seeds', amount: 3000, count: 1 },
    ]);
  });

  it('groups cash flow by month in chronological order', () => {
    const summary = buildFinanceSummary(expenses, incomeRows);
    expect(summary.byMonth).toEqual([
      { month: '2026-09', expenses: 3000, income: 5000 },
      { month: '2026-10', expenses: 20500, income: 40000 },
    ]);
  });

  it('keeps unlinked money separate from crop-linked returns', () => {
    const summary = buildFinanceSummary(expenses, incomeRows, { 'crop-a': 'Onion · Bhima Super' });
    const linked = summary.byCrop.find((row) => row.cropId === 'crop-a');
    const unlinked = summary.byCrop.find((row) => row.cropId === null);
    expect(linked).toMatchObject({
      cropName: 'Onion · Bhima Super',
      expenses: 20500,
      income: 40000,
    });
    expect(unlinked).toMatchObject({ cropName: 'Unlinked', expenses: 3000, income: 5000 });
    expect(summary.byCrop.reduce((sum, row) => sum + row.expenses, 0)).toBe(summary.totalExpenses);
    expect(summary.byCrop.reduce((sum, row) => sum + row.income, 0)).toBe(summary.totalIncome);
  });

  it('handles an empty ledger without NaN values', () => {
    const summary = buildFinanceSummary([], []);
    expect(summary).toMatchObject({
      totalExpenses: 0,
      totalIncome: 0,
      net: 0,
      count: 0,
      byCategory: [],
      byMonth: [],
      byCrop: [],
    });
  });
});
