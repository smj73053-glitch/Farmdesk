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
  RefreshCw,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFinanceSummary, useIncomeRecords, monthsAgoStart, todayIso } from '@/hooks/useFinance';
import { useFarmCrops } from '@/hooks/useAgriculture';
import { useOfflineWrite, useOnlineStatus } from '@/hooks/useOffline';
import { incomeService } from '@/services/financeService';
import { INCOME_CATEGORIES, PAGE_SIZE } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { generateReportPdf } from '@/lib/pdf';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock, Notice, OfflineState } from '@/components/common/states';
import { IncomeFormDialog } from '@/components/income/IncomeFormDialog';
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
import type { IncomeRecord } from '@/types/models';

const PIE_COLORS = ['#16a34a', '#0ea5e9', '#eab308', '#f97316', '#8b5cf6', '#64748b'];

export function IncomePage() {
  const { t } = useTranslation();
  const { farms, farm, farmId } = useWorkspace();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const { write } = useOfflineWrite('income_records');

  const [from, setFrom] = React.useState(() => monthsAgoStart(6));
  const [to, setTo] = React.useState(() => todayIso());
  const [category, setCategory] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [dialog, setDialog] = React.useState<{ open: boolean; record?: IncomeRecord | null }>({ open: false });
  const [deleting, setDeleting] = React.useState<IncomeRecord | null>(null);
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

  const incomeQuery = useIncomeRecords(filters);
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

  const rows = incomeQuery.data?.rows ?? [];
  const count = incomeQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const monthData = summary?.byMonth ?? [];
  const byCrop = (summary?.byCrop ?? []).filter((item) => item.income > 0);
  const pieData = byCrop.map((item) => ({ name: item.cropName, value: item.income }));
  const avgSale = count ? (summary?.totalIncome ?? 0) / count : 0;
  const largestSale = rows.reduce((max, row) => Math.max(max, Number(row.amount)), 0);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['income'] }),
      queryClient.invalidateQueries({ queryKey: ['finance'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };

  const deleteRecord = async () => {
    if (!deleting) return;
    try {
      const result = await write('delete', {}, deleting.id);
      await invalidate();
      toast.success(result.queued ? 'Delete saved offline and will sync later.' : 'Income record deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this income record.');
    }
  };

  const exportRows = async (): Promise<IncomeRecord[]> => {
    const result = await incomeService.list({ ...filters, page: 0, pageSize: 1000 });
    return result.rows;
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const data = await exportRows();
      downloadCsv(`farmdesk-income-${from}-to-${to}`, data, [
        { key: 'income_date', label: 'Date' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount (INR)' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'unit', label: 'Unit' },
        { key: 'price_per_unit', label: 'Price per unit (INR)' },
        { key: 'buyer', label: 'Buyer' },
        { key: 'market_name', label: 'Mandi / market' },
        { key: 'description', label: 'Description' },
        { key: 'farm_crop_id', label: 'Crop', format: (row) => cropNames[row.farm_crop_id ?? ''] ?? '' },
        { key: 'notes', label: 'Notes' },
      ]);
      toast.success(`${data.length} income record${data.length === 1 ? '' : 's'} exported to CSV.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export income records.');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const data = await exportRows();
      generateReportPdf({
        title: 'Farm income statement',
        subtitle: `${farm?.name ?? 'Farm'} · ${from} to ${to}`,
        fileName: `farmdesk-income-${from}-to-${to}`,
        summary: [
          { label: 'Income', value: formatCurrency(summary?.totalIncome ?? 0) },
          { label: 'Expenses', value: formatCurrency(summary?.totalExpenses ?? 0) },
          { label: 'Net', value: formatCurrency(summary?.net ?? 0) },
          { label: 'Records', value: formatNumber(data.length) },
        ],
        sections: [
          {
            heading: 'Income ledger',
            columns: ['Date', 'Category', 'Buyer / market', 'Crop', 'Quantity', 'Amount (₹)'],
            rows: data.map((row) => [
              row.income_date ?? '',
              row.category.replace(/_/g, ' '),
              [row.buyer, row.market_name].filter(Boolean).join(' · ') || '—',
              cropNames[row.farm_crop_id ?? ''] ?? '—',
              row.quantity != null ? `${formatNumber(Number(row.quantity), 2)} ${row.unit ?? ''}` : '—',
              formatCurrency(Number(row.amount)),
            ]),
          },
          {
            heading: 'Crop-wise income',
            columns: ['Crop', 'Income (₹)', 'Expenses (₹)', 'Net (₹)'],
            rows: (summary?.byCrop ?? []).map((item) => [
              item.cropName,
              formatCurrency(item.income),
              formatCurrency(item.expenses),
              formatCurrency(item.income - item.expenses),
            ]),
          },
        ],
        notes: [
          'All figures are calculated from the income records you entered in FarmDesk for the selected dates.',
          'Income linked to no crop is shown as "Unlinked" and cannot be attributed to a crop.',
          'This is a record of entries, not audited accounts or proof of sale.',
        ],
      });
      toast.success('PDF generated from your recorded income.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate the PDF.');
    } finally {
      setExporting(false);
    }
  };

  if (!farms.length) {
    return (
      <div>
        <PageHeader title={t('income.title')} subtitle={t('income.subtitle')} icon={Wallet} />
        <EmptyState
          icon={Wallet}
          title="Add a farm before recording income"
          description="Income is linked to a farm so crop profitability and reports stay accurate."
          action={<Button asChild><Link to="/farms"><Plus className="h-4 w-4" /> Add farm</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('income.title')}
        subtitle="Record crop sales, subsidies and other farm income. Link a crop to see whether it actually paid back its cost."
        icon={Wallet}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting || !rows.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportPdf()} disabled={exporting || !rows.length}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" onClick={() => setDialog({ open: true, record: null })}>
              <Plus className="h-3.5 w-3.5" /> Add income
            </Button>
          </>
        }
      />

      {!online ? <OfflineState /> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Income in range" value={formatCurrency(summary?.totalIncome ?? 0)} icon={ArrowUpRight} tone="green" hint={`${count} record${count === 1 ? '' : 's'} in the selected filters`} />
        <StatCard label="Expenses in range" value={formatCurrency(summary?.totalExpenses ?? 0)} icon={ArrowDownRight} tone="red" hint="Recorded costs for the same dates" />
        <StatCard label="Net position" value={formatCurrency(summary?.net ?? 0)} icon={Wallet} tone={(summary?.net ?? 0) >= 0 ? 'green' : 'red'} hint="Income minus expenses; not a profit guarantee" />
        <StatCard label="Average record" value={formatCurrency(avgSale)} icon={ArrowUpRight} tone="sky" hint={largestSale ? `Largest on this page: ${formatCurrency(largestSale)}` : 'No records on this page'} />
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
                {INCOME_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyer, market or description" className="h-8 pl-8 text-xs" />
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFrom(monthsAgoStart(6)); setTo(todayIso()); setCategory('all'); setSearch(''); }}>
              Reset
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void incomeQuery.refetch()} disabled={incomeQuery.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${incomeQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardContent>
      </Card>

      {incomeQuery.error ? (
        <ErrorState message={(incomeQuery.error as Error).message} onRetry={() => void incomeQuery.refetch()} className="mt-4" />
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Income and expenses by month</CardTitle>
            <CardDescription>Only months with a recorded entry appear here</CardDescription>
          </CardHeader>
          <CardContent>
            {incomeQuery.isLoading && !summary ? (
              <LoadingBlock rows={2} />
            ) : monthData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} labelFormatter={(label) => `Month ${label}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
                No income or expenses recorded between {from} and {to}.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Income by crop</CardTitle>
            <CardDescription>Only income linked to a crop is attributed</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={78} innerRadius={42} paddingAngle={2}>
                    {pieData.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Link income records to a crop to see crop-wise income.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Income ledger</CardTitle>
            <CardDescription>
              {count ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, count)} of ${count}` : 'No income records match these filters'}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, record: null })}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          {incomeQuery.isLoading ? (
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
                      <TableHead className="hidden sm:table-cell">Quantity</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap text-xs">{record.income_date ? formatDate(record.income_date) : '—'}</TableCell>
                        <TableCell><Badge variant="success" className="capitalize">{record.category.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate text-xs font-medium">{record.description || 'No description'}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{[record.buyer, record.market_name].filter(Boolean).join(' · ') || '—'}</p>
                        </TableCell>
                        <TableCell className="hidden max-w-[160px] truncate text-xs md:table-cell">{record.farm_crop_id ? cropNames[record.farm_crop_id] ?? 'Linked crop' : 'Unlinked'}</TableCell>
                        <TableCell className="hidden text-xs sm:table-cell">
                          {record.quantity != null ? `${formatNumber(Number(record.quantity), 2)} ${record.unit ?? ''}` : '—'}
                          {record.price_per_unit != null ? <span className="block text-[10px] text-muted-foreground">@ {formatCurrency(Number(record.price_per_unit))}</span> : null}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-emerald-700">{formatCurrency(Number(record.amount))}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit income" onClick={() => setDialog({ open: true, record })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Delete income" onClick={() => setDeleting(record)}>
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
              icon={Wallet}
              title={search || category !== 'all' ? 'No income records match these filters' : 'No income recorded yet'}
              description={
                search || category !== 'all'
                  ? 'Clear the search or category filter, or widen the date range.'
                  : 'Record crop sales, subsidies and insurance receipts, then link them to crops to measure real returns.'
              }
              action={<Button size="sm" onClick={() => setDialog({ open: true, record: null })}><Plus className="h-3.5 w-3.5" /> Record first income</Button>}
            />
          )}
        </CardContent>
      </Card>

      {byCrop.length ? (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Crop return in this range</CardTitle>
            <CardDescription>Income minus recorded expenses for each linked crop. A negative number means costs are still higher.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {byCrop.map((item) => {
                const net = item.income - item.expenses;
                return (
                  <div key={item.cropId ?? 'unlinked'} className="rounded-lg border p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{item.cropName}</span>
                      <span className={net >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>{formatCurrency(net)}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Income {formatCurrency(item.income)} · Expenses {formatCurrency(item.expenses)}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Notice tone="info" className="mt-4">
        Income is recorded from your own entries. FarmDesk does not fetch your bank account or sale slips, and a positive net figure is not a guarantee of profit.
      </Notice>

      <IncomeFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, record: open ? dialog.record : null })}
        farms={farms}
        currentFarmId={farmId ?? farms[0]?.id ?? ''}
        record={dialog.record}
        onSaved={() => { void incomeQuery.refetch(); }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete this income record?"
        description={`${deleting ? formatCurrency(Number(deleting.amount)) : ''} will be removed from your ledger and crop return. This cannot be undone.`}
        confirmLabel="Delete record"
        destructive
        onConfirm={deleteRecord}
      />
    </div>
  );
}
