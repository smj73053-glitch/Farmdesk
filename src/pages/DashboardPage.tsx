import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CloudRain,
  Droplets,
  IndianRupee,
  Leaf,
  ListChecks,
  Plus,
  RefreshCw,
  Sprout,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wind,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { FarmGate } from '@/components/common/FarmGate';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataSourceBadge, SeverityBadge } from '@/components/common/DataSourceBadge';
import { CardSkeleton, EmptyState, ErrorState, Notice } from '@/components/common/states';
import { ScoreBar } from '@/components/common/ScoreBar';
import { WeatherGlyph } from '@/components/weather/WeatherGlyph';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRecommendations, useWeather } from '@/hooks/useAgriculture';
import { useFinanceSummary, monthsAgoStart, todayIso } from '@/hooks/useFinance';
import { useFarmCrops } from '@/hooks/useAgriculture';
import { useTasks } from '@/hooks/useFarmOps';
import { useMarketSnapshot } from '@/hooks/useAgriculture';
import { taskService } from '@/services/farmOpsService';
import { deriveWeatherAlerts, rainfallIntelligence, weatherLabel } from '@/lib/weather';
import { CROP_STAGES, SEASONS } from '@/lib/constants';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { formatArea, toAcres } from '@/lib/units';
import type { Farm, FarmCrop } from '@/types/models';

export function DashboardPage() {
  return <FarmGate>{(farm) => <DashboardContent farm={farm} />}</FarmGate>;
}

function DashboardContent({ farm }: { farm: Farm }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const from = React.useMemo(() => monthsAgoStart(6), []);
  const finance = useFinanceSummary(farm.id, from, todayIso());
  const cropsQuery = useFarmCrops(farm.id);
  const tasksQuery = useTasks(farm.id);
  const weatherQuery = useWeather(farm);
  const marketQuery = useMarketSnapshot(farm);
  const recommendations = useRecommendations(farm);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const activeCrops = (cropsQuery.data ?? []).filter((crop) => crop.status === 'active');
  const plantedAcres = activeCrops.reduce((sum, crop) => sum + toAcres(crop.area_planted, crop.area_unit), 0);
  const pendingTasks = (tasksQuery.data ?? [])
    .filter((task) => task.status === 'pending' || task.status === 'in_progress')
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  const alerts = deriveWeatherAlerts(weatherQuery.data?.daily ?? []);
  const rain = rainfallIntelligence(weatherQuery.data);
  const summary = finance.summary;

  const monthlyFinance = React.useMemo(() => {
    if (!summary) return [];
    const byMonth = new Map(summary.byMonth.map((row) => [row.month, row]));
    const rows: { label: string; expenses: number; income: number; net: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toISOString().slice(0, 7);
      const entry = byMonth.get(key);
      rows.push({
        label: date.toLocaleDateString('en-IN', { month: 'short' }),
        expenses: entry?.expenses ?? 0,
        income: entry?.income ?? 0,
        net: (entry?.income ?? 0) - (entry?.expenses ?? 0),
      });
    }
    return rows;
  }, [summary]);

  const latestMarket = React.useMemo(() => {
    const seen = new Set<string>();
    return [...(marketQuery.data ?? [])]
      .sort((a, b) => (b.arrival_date ?? '').localeCompare(a.arrival_date ?? ''))
      .filter((row) => {
        const key = row.commodity.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [marketQuery.data]);

  const completeTask = async (id: string, status: string) => {
    setCompleting(id);
    try {
      await taskService.update(id, { status: status === 'completed' ? 'pending' : 'completed' });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(status === 'completed' ? 'Task reopened.' : 'Task marked complete.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the task.');
    } finally {
      setCompleting(null);
    }
  };

  const firstName = profile?.full_name?.split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const latestWeather = weatherQuery.data?.current;
  const todayDaily = weatherQuery.data?.daily[0];

  return (
    <div>
      <PageHeader
        title={`${t('dashboard.welcome')}${firstName ? `, ${firstName}` : ''}`}
        subtitle={`${farm.name} · ${today}`}
        meta={
          <>
            <Badge variant="outline" className="gap-1 font-normal">
              <Sprout className="h-3 w-3" /> {SEASONS.find((s) => s.value === farm.farming_season)?.label ?? 'Season not set'}
            </Badge>
            {farm.total_area != null ? <span>{formatArea(farm.total_area, farm.area_unit)} total</span> : null}
            {farm.district ? <span>· {[farm.district, farm.state].filter(Boolean).join(', ')}</span> : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void recommendations.refresh()} disabled={recommendations.isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${recommendations.isLoading ? 'animate-spin' : ''}`} /> Refresh data
            </Button>
            <Button asChild size="sm">
              <Link to="/expenses"><Plus className="h-3.5 w-3.5" /> Add expense</Link>
            </Button>
          </>
        }
      />

      {recommendations.result?.inputs.missing.length ? (
        <Notice tone="warning" className="mb-4" title="Some inputs are missing">
          {recommendations.result.inputs.missing.join(', ')}. Scores use the available data and confidence is reduced — missing values are never filled with made-up numbers.
        </Notice>
      ) : null}

      {!farm.latitude || !farm.longitude ? (
        <Notice tone="warning" className="mb-4" title="Weather cannot load without coordinates">
          Add your farm latitude and longitude in <Link to="/farms" className="font-semibold underline">Farm Management</Link> to enable the forecast, climate history and crop scoring.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Net · last 6 months`}
          value={summary ? formatCurrency(summary.net) : '—'}
          hint={summary ? `${summary.count} expense entries recorded` : 'No financial entries yet'}
          icon={summary && summary.net >= 0 ? TrendingUp : TrendingDown}
          tone={summary && summary.net < 0 ? 'red' : 'green'}
        />
        <StatCard label="Expenses · last 6 months" value={summary ? formatCurrency(summary.totalExpenses) : '—'} hint="From your recorded expense entries" icon={Wallet} tone="amber" />
        <StatCard label="Income · last 6 months" value={summary ? formatCurrency(summary.totalIncome) : '—'} hint="Crop sales, subsidies and other income" icon={IndianRupee} tone="sky" />
        <StatCard
          label="Active crops"
          value={activeCrops.length}
          hint={plantedAcres > 0 ? `${formatNumber(plantedAcres, 2)} acres planted` : 'No active crop records'}
          icon={Leaf}
          tone="soil"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Weather &amp; rainfall</CardTitle>
              <CardDescription>7-day forecast at your farm coordinates</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/weather">Details <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {weatherQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
            ) : weatherQuery.error ? (
              <ErrorState message={(weatherQuery.error as Error).message} onRetry={() => void weatherQuery.refetch()} />
            ) : weatherQuery.data ? (
              <>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div className="rounded-xl border bg-gradient-to-br from-sky-50 to-emerald-50/40 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Right now</p>
                        <p className="mt-1 text-3xl font-bold">{Math.round(latestWeather!.temperature)}°C</p>
                        <p className="text-xs text-muted-foreground">Feels like {Math.round(latestWeather!.apparentTemperature)}°C</p>
                      </div>
                      <WeatherGlyph code={latestWeather!.weatherCode} className="h-9 w-9 text-sky-700" />
                    </div>
                    <p className="mt-2 text-sm font-medium">{weatherLabel(latestWeather!.weatherCode)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Droplets className="h-3.5 w-3.5" /> {Math.round(latestWeather!.humidity)}%</span>
                      <span className="inline-flex items-center gap-1"><Wind className="h-3.5 w-3.5" /> {Math.round(latestWeather!.windSpeed)} km/h</span>
                      <span className="inline-flex items-center gap-1"><CloudRain className="h-3.5 w-3.5" /> {Math.round(todayDaily?.rainProbability ?? 0)}% rain</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {todayDaily?.rainfall ?? 0} mm</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{rain?.headline ?? 'Forecast'}</p>
                    <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{rain?.detail}</p>
                    <div className="h-[130px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weatherQuery.data.daily.slice(0, 7).map((day) => ({
                          label: new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
                          rain: day.rainfall,
                          probability: day.rainProbability,
                        }))} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="rain-gradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                          <YAxis tickLine={false} axisLine={false} fontSize={10} width={34} />
                          <Tooltip
                            formatter={(value: number, name: string) => [name === 'rain' ? `${value} mm` : `${value}%`, name === 'rain' ? 'Rainfall' : 'Probability']}
                            contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          />
                          <Area type="monotone" dataKey="rain" stroke="#0284c7" strokeWidth={2} fill="url(#rain-gradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <DataSourceBadge
                  className="mt-3"
                  provider={weatherQuery.data.source}
                  fetchedAt={weatherQuery.data.fetchedAt}
                  stale={weatherQuery.data.stale}
                  cached={weatherQuery.data.cached}
                  sourceUrl={weatherQuery.data.providerUrl}
                  note="Forecast, not an official IMD warning."
                />
              </>
            ) : (
              <EmptyState icon={CloudRain} title="No weather data" description="Add farm coordinates to load a forecast." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Weather alerts</CardTitle>
            <CardDescription>Derived from forecast thresholds, not official warnings</CardDescription>
          </CardHeader>
          <CardContent>
            {weatherQuery.isLoading ? (
              <div className="space-y-2"><CardSkeleton /><CardSkeleton /></div>
            ) : alerts.length ? (
              <div className="space-y-2">
                {alerts.slice(0, 4).map((alert, index) => (
                  <div key={`${alert.type}-${alert.date}-${index}`} className="rounded-lg border p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold leading-snug">{alert.title}</p>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{alert.message}</p>
                  </div>
                ))}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/weather">View all forecast details</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                <p className="mt-2 text-sm font-medium">No threshold alerts in the 7-day forecast</p>
                <p className="mt-1 text-[11px] text-muted-foreground">FarmDesk checks rainfall, heat, cold and wind thresholds.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Expenses vs income</CardTitle>
              <CardDescription>Recorded entries over the last 6 months</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/reports">Reports <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          </CardHeader>
          <CardContent>
            {finance.isLoading ? (
              <CardSkeleton />
            ) : finance.error ? (
              <ErrorState message={finance.error.message} onRetry={() => void finance.refetch()} />
            ) : summary && (summary.totalExpenses > 0 || summary.totalIncome > 0) ? (
              <>
                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyFinance} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={10} width={52} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="expenses" name="Expenses" fill="#d97706" radius={[3, 3, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="income" name="Income" fill="#15803d" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-600" /> Expenses</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-700" /> Income</span>
                  <span>Net {summary.net >= 0 ? 'surplus' : 'deficit'}: <strong className={summary.net >= 0 ? 'text-emerald-700' : 'text-red-600'}>{formatCurrency(Math.abs(summary.net))}</strong></span>
                </div>
              </>
            ) : (
              <EmptyState
                icon={Wallet}
                title="No financial entries yet"
                description="Record an expense or income entry to see monthly totals. No sample figures are shown."
                action={<div className="flex gap-2"><Button asChild size="sm"><Link to="/expenses">Add expense</Link></Button><Button asChild size="sm" variant="outline"><Link to="/income">Add income</Link></Button></div>}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top crop matches</CardTitle>
            <CardDescription>Calculated from your farm inputs</CardDescription>
          </CardHeader>
          <CardContent>
            {recommendations.isLoading ? (
              <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
            ) : recommendations.result?.recommendations.length ? (
              <div className="space-y-3">
                {recommendations.result.recommendations.slice(0, 3).map((item) => (
                  <div key={item.crop.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{item.crop.name}</p>
                        <p className="text-[11px] text-muted-foreground">{item.crop.category} · {item.crop.growing_duration_days ?? '—'} days</p>
                      </div>
                      <Badge variant={item.score.overall >= 75 ? 'success' : item.score.overall >= 55 ? 'warning' : 'destructive'}>
                        {Math.round(item.score.overall)}/100
                      </Badge>
                    </div>
                    <ScoreBar className="mt-2" label="Confidence" value={item.score.confidence} description={undefined} />
                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{item.reasons[0] ?? 'See the full breakdown for reasons.'}</p>
                  </div>
                ))}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/crop-intelligence">See full crop analysis</Link>
                </Button>
              </div>
            ) : recommendations.error ? (
              <ErrorState message={(recommendations.error as Error).message} onRetry={() => void recommendations.refresh()} />
            ) : (
              <EmptyState icon={Sprout} title="Crop scores need a few inputs" description="Add soil, water and season details, and ensure coordinates are set." action={<Button asChild size="sm"><Link to="/crop-intelligence">Open Crop Intelligence</Link></Button>} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Active crops</CardTitle>
              <CardDescription>{activeCrops.length} in progress</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/crops">All crops</Link></Button>
          </CardHeader>
          <CardContent>
            {cropsQuery.isLoading ? <CardSkeleton /> : activeCrops.length ? (
              <div className="space-y-2.5">
                {activeCrops.slice(0, 4).map((crop) => <CropRow key={crop.id} crop={crop} />)}
              </div>
            ) : (
              <EmptyState icon={Leaf} title="No active crops" description="Add a crop to track stages, activities and harvest." action={<Button asChild size="sm"><Link to="/crops">Add crop</Link></Button>} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Upcoming tasks</CardTitle>
              <CardDescription>{pendingTasks.length} pending</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/crops">Manage</Link></Button>
          </CardHeader>
          <CardContent>
            {tasksQuery.isLoading ? <CardSkeleton /> : pendingTasks.length ? (
              <div className="space-y-2">
                {pendingTasks.slice(0, 5).map((task) => {
                  const overdue = task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date();
                  return (
                    <div key={task.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                      <button
                        type="button"
                        aria-label={`Complete ${task.title}`}
                        disabled={completing === task.id}
                        onClick={() => void completeTask(task.id, task.status)}
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 hover:border-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{task.title}</p>
                        <p className={`text-[10px] ${overdue ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                          {task.due_date ? `${overdue ? 'Overdue · ' : ''}${formatDate(task.due_date)}` : 'No due date'} · {task.priority} priority
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <ListChecks className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No pending tasks</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Add tasks from a crop's lifecycle page when needed.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Market observations</CardTitle>
              <CardDescription>Latest saved mandi rows</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/market">Market</Link></Button>
          </CardHeader>
          <CardContent>
            {marketQuery.isLoading ? <CardSkeleton /> : latestMarket.length ? (
              <div className="space-y-2">
                {latestMarket.map((row) => (
                  <div key={`${row.commodity}-${row.market_name}-${row.arrival_date}`} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{row.commodity}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{row.market_name} · {formatDate(row.arrival_date)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold">{formatCurrency(row.modal_price ?? 0)}<span className="font-normal text-muted-foreground">/qtl</span></span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={TrendingUp} title="No saved mandi prices" description="Search data.gov.in or import an official CSV to build your own price history." action={<Button asChild size="sm"><Link to="/market">Open Market</Link></Button>} />
            )}
            <DataSourceBadge className="mt-3" provider="Your saved observations" note="Prices are per quintal and may not match your local mandi today." />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">About these numbers:</strong> Weather is an Open-Meteo forecast, climate history is from NASA POWER, market rows are saved observations from data.gov.in/AGMARKNET or your imports, and crop scores are FarmDesk estimates calculated from your inputs. Nothing on this page is a guarantee of yield, price or weather.
        </p>
      </div>
    </div>
  );
}

function CropRow({ crop }: { crop: FarmCrop }) {
  const stage = CROP_STAGES.find((item) => item.value === crop.current_stage);
  const duration = crop.crop?.growing_duration_days ?? 120;
  const days = crop.sowing_date
    ? Math.max(0, Math.floor((Date.now() - new Date(`${crop.sowing_date}T12:00:00`).getTime()) / 86400000))
    : 0;
  const progress = Math.max(2, Math.min(100, (days / duration) * 100));
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{crop.crop?.name ?? 'Crop'}</p>
          <p className="text-[10px] text-muted-foreground">
            {stage?.label ?? crop.current_stage} · {crop.sowing_date ? `Day ${days}` : 'Sowing date not set'}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {formatArea(crop.area_planted, crop.area_unit)}
        </Badge>
      </div>
      <Progress value={progress} className="mt-2 h-1.5" />
    </div>
  );
}
