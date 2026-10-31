import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileText,
  Filter,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFinanceSummary, useExpenses, monthsAgoStart, todayIso } from '@/hooks/useFinance';
import { useFarmCrops } from '@/hooks/useAgriculture';
import { useOfflineWrite, useOnlineStatus } from '@/hooks/useOffline';
import { expenseService } from '@/services/financeService';
import { EXPENSE_CATEGORIES, PAGE_SIZE } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { generateReportPdf } from '@/lib/pdf';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { signedFileUrl } from '@/lib/supabase';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock, Notice, OfflineState } from '@/components/common/states';
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Expense } from '@/types/models';

export function ExpensesPage() {
  const { t } = useTranslation();
  const { farms, farm, farmId } = useWorkspace();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const { write } = useOfflineWrite('expenses');

  const [from, setFrom] = React.useState(() => monthsAgoStart(6));
  const [to, setTo] = React.useState(() => todayIso());
  const [category, setCategory] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [dialog, setDialog] = React.useState<{ open: boolean; expense?: Expense | null }>({ open: false });
  const [deleting, setDeleting] = React.useState<Expense | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const filters = React.useMemo(() => ({
    farmId: farmId ?? undefined,
    from,
    to,
    category: category === 'all' ? undefined : category,
    search: search.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [farmId, from, to, category, search, page]);

  const expensesQuery = useExpenses(filters);
  const cropsQuery = useFarmCrops(farmId);
  const cropNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const crop of cropsQuery.data ?? []) {
      map[crop.id] = `${crop.crop?.name ?? 'Crop'}${crop.variety ? ` · ${crop.variety}` : ''}`;
    }
    return map;
  }, [cropsQuery.data]);

  const { summary } = useFinanceSummary(farmId, from, to, cropNames);

  React.useEffect(() => { setPage(0); }, [farmId, from, to, category, search]);

  const rows = expensesQuery.data?.rows ?? [];
  const count = expensesQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const categories = summary?.byCategory ?? [];
  const maxCategory = Math.max(1, ...categories.map((item) => item.amount));
  const monthData = summary?.byMonth ?? [];
  const topCategory = categories[0];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['finance'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };

  const deleteExpense = async () => {
    if (!deleting) return;
    try {
      const result = await write('delete', {}, deleting.id);
      await invalidate();
      toast.success(result.queued ? 'Delete saved offline and will sync later.' : 'Expense deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this expense.');
    }
  };

  const viewReceipt = async (expense: Expense) => {
    if (!expense.receipt_url) return;
    if (/^https?:\/\//i.test(expense.receipt_url)) {
      window.open(expense.receipt_url, '_blank', 'noopener,noreferrer');
      return;
    }
    const url = await signedFileUrl('receipts', expense.receipt_url);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.error('The receipt could not be opened. Check your connection and try again.');
  };

  const exportRows = async (): Promise<Expense[]> => {
    const result = await expenseService.list({ ...filters, page: 0, pageSize: 1000 });
    return result.rows;
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const data = await exportRows();
      downloadCsv(`farmdesk-expenses-${from}-to-${to}`, data, [
        { key: 'expense_date', label: 'Date' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount (INR)' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'description', label: 'Description' },
        { key: 'farm_crop_id', label: 'Crop', format: (row) => cropNames[row.farm_crop_id ?? ''] ?? '' },
        { key: 'payment_method', label: 'Payment method' },
        { key: 'notes', label: 'Notes' },
      ]);
      toast.success(`${data.length} expense${data.length === 1 ? '' : 's'} exported to CSV.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export expenses.');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const data = await exportRows();
      generateReportPdf({
        title: 'Farm expense statement',
        subtitle: `${farm?.name ?? 'Farm'} · ${from} to ${to}`,
        fileName: `farmdesk-expenses-${from}-to-${to}`,
        summary: [
          { label: 'Expenses', value: formatCurrency(summary?.totalExpenses ?? 0) },
          { label: 'Income', value: formatCurrency(summary?.totalIncome ?? 0) },
          { label: 'Net', value: formatCurrency(summary?.net ?? 0) },
          { label: 'Records', value: formatNumber(data.length) },
        ],
        sections: [
          {
            heading: 'Expense ledger',
            columns: ['Date', 'Category', 'Description / vendor', 'Crop', 'Payment', 'Amount (₹)'],
            rows: data.map((row) => [
              row.expense_date ?? '',
              row.category.replace(/_/g, ' '),
              [row.description, row.vendor].filter(Boolean).join(' · ') || '—',
              cropNames[row.farm_crop_id ?? ''] ?? '—',
              row.payment_method ?? '—',
              formatCurrency(Number(row.amount)),
            ]),
          },
          {
            heading: 'Category totals',
            columns: ['Category', 'Records', 'Amount (₹)'],
            rows: categories.map((item) => [
              item.category.replace(/_/g, ' '),
              item.count,
              formatCurrency(item.amount),
            ]),
          },
        ],
        notes: [
          'All figures are calculated from the expenses you recorded in FarmDesk for the selected dates.',
          'Expenses without a linked crop are not included in crop-wise profit calculations.',
        ],
      });
      toast.success('PDF generated from your recorded expenses.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate the PDF.');
    } finally {
      setExporting(false);
    }
  };

  if (!farms.length) {
    return (
      <div>
        <PageHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')} icon={Receipt} />
        <EmptyState
          icon={Receipt}
          title="Add a farm before recording expenses"
          description="Expenses are linked to a farm so that crop profit and reports stay accurate."
          action={<Button asChild><Link to="/farms"><Plus className="h-4 w-4" /> Add farm</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('expenses.title')}
        subtitle="Record every farm cost, link it to a crop, and see where the money actually goes. Totals come only from your entries."
        icon={Receipt}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting || !rows.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportPdf()} disabled={exporting || !rows.length}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" onClick={() => setDialog({ open: true, expense: null })}>
              <Plus className="h-3.5 w-3.5" /> Add expense
            </Button>
          </>
        }
      />

      {!online ? <OfflineState /> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Expenses in range" value={formatCurrency(summary?.totalExpenses ?? 0)} icon={ArrowDownRight} tone="red" hint={`${count} record${count === 1 ? '' : 's'} in the selected filters`} />
        <StatCard label="Income in range" value={formatCurrency(summary?.totalIncome ?? 0)} icon={ArrowUpRight} tone="green" hint="Recorded income for the same dates" />
        <StatCard label="Net position" value={formatCurrency(summary?.net ?? 0)} icon={Wallet} tone={(summary?.net ?? 0) >= 0 ? 'green' : 'red'} hint="Income minus expenses; not a profit guarantee" />
        <StatCard
          label="Largest category"
          value={topCategory ? topCategory.category.replace(/_/g, ' ') : '—'}
          icon={Receipt}
          tone="soil"
          hint={topCategory ? formatCurrency(topCategory.amount) : 'No expenses recorded in this range'}
        />
      </div>

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[145px] text-xs" aria-label="From date" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[145px] text-xs" aria-label="To date" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {EXPENSE_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description or vendor"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setFrom(monthsAgoStart(6)); setTo(todayIso()); setCategory('all'); setSearch(''); }}
            >
              Reset
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void expensesQuery.refetch()} disabled={expensesQuery.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${expensesQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardContent>
      </Card>

      {expensesQuery.error ? (
        <ErrorState message={(expensesQuery.error as Error).message} onRetry={() => void expensesQuery.refetch()} className="mt-4" />
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly cash flow</CardTitle>
            <CardDescription>Recorded expenses and income by month in the selected range</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesQuery.isLoading && !summary ? (
              <LoadingBlock rows={2} />
            ) : monthData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} labelFormatter={(label) => `Month ${label}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
                No expenses or income recorded between {from} and {to}. Add a record to see the chart.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Where the money went</CardTitle>
            <CardDescription>Expense category totals for the selected dates</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length ? (
              <div className="space-y-2.5">
                {categories.map((item) => (
                  <div key={item.category}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="capitalize">{item.category.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (item.amount / maxCategory) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No category totals yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Expense ledger</CardTitle>
            <CardDescription>
              {count ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, count)} of ${count}` : 'No expenses match these filters'}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, expense: null })}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          {expensesQuery.isLoading ? (
            <LoadingBlock rows={4} />
          ) : rows.length ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="hidden md:table-cell">Crop</TableHead>
                      <TableHead className="hidden sm:table-cell">Payment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap text-xs">{expense.expense_date ? formatDate(expense.expense_date) : '—'}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{expense.category.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate text-xs font-medium">{expense.description || 'No description'}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{expense.vendor || expense.notes || '—'}</p>
                        </TableCell>
                        <TableCell className="hidden max-w-[160px] truncate text-xs md:table-cell">{expense.farm_crop_id ? cropNames[expense.farm_crop_id] ?? 'Linked crop' : 'Unlinked'}</TableCell>
                        <TableCell className="hidden text-xs sm:table-cell">{expense.payment_method || '—'}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{formatCurrency(Number(expense.amount))}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5">
                            {expense.receipt_url ? (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="View receipt" onClick={() => void viewReceipt(expense)}>
                                <Receipt className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit expense" onClick={() => setDialog({ open: true, expense })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Delete expense" onClick={() => setDeleting(expense)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Page {page + 1} of {pageCount}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={Receipt}
              title={search || category !== 'all' ? 'No expenses match these filters' : 'No expenses recorded yet'}
              description={
                search || category !== 'all'
                  ? 'Clear the search or category filter, or widen the date range.'
                  : 'Record seeds, fertiliser, labour, machinery, transport and every other farm cost to see real crop profitability.'
              }
              action={<Button size="sm" onClick={() => setDialog({ open: true, expense: null })}><Plus className="h-3.5 w-3.5" /> Record first expense</Button>}
            />
          )}
        </CardContent>
      </Card>

      {summary && summary.byCrop.length ? (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Crop-wise spend</CardTitle>
            <CardDescription>Expenses linked to a crop in this date range. Unlinked costs cannot be attributed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {summary.byCrop.map((item) => (
                <div key={item.cropId ?? 'unlinked'} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                  <span className="truncate">{item.cropName}</span>
                  <span className="ml-2 shrink-0 font-semibold">{formatCurrency(item.expenses)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Notice tone="info" className="mt-4">
        FarmDesk totals are arithmetic on your recorded entries. They are not a tax document, and they do not include costs you have not entered. Keep receipts for insurance, loans and scheme applications.
      </Notice>

      <ExpenseFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, expense: open ? dialog.expense : null })}
        farms={farms}
        currentFarmId={farmId ?? farms[0]?.id ?? ''}
        expense={dialog.expense}
        onSaved={() => { void expensesQuery.refetch(); }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete this expense?"
        description={`${deleting ? formatCurrency(Number(deleting.amount)) : ''} ${deleting?.category?.replace(/_/g, ' ') ?? ''} will be removed from your ledger and crop profit. This cannot be undone.`}
        confirmLabel="Delete expense"
        destructive
        onConfirm={deleteExpense}
      />
    </div>
  );
}
