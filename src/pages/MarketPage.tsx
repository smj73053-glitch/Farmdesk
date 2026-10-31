import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowDownToLine,
  CalendarDays,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  History,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FarmGate } from '@/components/common/FarmGate';
import { PageHeader } from '@/components/common/PageHeader';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { CardSkeleton, EmptyState, ErrorState, Notice } from '@/components/common/states';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMarketHistory, useMarketSearch, useMarketSnapshot } from '@/hooks/useAgriculture';
import { marketService } from '@/services/agricultureDataService';
import { parseMarketCsv, downloadCsv } from '@/lib/csv';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Farm, MarketPrice } from '@/types/models';

const TOP_COMMODITIES = ['Onion', 'Tomato', 'Wheat', 'Rice', 'Soybean', 'Cotton', 'Sugarcane', 'Gram', 'Tur', 'Maize'];

export function MarketPage() {
  return <FarmGate>{(farm) => <MarketContent farm={farm} />}</FarmGate>;
}

interface SearchFilters {
  commodity: string;
  state: string;
  district: string;
  market: string;
}

function MarketContent({ farm }: { farm: Farm }) {
  const { t } = useTranslation();
  const saved = useMarketSnapshot(farm, 1000);
  const [filters, setFilters] = React.useState<SearchFilters>({
    commodity: '',
    state: farm.state ?? '',
    district: farm.district ?? '',
    market: '',
  });
  const [searchInput, setSearchInput] = React.useState<SearchFilters | null>(null);
  const [historyCommodity, setHistoryCommodity] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importSummary, setImportSummary] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const search = useMarketSearch(searchInput);

  const savedRows = saved.data ?? [];
  const commodities = React.useMemo(
    () => [...new Set(savedRows.map((row) => row.commodity))].sort((a, b) => a.localeCompare(b)),
    [savedRows]
  );
  const latestDate = React.useMemo(() => {
    const sorted = savedRows.map((row) => row.arrival_date).filter(Boolean).sort();
    return sorted.length ? sorted[sorted.length - 1] : null;
  }, [savedRows]);
  const markets = React.useMemo(() => new Set(savedRows.map((row) => row.market_name)).size, [savedRows]);

  React.useEffect(() => {
    if (!historyCommodity && commodities.length) setHistoryCommodity(commodities[0]);
  }, [commodities, historyCommodity]);

  const history = useMarketHistory(historyCommodity, undefined);

  const historyPoints = React.useMemo(() => {
    const rows = history.data ?? [];
    const grouped = new Map<string, number[]>();
    for (const row of rows) {
      if (row.modal_price == null) continue;
      const key = row.arrival_date;
      const list = grouped.get(key) ?? [];
      list.push(Number(row.modal_price));
      grouped.set(key, list);
    }
    return [...grouped.entries()]
      .map(([date, prices]) => ({
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        modal: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        min: Math.min(...prices),
        max: Math.max(...prices),
        observations: prices.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [history.data]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchInput({
      commodity: filters.commodity.trim(),
      state: filters.state.trim(),
      district: filters.district.trim(),
      market: filters.market.trim(),
    });
  };

  const exportSaved = () => {
    if (!savedRows.length) return;
    downloadCsv(
      `farmdesk-mandi-prices-${new Date().toISOString().slice(0, 10)}`,
      savedRows as unknown as Record<string, unknown>[],
      [
        { key: 'commodity', label: 'Commodity' },
        { key: 'variety', label: 'Variety' },
        { key: 'state', label: 'State' },
        { key: 'district', label: 'District' },
        { key: 'market_name', label: 'Market' },
        { key: 'min_price', label: 'Min price (₹/qtl)' },
        { key: 'max_price', label: 'Max price (₹/qtl)' },
        { key: 'modal_price', label: 'Modal price (₹/qtl)' },
        { key: 'arrival_date', label: 'Arrival date' },
        { key: 'source', label: 'Source' },
      ]
    );
    toast.success('Saved mandi observations exported as CSV.');
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('CSV is larger than 8 MB. Split the file before importing.');
      return;
    }
    setImporting(true);
    setImportSummary(null);
    try {
      const text = await file.text();
      const parsed = parseMarketCsv(text);
      if (!parsed.records.length) {
        toast.error(parsed.errors[0] ?? 'No valid rows were found in this CSV.');
        return;
      }
      const result = await marketService.importRows({ records: parsed.records, fileName: file.name });
      const summary = `${result.inserted.toLocaleString()} new observation(s) saved from ${result.rows.toLocaleString()} row(s); ${result.skipped.toLocaleString()} duplicate or invalid row(s) skipped.${result.errors?.length ? ` ${result.errors[0]}` : ''}`;
      setImportSummary(summary);
      toast.success('Official CSV processed.');
      await Promise.all([saved.refetch(), history.refetch()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import this CSV.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('market.title')}
        subtitle="Current and saved wholesale mandi observations. Prices are never estimated or fabricated when the official feed is unavailable."
        icon={TrendingUp}
        meta={
          <>
            <span>Relevant to {farm.name}</span>
            <span>· {farm.district ?? 'District not set'}, {farm.state ?? 'State not set'}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportSaved} disabled={!savedRows.length}>
              <ArrowDownToLine className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import AGMARKNET CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void onFile(event)} />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saved observations" value={saved.isLoading ? '—' : formatNumber(savedRows.length)} hint="Rows stored in your FarmDesk account" icon={Database} tone="sky" />
        <StatCard label="Commodities covered" value={saved.isLoading ? '—' : commodities.length} hint="From live searches and official CSV imports" icon={FileSpreadsheet} tone="green" />
        <StatCard label="Markets covered" value={saved.isLoading ? '—' : markets} hint="Distinct mandis in saved observations" icon={Store} tone="amber" />
        <StatCard
          label="Latest observation"
          value={latestDate ? formatDate(latestDate) : '—'}
          hint={latestDate ? 'Most recent arrival date in your records' : 'Search or import to build history'}
          icon={CalendarDays}
          tone="soil"
        />
      </div>

      <Tabs defaultValue="search" className="mt-5">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="search"><Search className="mr-1 h-3.5 w-3.5" /> Live search</TabsTrigger>
          <TabsTrigger value="saved"><Database className="mr-1 h-3.5 w-3.5" /> Saved observations</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1 h-3.5 w-3.5" /> Price history</TabsTrigger>
          <TabsTrigger value="import"><Upload className="mr-1 h-3.5 w-3.5" /> CSV import</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Search the official mandi feed</CardTitle>
              <CardDescription>
                data.gov.in / AGMARKNET daily market prices. Live rows are saved to your account automatically when they arrive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium" htmlFor="commodity">Commodity</label>
                  <Input id="commodity" list="commodity-options" value={filters.commodity} onChange={(e) => setFilters({ ...filters, commodity: e.target.value })} placeholder="e.g. Onion" />
                  <datalist id="commodity-options">
                    {[...new Set([...TOP_COMMODITIES, ...commodities])].map((item) => <option key={item} value={item} />)}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" htmlFor="state">State</label>
                  <Input id="state" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} placeholder="e.g. Maharashtra" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" htmlFor="district">District</label>
                  <Input id="district" value={filters.district} onChange={(e) => setFilters({ ...filters, district: e.target.value })} placeholder="Optional" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" htmlFor="market">Market</label>
                  <Input id="market" value={filters.market} onChange={(e) => setFilters({ ...filters, market: e.target.value })} placeholder="Optional" />
                </div>
                <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center gap-2">
                  <Button type="submit" size="sm" disabled={search.isFetching}>
                    {search.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    {search.isFetching ? 'Searching…' : 'Search official feed'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFilters({ commodity: '', state: '', district: '', market: '' });
                      setSearchInput(null);
                    }}
                  >
                    Clear
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void saved.refetch()}>
                    <RefreshCw className={`h-3.5 w-3.5 ${saved.isFetching ? 'animate-spin' : ''}`} /> Refresh saved
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="mt-4">
            {!searchInput ? (
              <EmptyState
                icon={Search}
                title="Search a commodity to fetch official prices"
                description="Choose a commodity and your state. If the public data key is rate-limited, FarmDesk shows saved observations and says so — it does not invent prices."
              />
            ) : search.isLoading ? (
              <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
            ) : search.error ? (
              <ErrorState
                title="Live feed unavailable"
                message={`${(search.error as Error).message} You can retry later, use your saved observations, or import an official CSV.`}
                onRetry={() => void search.refetch()}
              />
            ) : search.data ? (
              <>
                {!search.data.available ? (
                  <Notice tone="warning" title="No prices to show">
                    {search.data.message ?? 'The official feed returned no matching records.'}
                    {search.data.reason ? <span className="mt-1 block text-[11px] opacity-80">{search.data.reason}</span> : null}
                  </Notice>
                ) : (
                  <>
                    {search.data.stale || search.data.cached ? (
                      <Notice tone="warning" className="mb-3" title="Showing saved official observations">
                        {search.data.message ?? 'The live feed could not be reached.'}
                        {search.data.reason ? <span className="mt-1 block text-[11px] opacity-80">{search.data.reason}</span> : null}
                      </Notice>
                    ) : null}
                    <Card>
                      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                        <div>
                          <CardTitle className="text-base">{search.data.count} matching observation(s)</CardTitle>
                          <CardDescription>
                            {search.data.total > search.data.count ? `Showing ${search.data.count} of ${formatNumber(search.data.total)} total` : 'Complete result set'}
                          </CardDescription>
                        </div>
                        <Badge variant={search.data.stale ? 'warning' : 'success'}>{search.data.stale ? 'Saved snapshot' : 'Live'}</Badge>
                      </CardHeader>
                      <CardContent>
                        <MarketTable rows={search.data.records as unknown as MarketPrice[]} />
                        <DataSourceBadge
                          className="mt-3"
                          provider={search.data.source}
                          fetchedAt={search.data.fetchedAt}
                          sourceUrl={search.data.sourceUrl}
                          observationDate={search.data.observationDate}
                          cached={search.data.cached}
                          stale={search.data.stale}
                          note="Prices are ₹ per quintal. Verify grade and local mandi charges before selling."
                        />
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="saved" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Saved mandi observations</CardTitle>
                <CardDescription>Every row was retrieved from the official feed or imported from an official CSV.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportSaved} disabled={!savedRows.length}>
                <ArrowDownToLine className="h-3.5 w-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {saved.isLoading ? <CardSkeleton /> : saved.error ? (
                <ErrorState message={(saved.error as Error).message} onRetry={() => void saved.refetch()} />
              ) : savedRows.length ? (
                <>
                  <MarketTable rows={savedRows} />
                  <DataSourceBadge
                    className="mt-3"
                    provider="Your saved observations · data.gov.in / AGMARKNET"
                    fetchedAt={savedRows[0]?.fetched_at}
                    observationDate={latestDate}
                    note={`${savedRows.length} rows shown. Saved prices may not reflect today's market.`}
                  />
                </>
              ) : (
                <EmptyState
                  icon={Database}
                  title="No saved market observations yet"
                  description="Run a live search or import an official AGMARKNET CSV. Crop scores can then use market fit and price estimates."
                  action={<Button size="sm" onClick={() => fileRef.current?.click()}>Import CSV</Button>}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Recorded price history</CardTitle>
                <CardDescription>Average modal price per arrival date, built only from observed rows.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={historyCommodity ?? ''}
                  onChange={(event) => setHistoryCommodity(event.target.value || null)}
                >
                  {commodities.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <Button variant="ghost" size="sm" onClick={() => void history.refetch()} disabled={history.isFetching}>
                  <RefreshCw className={`h-3.5 w-3.5 ${history.isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!commodities.length ? (
                <EmptyState icon={TrendingUp} title="No price history yet" description="Save at least one observation to plot a trend. FarmDesk does not fabricate historical prices." />
              ) : history.isLoading ? <CardSkeleton /> : historyPoints.length ? (
                <>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyPoints} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" />
                        <YAxis tickLine={false} axisLine={false} fontSize={10} width={58} tickFormatter={(value) => `₹${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`} />
                        <Tooltip
                          formatter={(value: number, name: string) => [formatCurrency(value), name === 'modal' ? 'Average modal price' : name === 'min' ? 'Lowest modal' : 'Highest modal']}
                          labelFormatter={(label) => `Arrival ${label}`}
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        />
                        <Line type="monotone" dataKey="modal" name="Average modal" stroke="#15803d" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="min" name="Lowest" stroke="#0ea5e9" strokeWidth={1} strokeDasharray="4 3" dot={false} />
                        <Line type="monotone" dataKey="max" name="Highest" stroke="#d97706" strokeWidth={1} strokeDasharray="4 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <Notice tone="info" className="mt-3">
                    {historyPoints.length} observed arrival date(s) for {historyCommodity}. Gaps mean no saved observation for that date — they are not zero prices.
                  </Notice>
                </>
              ) : (
                <EmptyState icon={History} title="No observations in the last 180 days" description="Search the live feed or import a CSV covering this period." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import an official AGMARKNET export</CardTitle>
                <CardDescription>
                  Download the CSV from the official portal, then upload it here. Rows are validated and duplicate observations are skipped.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <FileSpreadsheet className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-2 text-sm font-medium">CSV with commodity, market, date and modal price</p>
                  <p className="mt-1 text-xs text-muted-foreground">Flexible headers: market/mandi, arrival_date/date, modal_price/modal. Maximum 20,000 rows, 8 MB.</p>
                  <Button className="mt-3" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {importing ? 'Importing…' : 'Choose CSV file'}
                  </Button>
                </div>
                {importSummary ? <Notice tone="success" title="Import processed">{importSummary}</Notice> : null}
                {saved.error ? <ErrorState message={(saved.error as Error).message} /> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where to get the file</CardTitle>
                <CardDescription>FarmDesk does not bundle or invent mandi data.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <a href="https://agmarknet.gov.in/PriceAndArrivals/DatewiseCommodityReport.aspx" target="_blank" rel="noreferrer noopener" className="flex items-start gap-2 rounded-lg border p-3 hover:bg-accent">
                  <ExternalLink className="mt-0.5 h-4 w-4 text-primary" />
                  <span><strong className="block">AGMARKNET daily price report</strong><span className="text-xs text-muted-foreground">Official Directorate of Marketing &amp; Inspection portal. Choose state, commodity and date.</span></span>
                </a>
                <a href="https://data.gov.in/resource/daily-market-prices-agricultural-commodities" target="_blank" rel="noreferrer noopener" className="flex items-start gap-2 rounded-lg border p-3 hover:bg-accent">
                  <ExternalLink className="mt-0.5 h-4 w-4 text-primary" />
                  <span><strong className="block">data.gov.in daily market prices</strong><span className="text-xs text-muted-foreground">Download CSV/JSON from the official Open Government Data platform.</span></span>
                </a>
                <Notice tone="warning" title="Import rules">
                  Only real official rows are accepted. Missing modal prices, dates or markets are rejected; duplicate commodity–market–date rows are skipped. Imports are recorded in an audit table.
                </Notice>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-4 rounded-xl border bg-card p-4 text-[11px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Price caveats:</strong> wholesale modal prices are indicative. Actual farm-gate realisation depends on grade, moisture, transport, commission and local demand. The public data.gov.in key can be rate-limited; use your own server-side key or CSV import for reliable access. FarmDesk never fills a missing price with an estimate.
      </div>
    </div>
  );
}

function MarketTable({ rows }: { rows: MarketPrice[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Commodity</TableHead>
            <TableHead>Market</TableHead>
            <TableHead className="hidden sm:table-cell">District</TableHead>
            <TableHead className="text-right">Min</TableHead>
            <TableHead className="text-right">Max</TableHead>
            <TableHead className="text-right">Modal</TableHead>
            <TableHead>Arrival</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 200).map((row, index) => (
            <TableRow key={`${row.commodity}-${row.market_name}-${row.arrival_date}-${index}`}>
              <TableCell>
                <span className="font-medium">{row.commodity}</span>
                {row.variety ? <span className="block text-[10px] text-muted-foreground">{row.variety}</span> : null}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1 text-xs"><MapPin className="h-3 w-3 text-muted-foreground" /> {row.market_name}</span>
                {row.state ? <span className="block text-[10px] text-muted-foreground">{row.state}</span> : null}
              </TableCell>
              <TableCell className="hidden text-xs sm:table-cell">{row.district || '—'}</TableCell>
              <TableCell className="text-right text-xs">{row.min_price != null ? formatCurrency(row.min_price) : '—'}</TableCell>
              <TableCell className="text-right text-xs">{row.max_price != null ? formatCurrency(row.max_price) : '—'}</TableCell>
              <TableCell className="text-right text-xs font-semibold">{row.modal_price != null ? formatCurrency(row.modal_price) : '—'}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">{formatDate(row.arrival_date)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 200 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Showing the first 200 rows. Export CSV to review all {formatNumber(rows.length)} rows.</p>
      ) : null}
    </div>
  );
}
