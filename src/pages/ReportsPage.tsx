import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Download,
  FileBarChart,
  FileText,
  Receipt,
  Sprout,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFinanceRange, monthsAgoStart, todayIso } from '@/hooks/useFinance';
import { useFarmCrops } from '@/hooks/useAgriculture';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/constants';
import { buildFinanceSummary } from '@/services/financeService';
import { downloadCsv } from '@/lib/csv';
import { generateReportPdf } from '@/lib/pdf';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/common/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PIE_COLORS = ['#166534', '#22c55e', '#84cc16', '#eab308', '#f97316', '#0ea5e9', '#8b5cf6', '#ef4444', '#64748b', '#14b8a6', '#a16207'];

function categoryLabel(category: string): string {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.label
    ?? INCOME_CATEGORIES.find((item) => item.value === category)?.label
    ?? category.replace(/_/g, ' ');
}

export function ReportsPage() {
  const { t } = useTranslation();
  const { farm, farmId } = useWorkspace();
  const [from, setFrom] = React.useState(() => monthsAgoStart(12));
  const [to, setTo] = React.useState(() => todayIso());

  const finance = useFinanceRange(farmId, from, to);
  const cropsQuery = useFarmCrops(farmId);
  const crops = cropsQuery.data ?? [];

  const cropNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const crop of crops) {
      map[crop.id] = `${crop.crop?.name ?? 'Crop'}${crop.variety ? ` · ${crop.variety}` : ''}`;
    }
    return map;
  }, [crops]);

  const summary = React.useMemo(
    () => buildFinanceSummary(finance.expenses, finance.income, cropNames),
    [finance.expenses, finance.income, cropNames]
  );

  const margin = summary.totalIncome > 0 ? (summary.net / summary.totalIncome) * 100 : null;
  const monthly = summary.byMonth;
  const topCrops = summary.byCrop;
  const activeCrops = crops.filter((crop) => crop.status === 'active');

  const setPreset = (months: number) => {
    setFrom(monthsAgoStart(months));
    setTo(todayIso());
  };

  const exportCsv = () => {
    const rows = [
      ...finance.expenses.map((row) => ({
        date: row.expense_date,
        type: 'Expense',
        category: categoryLabel(row.category),
        description: row.description ?? '',
        crop: row.farm_crop_id ? cropNames[row.farm_crop_id] ?? '' : '',
        counterparty: row.vendor ?? '',
        amount: -Number(row.amount),
        notes: row.notes ?? '',
      })),
      ...finance.income.map((row) => ({
        date: row.income_date,
        type: 'Income',
        category: categoryLabel(row.category),
        description: row.description ?? '',
        crop: row.farm_crop_id ? cropNames[row.farm_crop_id] ?? '' : '',
        counterparty: row.buyer ?? '',
        amount: Number(row.amount),
        notes: row.notes ?? '',
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    downloadCsv(`farmdesk-report-${from}-to-${to}`, rows, [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type' },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'crop', label: 'Linked crop' },
      { key: 'counterparty', label: 'Vendor / buyer' },
      { key: 'amount', label: 'Amount (₹)' },
      { key: 'notes', label: 'Notes' },
    ]);
    toast.success(`${rows.length} ledger row${rows.length === 1 ? '' : 's'} exported.`);
  };

  const exportPdf = () => {
    generateReportPdf({
      title: 'Farm financial report',
      subtitle: `${farm?.name ?? 'Farm'} · ${from} to ${to}`,
      fileName: `farmdesk-report-${from}-to-${to}`,
      summary: [
        { label: 'Total expenses', value: formatCurrency(summary.totalExpenses) },
        { label: 'Total income', value: formatCurrency(summary.totalIncome) },
        { label: 'Net', value: formatCurrency(summary.net) },
        { label: 'Margin on income', value: margin != null ? `${formatNumber(margin, 1)}%` : '—' },
      ],
      sections: [
        {
          heading: 'Expenses by category',
          columns: ['Category', 'Records', 'Amount'],
          rows: summary.byCategory.map((row) => [categoryLabel(row.category), row.count, formatCurrency(row.amount)]),
        },
        {
          heading: 'Crop profitability (linked records only)',
          columns: ['Crop', 'Expenses', 'Income', 'Net'],
          rows: topCrops.map((row) => [row.cropName, formatCurrency(row.expenses), formatCurrency(row.income), formatCurrency(row.income - row.expenses)]),
        },
        {
          heading: 'Monthly cash flow',
          columns: ['Month', 'Expenses', 'Income', 'Net'],
          rows: monthly.map((row) => [row.month, formatCurrency(row.expenses), formatCurrency(row.income), formatCurrency(row.income - row.expenses)]),
        },
        {
          heading: 'Ledger',
          columns: ['Date', 'Type', 'Category', 'Description', 'Amount'],
          rows: [
            ...finance.expenses.map((row) => [row.expense_date, 'Expense', categoryLabel(row.category), row.description ?? '—', formatCurrency(-Number(row.amount))]),
            ...finance.income.map((row) => [row.income_date, 'Income', categoryLabel(row.category), row.description ?? '—', formatCurrency(Number(row.amount))]),
          ].sort((a, b) => String(b[0]).localeCompare(String(a[0]))),
        },
      ],
      notes: [
        'Only records you entered between the selected dates are included. Crop totals include only money explicitly linked to a crop.',
        'This report is a record of your own transactions. It is not an audited statement or a guarantee of future returns.',
      ],
    });
  };

  if (!farmId) {
    return (
      <div>
        <PageHeader title={t('nav.reports')} subtitle="Financial and crop reports from your own records" icon={FileBarChart} />
        <EmptyState
          icon={FileBarChart}
          title="Add a farm first"
          description="Reports are built from a farm's expenses, income and crop records."
          action={<Button asChild><Link to="/farms">Add farm</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('nav.reports')}
        subtitle="Profit and loss, category breakdown, monthly cash flow and crop-level returns from the records you entered."
        icon={FileBarChart}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!finance.expenses.length && !finance.income.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={!finance.expenses.length && !finance.income.length}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="report-from" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">From</label>
              <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 w-[150px]" />
            </div>
            <div>
              <label htmlFor="report-to" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">To</label>
              <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 w-[150px]" />
            </div>
            <div className="flex flex-wrap gap-1 pb-0.5">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setPreset(3)}>3 months</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setPreset(6)}>6 months</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setPreset(12)}>12 months</Button>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            {formatDate(from)} – {formatDate(to)}
          </span>
        </CardContent>
      </Card>

      {finance.error ? (
        <ErrorState className="mt-4" message={finance.error.message} onRetry={() => void finance.refetch()} />
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total expenses" value={formatCurrency(summary.totalExpenses)} icon={Receipt} tone="amber" hint={`${finance.expenses.length} expense record${finance.expenses.length === 1 ? '' : 's'}`} />
        <StatCard label="Total income" value={formatCurrency(summary.totalIncome)} icon={Wallet} tone="green" hint={`${finance.income.length} income record${finance.income.length === 1 ? '' : 's'}`} />
        <StatCard
          label="Net profit / loss"
          value={formatCurrency(summary.net)}
          icon={summary.net >= 0 ? ArrowUpRight : ArrowDownRight}
          tone={summary.net >= 0 ? 'green' : 'red'}
          hint="Income minus expenses for the selected dates"
        />
        <StatCard
          label="Margin on income"
          value={margin != null ? `${formatNumber(margin, 1)}%` : '—'}
          icon={TrendingUp}
          tone="sky"
          hint={margin == null ? 'Add income records to calculate a margin' : 'Net as a share of recorded income'}
        />
      </div>

      {!finance.isLoading && !finance.expenses.length && !finance.income.length ? (
        <Notice tone="info" title="No records in this period" className="mt-4">
          Add expenses and income, or widen the date range. FarmDesk does not estimate missing transactions.
        </Notice>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly cash flow</CardTitle>
            <CardDescription>Actual recorded expenses and income, grouped by month.</CardDescription>
          </CardHeader>
          <CardContent>
            {finance.isLoading ? (
              <LoadingBlock rows={2} />
            ) : monthly.length ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(value: string) => value.slice(2)} />
                    <YAxis tick={{ fontSize: 10 }} width={54} tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name === 'expenses' ? 'Expenses' : 'Income']}
                      labelFormatter={(label: string) => `Month ${label}`}
                    />
                    <Legend formatter={(value: string) => (value === 'expenses' ? 'Expenses' : 'Income')} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="expenses" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="income" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No monthly data in this period.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Expenses by category</CardTitle>
            <CardDescription>Where your recorded money went.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.byCategory.length ? (
              <>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summary.byCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={2}>
                        {summary.byCategory.map((entry, index) => (
                          <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1">
                  {summary.byCategory.slice(0, 6).map((row, index) => (
                    <li key={row.category} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span className="truncate">{categoryLabel(row.category)}</span>
                      </span>
                      <span className="shrink-0 font-medium">{formatCurrency(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No expenses recorded in this period.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Crop-level returns</CardTitle>
          <CardDescription>
            Only expenses and income linked to a crop appear here. Unlinked records are still in the totals above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topCrops.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Crop</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCrops.map((row) => {
                    const net = row.income - row.expenses;
                    const cropMargin = row.income > 0 ? (net / row.income) * 100 : null;
                    return (
                      <TableRow key={row.cropId ?? 'unlinked'}>
                        <TableCell className="text-xs font-medium">
                          {row.cropId ? <Link to={`/crops/${row.cropId}`} className="hover:text-primary hover:underline">{row.cropName}</Link> : row.cropName}
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(row.expenses)}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(row.income)}</TableCell>
                        <TableCell className={`text-right text-xs font-semibold ${net < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>{formatCurrency(net)}</TableCell>
                        <TableCell className="hidden text-right text-xs sm:table-cell">{cropMargin != null ? `${formatNumber(cropMargin, 1)}%` : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Sprout}
              title="No crop-linked money yet"
              description="Link expenses and income to a crop in the expense or income form to see returns per crop."
              action={<Button asChild size="sm"><Link to="/crops">Open crop lifecycle</Link></Button>}
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active crops</p>
            <p className="mt-1 text-xl font-bold">{activeCrops.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{crops.length} crop record{crops.length === 1 ? '' : 's'} on this farm</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top expense</p>
            <p className="mt-1 text-xl font-bold">{summary.byCategory[0] ? formatCurrency(summary.byCategory[0].amount) : '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.byCategory[0] ? categoryLabel(summary.byCategory[0].category) : 'No expenses recorded'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Records included</p>
            <p className="mt-1 text-xl font-bold">{summary.count + finance.income.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ledger rows between the selected dates</p>
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Reports reflect only the transactions you recorded. They are not an audited statement, and past results do not guarantee future returns.
      </p>
    </div>
  );
}
