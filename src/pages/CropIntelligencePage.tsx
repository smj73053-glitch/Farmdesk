import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Droplets,
  FlaskConical,
  IndianRupee,
  Leaf,
  RefreshCw,
  Search,
  Sprout,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import { FarmGate } from '@/components/common/FarmGate';
import { PageHeader } from '@/components/common/PageHeader';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { EmptyState, ErrorState, Notice, CardSkeleton } from '@/components/common/states';
import { ScoreBar, scoreTone } from '@/components/common/ScoreBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRecommendations } from '@/hooks/useAgriculture';
import { seasonLabel } from '@/services/recommendationEngine';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { formatArea } from '@/lib/units';
import { SEASONS, APP_DISCLAIMER } from '@/lib/constants';
import type { Farm, Recommendation, RecommendationResult, Season } from '@/types/models';

export function CropIntelligencePage() {
  return <FarmGate>{(farm) => <CropIntelligenceContent farm={farm} />}</FarmGate>;
}

function CropIntelligenceContent({ farm }: { farm: Farm }) {
  const { t } = useTranslation();
  const [season, setSeason] = React.useState<Season>(farm.farming_season ?? 'kharif');
  const [selected, setSelected] = React.useState<Recommendation | null>(null);
  const [search, setSearch] = React.useState('');
  const recommendations = useRecommendations(farm, season);
  const result = recommendations.result;

  const filtered = React.useMemo(() => {
    const all = result?.allCrops ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) =>
      `${item.crop.name} ${item.crop.name_mr ?? ''} ${item.crop.category}`.toLowerCase().includes(q)
    );
  }, [result?.allCrops, search]);

  return (
    <div>
      <PageHeader
        title={t('crops.title')}
        subtitle="Suitability scores calculated from your farm inputs, NASA POWER climate history, the Open-Meteo forecast and saved mandi observations."
        icon={Sprout}
        meta={
          <>
            <span>{farm.name}</span>
            <span>· {formatArea(farm.total_area, farm.area_unit)}</span>
            {farm.soil_type ? <span>· {farm.soil_type} soil</span> : null}
            {farm.irrigation_available ? <span>· irrigated</span> : <span>· rain-fed</span>}
          </>
        }
        actions={
          <>
            <Select value={season} onValueChange={(value) => setSeason(value as Season)}>
              <SelectTrigger className="h-9 w-[170px] bg-background text-xs">
                <CalendarRange className="mr-1 h-3.5 w-3.5 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void recommendations.refresh()} disabled={recommendations.isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${recommendations.isLoading ? 'animate-spin' : ''}`} /> Refresh inputs
            </Button>
          </>
        }
      />

      {result?.inputs.missing.length ? (
        <Notice tone="warning" className="mb-4" title="Score confidence is reduced">
          Missing or assumed inputs: {result.inputs.missing.join(', ')}. Neutral values are used where data is unavailable; nothing is invented.
          <Link to="/farms" className="ml-1 font-semibold underline">Complete farm details</Link>
        </Notice>
      ) : null}

      {!farm.latitude || !farm.longitude ? (
        <Notice tone="warning" className="mb-4" title="Climate scoring needs farm coordinates">
          Add latitude and longitude in <Link to="/farms" className="font-semibold underline">Farm Management</Link>. Without them, climate fit uses a neutral score and confidence is lower.
        </Notice>
      ) : null}

      {recommendations.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : recommendations.error ? (
        <ErrorState message={(recommendations.error as Error).message} onRetry={() => void recommendations.refresh()} />
      ) : !result || !result.allCrops.length ? (
        <EmptyState
          icon={Sprout}
          title="Crop reference data could not be scored"
          description="Add farm details, coordinates and at least one crop reference record, then try again."
          action={<Button asChild><Link to="/farms">Open Farm Management</Link></Button>}
        />
      ) : (
        <>
          <InputSummary result={result} farm={farm} />

          <Tabs defaultValue="top" className="mt-5">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="top">Top recommendations</TabsTrigger>
              <TabsTrigger value="all">All crops ({result.allCrops.length})</TabsTrigger>
              <TabsTrigger value="method">How scores work</TabsTrigger>
            </TabsList>

            <TabsContent value="top" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {result.recommendations.map((item, index) => (
                  <RecommendationCard
                    key={item.crop.id}
                    item={item}
                    featured={index === 0}
                    onOpen={() => setSelected(item)}
                  />
                ))}
              </div>
              {result.recommendations.length === 0 ? (
                <EmptyState icon={Leaf} title="No season-compatible crop matched" description="Try another season or review your farm inputs." />
              ) : null}
            </TabsContent>

            <TabsContent value="all" className="mt-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search crops…" className="pl-8" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sorted by overall score · {seasonLabel(season)} view
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((item) => (
                  <button
                    key={item.crop.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.crop.name}</p>
                        <p className="truncate text-[11px] capitalize text-muted-foreground">{item.crop.category} · {item.crop.growing_duration_days ?? '—'} days</p>
                      </div>
                      <Badge variant={item.score.overall >= 75 ? 'success' : item.score.overall >= 55 ? 'warning' : 'destructive'}>
                        {Math.round(item.score.overall)}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <span>Climate {Math.round(item.score.climate)}</span>
                      <span>Soil {Math.round(item.score.soil)}</span>
                      <span>Water {Math.round(item.score.water)}</span>
                      <span>Market {item.market.available ? Math.round(item.score.market) : 'n/a'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Confidence {Math.round(item.score.confidence)}%</span>
                      {item.market.modalPrice != null ? (
                        <span className="font-semibold">{formatCurrency(item.market.modalPrice)}/qtl</span>
                      ) : (
                        <span className="text-muted-foreground">No saved price</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {filtered.length === 0 ? <EmptyState title="No crop matches this search" description="Try a different crop or category name." /> : null}
            </TabsContent>

            <TabsContent value="method" className="mt-4">
              <MethodPanel result={result} />
            </TabsContent>
          </Tabs>

          <div className="mt-4 rounded-xl border bg-card p-4">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">What this is:</strong> a ranked planning aid, not a guarantee. Scores combine reference agronomy in the FarmDesk crop library with your saved farm data, NASA POWER climate history, the current Open-Meteo forecast and saved mandi prices. Market and profit estimates never outweigh the agronomic core. Confirm variety, seed rate and input doses with your KVK or agriculture officer.
            </p>
          </div>
        </>
      )}

      <CropDetailDialog item={selected} farm={farm} season={season} onClose={() => setSelected(null)} />
    </div>
  );
}

function InputSummary({ result, farm }: { result: RecommendationResult; farm: Farm }) {
  const inputs = [
    { label: 'Rainfall (annual)', value: inputsValue(result.inputs.annualRainfallMm, ' mm'), icon: Droplets },
    { label: 'Seasonal mean temp', value: inputsValue(result.inputs.meanTempC, '°C'), icon: Thermometer },
    { label: 'Soil pH', value: result.inputs.soilPh != null ? String(result.inputs.soilPh) : 'Not set', icon: FlaskConical },
    { label: 'Planting area', value: `${formatNumber(result.inputs.areaAcres, 2)} acres`, icon: Leaf },
    { label: '7-day forecast rain', value: inputsValue(result.inputs.forecastRain7dMm, ' mm'), icon: Droplets },
    { label: 'Annual budget', value: result.inputs.budget ? formatCurrency(result.inputs.budget) : 'Not set', icon: IndianRupee },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Inputs used for this calculation</CardTitle>
        <CardDescription>
          Season view: {seasonLabel(result.season)} · generated {formatDate(result.generatedAt, 'relative')} · area {formatArea(farm.total_area, farm.area_unit)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {inputs.map((input) => (
            <div key={input.label} className="rounded-lg border bg-muted/30 p-2.5">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <input.icon className="h-3 w-3" /> {input.label}
              </p>
              <p className="mt-1 text-xs font-semibold">{input.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <DataSourceBadge provider={result.inputs.climateSource} note="Historical climate normals" />
          <DataSourceBadge provider={result.inputs.weatherSource} note="7-day forecast" />
          <DataSourceBadge provider={result.inputs.marketSource} estimate note="Saved mandi observations used for market fit" />
        </div>
      </CardContent>
    </Card>
  );
}

function inputsValue(value: number | null, unit: string): string {
  return value == null ? 'Unavailable' : `${formatNumber(value, value < 10 ? 1 : 0)}${unit}`;
}

function RecommendationCard({ item, featured, onOpen }: { item: Recommendation; featured: boolean; onOpen: () => void }) {
  const tone = scoreTone(item.score.overall);
  return (
    <Card className={featured ? 'border-primary/30 ring-1 ring-primary/10' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {featured ? <Badge className="mb-1.5">Best match for this view</Badge> : <Badge variant="outline" className="mb-1.5">Rank {item.rank}</Badge>}
            <CardTitle className="text-lg">{item.crop.name}</CardTitle>
            <CardDescription className="mt-1">
              {item.crop.scientific_name ? <em>{item.crop.scientific_name}</em> : null} · {item.crop.category} · {item.crop.growing_duration_days ?? '—'} days
            </CardDescription>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${tone.text}`}>{Math.round(item.score.overall)}<span className="text-xs font-normal text-muted-foreground">/100</span></p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tone.label}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Confidence in this score</span>
            <span>{Math.round(item.score.confidence)}%</span>
          </div>
          <Progress value={item.score.confidence} className="mt-1 h-1.5" />
        </div>

        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <ScoreBar label="Climate fit" value={item.score.climate} weight="24%" />
          <ScoreBar label="Soil fit" value={item.score.soil} weight="16%" />
          <ScoreBar label="Water fit" value={item.score.water} weight="16%" />
          <ScoreBar label="Season fit" value={item.score.season} weight="12%" />
          <ScoreBar label="Market" value={item.score.market} weight={item.market.available ? '12%' : 'n/a'} />
          <ScoreBar label="Economics" value={item.score.economics} weight={item.economics.available ? '12%' : 'n/a'} />
        </div>

        <ul className="space-y-1">
          {item.reasons.slice(0, 2).map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> {reason}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2.5 text-[11px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarRange className="h-3 w-3" /> Planting window {item.plantingWindow}
          </span>
          {item.market.modalPrice != null ? (
            <span className="inline-flex items-center gap-1 font-semibold">
              <TrendingUp className="h-3 w-3" /> {formatCurrency(item.market.modalPrice)}/qtl
            </span>
          ) : (
            <span className="text-muted-foreground">No current mandi price matched</span>
          )}
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onOpen}>Full analysis</Button>
          <Button size="sm" className="flex-1" asChild>
            <Link to={`/crops?add=${item.crop.id}`}>Plan this crop <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CropDetailDialog({
  item,
  farm,
  season,
  onClose,
}: {
  item: Recommendation | null;
  farm: Farm;
  season: Season;
  onClose: () => void;
}) {
  if (!item) return null;
  const crop = item.crop;
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {crop.name}
            <Badge variant={item.score.overall >= 75 ? 'success' : item.score.overall >= 55 ? 'warning' : 'destructive'}>
              {Math.round(item.score.overall)}/100 overall
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {seasonLabel(season)} assessment for {farm.name}. Confidence {Math.round(item.score.confidence)}%.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Score breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              <ScoreBar label="Climate" value={item.score.climate} weight="24%" />
              <ScoreBar label="Soil" value={item.score.soil} weight="16%" />
              <ScoreBar label="Water" value={item.score.water} weight="16%" />
              <ScoreBar label="Season" value={item.score.season} weight="12%" />
              <ScoreBar label="Market" value={item.score.market} weight={item.market.available ? '12%' : 'n/a'} />
              <ScoreBar label="Economics" value={item.score.economics} weight={item.economics.available ? '12%' : 'n/a'} />
              <ScoreBar label="Risk" value={item.score.risk} weight="8%" />
              <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
                Weights are redistributed to agronomic factors when market or economics inputs are unavailable. Market price never dominates.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Reference agronomy</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <Row label="Duration" value={`${crop.growing_duration_days ?? '—'} days`} />
              <Row label="Water need" value={crop.water_requirement ?? '—'} />
              <Row label="pH range" value={crop.min_ph != null && crop.max_ph != null ? `${crop.min_ph} – ${crop.max_ph}` : '—'} />
              <Row label="Rainfall range" value={crop.min_rainfall != null && crop.max_rainfall != null ? `${crop.min_rainfall} – ${crop.max_rainfall} mm` : '—'} />
              <Row label="Sowing window" value={item.plantingWindow} />
              <Row label="Yield reference" value={crop.yield_min_per_acre != null && crop.yield_max_per_acre != null ? `${crop.yield_min_per_acre} – ${crop.yield_max_per_acre} ${crop.yield_unit ?? ''}/acre` : '—'} />
              <Row label="Seed rate" value={crop.seed_rate_per_acre != null ? `${crop.seed_rate_per_acre} ${crop.seed_unit ?? ''}/acre` : '—'} />
              {crop.suitable_soil_types?.length ? <Row label="Suitable soils" value={crop.suitable_soil_types.join(', ')} /> : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Economics estimate · {item.economics.areaAcres} acres</CardTitle>
            <CardDescription className="text-xs">Reference yield and cost ranges × current saved mandi prices. An estimate, not a promise.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Metric label="Reference cost" value={`${formatCurrency(item.economics.costMin)} – ${formatCurrency(item.economics.costMax)}`} />
            <Metric label="Price used" value={item.economics.priceUsed != null ? `${formatCurrency(item.economics.priceUsed)}/qtl` : 'Unavailable'} />
            <Metric label="Revenue range" value={item.economics.revenueMin != null && item.economics.revenueMax != null ? `${formatCurrency(item.economics.revenueMin)} – ${formatCurrency(item.economics.revenueMax)}` : 'Not calculated'} />
            <Metric label="Profit range" value={item.economics.profitMin != null && item.economics.profitMax != null ? `${formatCurrency(item.economics.profitMin)} – ${formatCurrency(item.economics.profitMax)}` : 'Not calculated'} />
            <div className="col-span-2 sm:col-span-4">
              <DataSourceBadge
                provider="Your saved mandi observations"
                observationDate={item.economics.priceObservationDate}
                estimate
                note={`${item.economics.priceMarketCount} market observation(s); profit uses reference costs/yields.`}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Why it scored well</p>
            <ul className="space-y-1.5">
              {item.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-600" /> {reason}
                </li>
              ))}
              {item.reasons.length === 0 ? <li className="text-[11px] text-muted-foreground">No positive reasons recorded from the available inputs.</li> : null}
            </ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" /> Cautions &amp; risks</p>
            <ul className="space-y-1.5">
              {[...item.cautions, ...item.risks].map((risk) => (
                <li key={risk} className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" /> {risk}
                </li>
              ))}
              {item.cautions.length + item.risks.length === 0 ? <li className="text-[11px] text-muted-foreground">No specific cautions for this crop with the current inputs.</li> : null}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {APP_DISCLAIMER}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button asChild><Link to={`/crops?add=${crop.id}`}>Plan this crop</Link></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed pb-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function MethodPanel({ result }: { result: RecommendationResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Weighted model</CardTitle>
          <CardDescription className="text-xs">Every score is 0–100. Higher is better.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {[
            ['Climate fit', '24%', 'NASA POWER rainfall and temperature normals compared with the crop reference band.'],
            ['Soil fit', '16%', 'Your soil type/pH compared with the crop reference suitability.'],
            ['Water fit', '16%', 'Irrigation availability and water source against the crop water requirement.'],
            ['Season fit', '12%', 'Whether the crop is normally grown now and whether the planting window is open.'],
            ['Market fit', 'up to 12%', 'Current saved modal prices, number of markets and price spread. Not a price prediction.'],
            ['Economics', 'up to 12%', 'Reference cost and yield ranges × current prices, compared with your budget.'],
            ['Risk', '8%', 'pH/water mismatches, forecast heat/rain, pest and disease load.'],
          ].map(([label, weight, note]) => (
            <div key={label} className="rounded-lg border p-2.5">
              <div className="flex justify-between gap-2"><span className="font-semibold">{label}</span><Badge variant="outline" className="text-[10px]">{weight}</Badge></div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{note}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Missing-input handling</CardTitle></CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            When a dimension is unavailable, its weight is redistributed to the available agronomic factors and the confidence score falls.
            A missing price never creates a profit estimate. {result.confidenceNote}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Agronomy references</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>Crop ranges and growth stages come from the FarmDesk crop library, built from public extension guidance and kept with a source note per crop. Soil, water and pH thresholds are applied consistently.</p>
            <p>Climate comes from NASA POWER monthly data for the nearest grid point. Market observations come from data.gov.in/AGMARKNET or your official CSV imports.</p>
            <p className="font-medium text-foreground">Verify variety selection, seed rate and fertiliser doses locally. This page is planning support only.</p>
            <div className="flex flex-wrap gap-2">
              <DataSourceBadge provider={result.inputs.climateSource} />
              <DataSourceBadge provider={result.inputs.marketSource} estimate />
              <DataSourceBadge provider={result.inputs.weatherSource} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
