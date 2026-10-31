import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  CloudRain,
  Compass,
  Droplets,
  ExternalLink,
  Gauge,
  Leaf,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FarmGate } from '@/components/common/FarmGate';
import { PageHeader } from '@/components/common/PageHeader';
import { DataSourceBadge, SeverityBadge } from '@/components/common/DataSourceBadge';
import { CardSkeleton, EmptyState, ErrorState, Notice } from '@/components/common/states';
import { WeatherGlyph } from '@/components/weather/WeatherGlyph';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClimate, useWeather } from '@/hooks/useAgriculture';
import { deriveWeatherAlerts, rainfallIntelligence, weatherLabel, windDirectionLabel } from '@/lib/weather';
import { formatNumber, getWeatherIcon } from '@/lib/utils';
import { formatArea } from '@/lib/units';
import type { ClimateMonth, Farm, WeatherData } from '@/types/models';

export function WeatherPage() {
  return <FarmGate>{(farm) => <WeatherContent farm={farm} />}</FarmGate>;
}

function WeatherContent({ farm }: { farm: Farm }) {
  const { t } = useTranslation();
  const weather = useWeather(farm);
  const climate = useClimate(farm, 5);
  const [tab, setTab] = React.useState('forecast');

  const refresh = async () => {
    await Promise.all([weather.refetch(), climate.refetch()]);
  };

  const hasCoordinates = farm.latitude != null && farm.longitude != null;

  return (
    <div>
      <PageHeader
        title={t('weather.title')}
        subtitle={t('weather.subtitle')}
        icon={CloudRain}
        meta={
          <>
            <span>{farm.name}</span>
            {hasCoordinates ? <span>· {Number(farm.latitude).toFixed(4)}, {Number(farm.longitude).toFixed(4)}</span> : null}
            {farm.district ? <span>· {farm.district}, {farm.state}</span> : null}
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={weather.isFetching || climate.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${(weather.isFetching || climate.isFetching) ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      {!hasCoordinates ? (
        <EmptyState
          icon={CloudRain}
          title="Farm coordinates are missing"
          description="Weather and climate services need latitude and longitude. Add them under Farm Management — you can use your device location there."
          action={<Button asChild><a href="/farms">Open Farm Management</a></Button>}
        />
      ) : (
        <>
          {weather.error ? (
            <ErrorState
              className="mb-4"
              title="Forecast unavailable"
              message={(weather.error as Error).message}
              onRetry={() => void weather.refetch()}
            />
          ) : null}

          {weather.data ? (
            <CurrentWeather data={weather.data} farm={farm} />
          ) : weather.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
          ) : null}

          <Tabs value={tab} onValueChange={setTab} className="mt-5">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="forecast">Forecast</TabsTrigger>
              <TabsTrigger value="rainfall">Rainfall &amp; alerts</TabsTrigger>
              <TabsTrigger value="climate">Historical climate</TabsTrigger>
            </TabsList>

            <TabsContent value="forecast" className="mt-4">
              {weather.data ? <ForecastSection data={weather.data} /> : (
                <EmptyState icon={CloudRain} title="No forecast loaded" description="Check the coordinates and try refreshing." />
              )}
            </TabsContent>

            <TabsContent value="rainfall" className="mt-4">
              {weather.data ? <RainfallSection data={weather.data} /> : (
                <EmptyState icon={CloudRain} title="No forecast loaded" description="Rainfall intelligence needs a current forecast." />
              )}
            </TabsContent>

            <TabsContent value="climate" className="mt-4">
              <ClimateSection
                farm={farm}
                data={climate.data}
                loading={climate.isLoading}
                error={climate.error as Error | null}
                onRetry={() => void climate.refetch()}
              />
            </TabsContent>
          </Tabs>

          <div className="mt-4 rounded-xl border bg-card p-4">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Forecast vs official warning:</strong> FarmDesk alerts are derived from Open-Meteo forecast values using published thresholds (rain, heat, cold, wind). They are not IMD warnings. For official alerts, check{' '}
              <a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer noopener" className="font-medium text-primary hover:underline">
                IMD Mausam <ExternalLink className="inline h-3 w-3" />
              </a>{' '}
              and your district agriculture office. Historical rainfall is a NASA POWER gridded estimate for the farm's coordinates, not a rain-gauge reading.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function CurrentWeather({ data, farm }: { data: WeatherData; farm: Farm }) {
  const current = data.current;
  const today = data.daily[0];
  return (
    <Card className="overflow-hidden border-sky-100">
      <div className="grid gap-0 md:grid-cols-[1.1fr_1.9fr]">
        <div className="bg-gradient-to-br from-sky-100 via-sky-50 to-emerald-50 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">Current conditions</p>
              <p className="mt-2 text-5xl font-extrabold tracking-tight">{Math.round(current.temperature)}°<span className="text-2xl font-semibold">C</span></p>
              <p className="mt-1 text-sm font-medium">{weatherLabel(current.weatherCode)}</p>
              <p className="text-xs text-muted-foreground">Feels like {Math.round(current.apparentTemperature)}°C · {current.isDay ? 'Daytime' : 'Night'}</p>
            </div>
            <WeatherGlyph code={current.weatherCode} className="h-14 w-14 text-sky-700" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Metric icon={Droplets} label="Humidity" value={`${Math.round(current.humidity)}%`} />
            <Metric icon={Wind} label="Wind" value={`${Math.round(current.windSpeed)} km/h ${windDirectionLabel(current.windDirection)}`} />
            <Metric icon={CloudRain} label="Rain now" value={`${current.precipitation} mm`} />
            <Metric icon={Gauge} label="Pressure" value={`${Math.round(current.pressure)} hPa`} />
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Today at {farm.village || farm.district || 'your farm'}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(`${today.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <Badge variant="outline" className="gap-1 font-normal">
              <CalendarDays className="h-3 w-3" /> {data.daily.length}-day forecast
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DayMetric icon={Thermometer} label="High / low" value={`${Math.round(today.tempMax)}° / ${Math.round(today.tempMin)}°`} />
            <DayMetric icon={CloudRain} label="Rainfall" value={`${today.rainfall} mm`} />
            <DayMetric icon={Droplets} label="Rain chance" value={`${Math.round(today.rainProbability)}%`} />
            <DayMetric icon={Sun} label="UV index" value={`${today.uvIndexMax}`} />
            <DayMetric icon={Sunrise} label="Sunrise" value={timeOfDay(today.sunrise)} />
            <DayMetric icon={Sunset} label="Sunset" value={timeOfDay(today.sunset)} />
            <DayMetric icon={Leaf} label="ET₀" value={`${today.et0.toFixed(1)} mm`} />
            <DayMetric icon={Wind} label="Wind max" value={`${Math.round(today.windSpeedMax)} km/h`} />
          </div>
          <DataSourceBadge
            className="mt-4"
            provider={data.source}
            fetchedAt={data.fetchedAt}
            stale={data.stale}
            cached={data.cached}
            sourceUrl={data.providerUrl}
            note="Current values are hourly model data, not a local weather station reading."
          />
          <p className="mt-2 text-[10px] text-muted-foreground">
            Farm area: {formatArea(farm.total_area, farm.area_unit)} · Grid point: {data.latitude.toFixed(3)}, {data.longitude.toFixed(3)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function ForecastSection({ data }: { data: WeatherData }) {
  const hourly = data.hourly;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Next 24 hours</CardTitle>
          <CardDescription>Temperature and precipitation from Open-Meteo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourly.map((hour) => ({
                label: new Date(hour.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                temp: hour.temperature,
                rain: hour.precipitation,
                probability: hour.rainProbability,
              }))} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="temp-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={3} />
                <YAxis yAxisId="temp" tickLine={false} axisLine={false} fontSize={10} width={38} unit="°" />
                <YAxis yAxisId="rain" orientation="right" tickLine={false} axisLine={false} fontSize={10} width={34} unit="mm" />
                <Tooltip
                  formatter={(value: number, name: string) => [name === 'temp' ? `${value.toFixed(1)}°C` : name === 'rain' ? `${value} mm` : `${value}%`, name === 'temp' ? 'Temperature' : name === 'rain' ? 'Precipitation' : 'Rain chance']}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Area yAxisId="temp" type="monotone" dataKey="temp" stroke="#ea580c" strokeWidth={2} fill="url(#temp-gradient)" />
                <Bar yAxisId="rain" dataKey="rain" fill="#0284c7" radius={[2, 2, 0, 0]} maxBarSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max gap-1.5">
              {hourly.map((hour) => (
                <div key={hour.time} className="w-[74px] shrink-0 rounded-lg border p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{new Date(hour.time).toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false })}</p>
                  <p className="my-1 text-lg">{getWeatherIcon(hour.weatherCode)}</p>
                  <p className="text-xs font-semibold">{Math.round(hour.temperature)}°C</p>
                  <p className="text-[10px] text-sky-700">{hour.rainProbability}%</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">7-day outlook</CardTitle>
          <CardDescription>Daily model forecast</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.daily.map((day) => (
            <div key={day.date} className="flex items-center gap-2.5 rounded-lg border p-2.5">
              <WeatherGlyph code={day.weatherCode} className="h-5 w-5 shrink-0 text-sky-700" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{weatherLabel(day.weatherCode)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold">{Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°</p>
                <p className="text-[10px] text-sky-700">{day.rainfall > 0 ? `${day.rainfall} mm` : `${Math.round(day.rainProbability)}%`}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RainfallSection({ data }: { data: WeatherData }) {
  const rain = rainfallIntelligence(data);
  const alerts = deriveWeatherAlerts(data.daily);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rainfall intelligence</CardTitle>
          <CardDescription>What the forecast implies for irrigation and field work</CardDescription>
        </CardHeader>
        <CardContent>
          {rain ? (
            <>
              <div className={`rounded-xl border p-4 ${rain.level === 'high' ? 'border-sky-300 bg-sky-50' : rain.level === 'moderate' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{rain.headline}</p>
                  <Badge variant={rain.level === 'high' ? 'info' : rain.level === 'moderate' ? 'success' : 'warning'} className="capitalize">{rain.level}</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{rain.detail}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white/70 p-2">
                    <p className="text-muted-foreground">Next 7 days</p>
                    <p className="text-lg font-bold">{formatNumber(rain.total7d, 0)} mm</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-2">
                    <p className="text-muted-foreground">Wet days (≥2.5 mm)</p>
                    <p className="text-lg font-bold">{rain.wetDays} of 7</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {data.daily.slice(0, 7).map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-[11px] text-muted-foreground">
                      {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(100, (day.rainfall / 50) * 100)}%` }} />
                    </div>
                    <span className="w-14 shrink-0 text-right text-[11px] font-medium">{day.rainfall} mm</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={CloudRain} title="Not enough forecast data" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Forecast alerts</CardTitle>
          <CardDescription>FarmDesk thresholds — not official IMD warnings</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length ? (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={`${alert.type}-${alert.date}-${index}`} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">{alert.title}</p>
                    <SeverityBadge severity={alert.severity} />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{alert.message}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">Threshold: {alert.threshold} · Forecast value: {alert.value} {alert.unit}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-emerald-600" />
              <p className="mt-2 text-sm font-medium">No threshold alerts in this forecast</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                FarmDesk checks ≥25 mm/day rain, ≥40°C heat, ≤7°C cold, ≥50 km/h wind and thunderstorm codes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClimateSection({
  farm,
  data,
  loading,
  error,
  onRetry,
}: {
  farm: Farm;
  data: ReturnType<typeof useClimate>['data'];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (loading) return <div className="grid gap-3 sm:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>;
  if (error) return <ErrorState title="Historical climate unavailable" message={error.message} onRetry={onRetry} />;
  if (!data) return <EmptyState icon={CloudRain} title="No climate history loaded" description="NASA POWER data is fetched for the farm coordinates." />;

  const monthly = groupMonthlyNormals(data.months);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Annual rainfall history</CardTitle>
            <CardDescription>NASA POWER monthly totals aggregated by year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.annual} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={10} />
                  <YAxis yAxisId="rain" tickLine={false} axisLine={false} fontSize={10} width={44} tickFormatter={(v) => `${v} mm`} />
                  <YAxis yAxisId="temp" orientation="right" tickLine={false} axisLine={false} fontSize={10} width={38} unit="°" />
                  <Tooltip
                    formatter={(value: number, name: string) => [name === 'rainfall' ? `${Math.round(value)} mm` : `${value}°C`, name === 'rainfall' ? 'Annual rainfall' : 'Mean temperature']}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar yAxisId="rain" dataKey="rainfall" name="Rainfall (mm)" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={44} />
                  <Line yAxisId="temp" type="monotone" dataKey="tempMean" name="Mean temp (°C)" stroke="#ea580c" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Seasonal normals</CardTitle>
            <CardDescription>Average across the requested years</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.seasons.map((season) => (
              <div key={season.season} className="rounded-lg border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{season.season}</p>
                  <span className="text-[10px] text-muted-foreground">{season.months}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-bold">{formatNumber(season.rainfall, 0)} mm</span>
                  <span className="text-[11px] text-muted-foreground">mean {season.tempMean.toFixed(1)}°C</span>
                </div>
              </div>
            ))}
            <div className="rounded-lg bg-muted/50 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
              Rainfall is a gridded reanalysis estimate, not a local gauge. Use it to understand normal conditions, not to settle a claim.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly climate normals</CardTitle>
          <CardDescription>Averaged monthly rainfall and temperature for this grid point</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis yAxisId="rain" tickLine={false} axisLine={false} fontSize={10} width={44} tickFormatter={(v) => `${v}`} />
                <YAxis yAxisId="temp" orientation="right" tickLine={false} axisLine={false} fontSize={10} width={34} unit="°" />
                <Tooltip
                  formatter={(value: number, name: string) => [name === 'rain' ? `${Math.round(value)} mm` : `${value}°C`, name === 'rain' ? 'Mean monthly rainfall' : 'Mean temperature']}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="rain" dataKey="rain" name="Rainfall (mm)" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temp (°C)" stroke="#ea580c" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3">
            <DataSourceBadge
              provider={data.source}
              fetchedAt={data.fetchedAt}
              cached={data.cached}
              sourceUrl={data.providerUrl}
              note={`${data.gridResolution} grid · ${data.months.length} monthly observations`}
            />
          </div>
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Rainfall</TableHead>
                  <TableHead className="text-right">Mean temp</TableHead>
                  <TableHead className="text-right">Max temp</TableHead>
                  <TableHead className="text-right">Min temp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthly.map((row) => (
                  <TableRow key={row.monthNumber}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.rain, 0)} mm</TableCell>
                    <TableCell className="text-right">{row.temp.toFixed(1)}°C</TableCell>
                    <TableCell className="text-right">{row.tempMax.toFixed(1)}°C</TableCell>
                    <TableCell className="text-right">{row.tempMin.toFixed(1)}°C</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function groupMonthlyNormals(months: ClimateMonth[]) {
  const map = new Map<number, { month: string; monthNumber: number; rain: number; temp: number; tempMax: number; tempMin: number; count: number }>();
  for (const row of months) {
    const entry = map.get(row.monthNumber) ?? {
      month: row.month,
      monthNumber: row.monthNumber,
      rain: 0,
      temp: 0,
      tempMax: 0,
      tempMin: 0,
      count: 0,
    };
    entry.rain += Number(row.rainfall) || 0;
    entry.temp += Number(row.tempMean) || 0;
    entry.tempMax += Number(row.tempMax) || 0;
    entry.tempMin += Number(row.tempMin) || 0;
    entry.count += 1;
    map.set(row.monthNumber, entry);
  }
  return [...map.values()]
    .sort((a, b) => a.monthNumber - b.monthNumber)
    .map((entry) => ({
      month: entry.month,
      monthNumber: entry.monthNumber,
      label: entry.month.slice(0, 3),
      rain: entry.count ? entry.rain / entry.count : 0,
      temp: entry.count ? entry.temp / entry.count : 0,
      tempMax: entry.count ? entry.tempMax / entry.count : 0,
      tempMin: entry.count ? entry.tempMin / entry.count : 0,
    }));
}

function timeOfDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/65 p-2">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="h-3 w-3" /> {label}</p>
      <p className="mt-0.5 text-xs font-semibold">{value}</p>
    </div>
  );
}

function DayMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="h-3 w-3" /> {label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
