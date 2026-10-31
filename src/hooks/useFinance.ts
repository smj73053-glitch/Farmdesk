import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  buildFinanceSummary,
  expenseService,
  incomeService,
  type FinanceFilters,
  type FinanceSummary,
} from '@/services/financeService';
import type { Expense, IncomeRecord } from '@/types/models';

export function useExpenses(filters: FinanceFilters) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => expenseService.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useIncomeRecords(filters: FinanceFilters) {
  return useQuery({
    queryKey: ['income', filters],
    queryFn: () => incomeService.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useFinanceRange(farmId: string | null, from?: string, to?: string) {
  const expenses = useQuery({
    queryKey: ['finance', 'expenses', farmId, from, to],
    queryFn: () => expenseService.listRange(farmId!, from, to),
    enabled: Boolean(farmId),
    staleTime: 30 * 1000,
  });
  const income = useQuery({
    queryKey: ['finance', 'income', farmId, from, to],
    queryFn: () => incomeService.listRange(farmId!, from, to),
    enabled: Boolean(farmId),
    staleTime: 30 * 1000,
  });

  return {
    expenses: expenses.data ?? [],
    income: income.data ?? [],
    isLoading: expenses.isLoading || income.isLoading,
    error: (expenses.error ?? income.error) as Error | null,
    refetch: async () => {
      await Promise.all([expenses.refetch(), income.refetch()]);
    },
  };
}

export function useFinanceSummary(
  farmId: string | null,
  from?: string,
  to?: string,
  cropNames: Record<string, string> = {}
): {
  summary: FinanceSummary | null;
  expenses: Expense[];
  income: IncomeRecord[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const range = useFinanceRange(farmId, from, to);
  const summary = React.useMemo(() => {
    if (!farmId) return null;
    return buildFinanceSummary(range.expenses, range.income, cropNames);
  }, [farmId, range.expenses, range.income, cropNames]);

  return { summary, ...range };
}

/** First day of the month N-1 months ago, as YYYY-MM-DD. */
export function monthsAgoStart(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}
