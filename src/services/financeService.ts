import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/errors';
import type { Expense, IncomeRecord } from '@/types/models';

export interface FinanceFilters {
  farmId?: string;
  from?: string;
  to?: string;
  category?: string;
  cropId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface FinanceSummary {
  totalExpenses: number;
  totalIncome: number;
  net: number;
  byCategory: { category: string; amount: number; count: number }[];
  byMonth: { month: string; expenses: number; income: number }[];
  byCrop: { cropId: string | null; cropName: string; expenses: number; income: number }[];
  count: number;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export const expenseService = {
  async list(filters: FinanceFilters = {}): Promise<{ rows: Expense[]; count: number }> {
    const pageSize = filters.pageSize ?? 20;
    const page = filters.page ?? 0;
    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (filters.farmId) query = query.eq('farm_id', filters.farmId);
    if (filters.from) query = query.gte('expense_date', filters.from);
    if (filters.to) query = query.lte('expense_date', filters.to);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.cropId) query = query.eq('farm_crop_id', filters.cropId);
    if (filters.search) query = query.or(`description.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%`);
    const { data, error, count } = await query;
    throwIfError(error, 'Could not load expenses');
    return { rows: (data ?? []) as Expense[], count: count ?? 0 };
  },

  async listRange(farmId: string, from?: string, to?: string): Promise<Expense[]> {
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('farm_id', farmId)
      .order('expense_date', { ascending: false });
    if (from) query = query.gte('expense_date', from);
    if (to) query = query.lte('expense_date', to);
    const { data, error } = await query;
    throwIfError(error, 'Could not load expenses');
    return (data ?? []) as Expense[];
  },

  async create(input: Partial<Expense>): Promise<Expense> {
    const { data, error } = await supabase.from('expenses').insert(input).select('*').single();
    throwIfError(error, 'Could not save expense');
    return data as Expense;
  },

  async update(id: string, input: Partial<Expense>): Promise<Expense> {
    const { data, error } = await supabase.from('expenses').update(input).eq('id', id).select('*').single();
    throwIfError(error, 'Could not update expense');
    return data as Expense;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    throwIfError(error, 'Could not delete expense');
  },
};

export const incomeService = {
  async list(filters: FinanceFilters = {}): Promise<{ rows: IncomeRecord[]; count: number }> {
    const pageSize = filters.pageSize ?? 20;
    const page = filters.page ?? 0;
    let query = supabase
      .from('income_records')
      .select('*', { count: 'exact' })
      .order('income_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (filters.farmId) query = query.eq('farm_id', filters.farmId);
    if (filters.from) query = query.gte('income_date', filters.from);
    if (filters.to) query = query.lte('income_date', filters.to);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.cropId) query = query.eq('farm_crop_id', filters.cropId);
    if (filters.search) query = query.or(`description.ilike.%${filters.search}%,buyer.ilike.%${filters.search}%`);
    const { data, error, count } = await query;
    throwIfError(error, 'Could not load income records');
    return { rows: (data ?? []) as IncomeRecord[], count: count ?? 0 };
  },

  async listRange(farmId: string, from?: string, to?: string): Promise<IncomeRecord[]> {
    let query = supabase
      .from('income_records')
      .select('*')
      .eq('farm_id', farmId)
      .order('income_date', { ascending: false });
    if (from) query = query.gte('income_date', from);
    if (to) query = query.lte('income_date', to);
    const { data, error } = await query;
    throwIfError(error, 'Could not load income records');
    return (data ?? []) as IncomeRecord[];
  },

  async create(input: Partial<IncomeRecord>): Promise<IncomeRecord> {
    const { data, error } = await supabase.from('income_records').insert(input).select('*').single();
    throwIfError(error, 'Could not save income record');
    return data as IncomeRecord;
  },

  async update(id: string, input: Partial<IncomeRecord>): Promise<IncomeRecord> {
    const { data, error } = await supabase.from('income_records').update(input).eq('id', id).select('*').single();
    throwIfError(error, 'Could not update income record');
    return data as IncomeRecord;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('income_records').delete().eq('id', id);
    throwIfError(error, 'Could not delete income record');
  },
};

export function buildFinanceSummary(
  expenses: Expense[],
  income: IncomeRecord[],
  cropNames: Record<string, string> = {}
): FinanceSummary {
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);

  const catMap = new Map<string, { amount: number; count: number }>();
  for (const e of expenses) {
    const entry = catMap.get(e.category) ?? { amount: 0, count: 0 };
    entry.amount += Number(e.amount);
    entry.count += 1;
    catMap.set(e.category, entry);
  }

  const monthMap = new Map<string, { expenses: number; income: number }>();
  for (const e of expenses) {
    const k = monthKey(e.expense_date);
    const m = monthMap.get(k) ?? { expenses: 0, income: 0 };
    m.expenses += Number(e.amount);
    monthMap.set(k, m);
  }
  for (const i of income) {
    const k = monthKey(i.income_date);
    const m = monthMap.get(k) ?? { expenses: 0, income: 0 };
    m.income += Number(i.amount);
    monthMap.set(k, m);
  }

  const cropMap = new Map<string, { expenses: number; income: number }>();
  for (const e of expenses) {
    const k = e.farm_crop_id ?? '__unlinked';
    const c = cropMap.get(k) ?? { expenses: 0, income: 0 };
    c.expenses += Number(e.amount);
    cropMap.set(k, c);
  }
  for (const i of income) {
    const k = i.farm_crop_id ?? '__unlinked';
    const c = cropMap.get(k) ?? { expenses: 0, income: 0 };
    c.income += Number(i.amount);
    cropMap.set(k, c);
  }

  return {
    totalExpenses,
    totalIncome,
    net: totalIncome - totalExpenses,
    count: expenses.length,
    byCategory: [...catMap.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount),
    byMonth: [...monthMap.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    byCrop: [...cropMap.entries()]
      .map(([cropId, v]) => ({
        cropId: cropId === '__unlinked' ? null : cropId,
        cropName: cropNames[cropId] ?? (cropId === '__unlinked' ? 'Unlinked' : 'Crop'),
        ...v,
      }))
      .sort((a, b) => b.expenses - a.expenses),
  };
}
