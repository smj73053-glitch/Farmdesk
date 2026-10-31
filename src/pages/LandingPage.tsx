import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CloudSun,
  Database,
  Globe2,
  Landmark,
  Leaf,
  LineChart,
  MapPin,
  Satellite,
  ShieldCheck,
  Sparkles,
  Sprout,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { useAuth } from '@/context/AuthContext';
import { APP_DISCLAIMER, APP_TAGLINE } from '@/lib/constants';

const FEATURES = [
  { key: 'weather', icon: CloudSun, tone: 'bg-sky-50 text-sky-700' },
  { key: 'crops', icon: Sprout, tone: 'bg-emerald-50 text-emerald-700' },
  { key: 'market', icon: TrendingUp, tone: 'bg-amber-50 text-amber-700' },
  { key: 'finance', icon: Wallet, tone: 'bg-orange-50 text-orange-800' },
  { key: 'ai', icon: Sparkles, tone: 'bg-violet-50 text-violet-700' },
  { key: 'management', icon: Leaf, tone: 'bg-lime-50 text-lime-700' },
] as const;

const SOURCES = [
  {
    name: 'Open-Meteo',
    roleKey: 'landing.sources.weather',
    icon: CloudSun,
    url: 'https://open-meteo.com/',
  },
  {
    name: 'NASA POWER',
    roleKey: 'landing.sources.climate',
    icon: Satellite,
    url: 'https://power.larc.nasa.gov/',
  },
  {
    name: 'data.gov.in / AGMARKNET',
    roleKey: 'landing.sources.market',
    icon: Landmark,
    url: 'https://agmarknet.gov.in/',
  },
  {
    name: 'Your farm records',
    roleKey: 'landing.sources.yours',
    icon: Database,
    url: '',
  },
] as const;

export function LandingPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const primaryTo = session ? '/dashboard' : '/signup';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sprout className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-tight">FarmDesk</span>
              <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:block">
                {APP_TAGLINE}
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#sources" className="hover:text-foreground">Data sources</a>
            <a href="#languages" className="hover:text-foreground">Languages</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher compact className="hidden sm:flex" />
            {session ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Dashboard <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">{t('auth.login')}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup">{t('landing.hero.cta')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(48_96%_89%),_transparent_55%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <Badge variant="secondary" className="gap-1.5 border border-primary/10 px-3 py-1 text-[11px] font-semibold">
                <MapPin className="h-3 w-3" /> Built for farms in Maharashtra &amp; India
              </Badge>
              <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                {t('landing.hero.title')}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t('landing.hero.subtitle')}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="shadow-md">
                  <Link to={primaryTo}>
                    {session ? 'Open my dashboard' : t('landing.hero.cta')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how">{t('landing.hero.secondary')}</a>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Real farm records, not demo data</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Row-level security</span>
                <span className="inline-flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5 text-emerald-600" /> English · मराठी · हिंदी</span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border bg-card p-4 shadow-xl shadow-primary/5 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live data pipeline</p>
                    <p className="text-sm font-bold">What feeds your decisions</p>
                  </div>
                  <Badge variant="success" className="gap-1 text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Connected</Badge>
                </div>
                <div className="mt-4 space-y-2.5">
                  {SOURCES.map((source) => (
                    <div key={source.name} className="flex items-center gap-3 rounded-xl border bg-background/70 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <source.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{source.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{t(source.roleKey)}</p>
                      </div>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[10px] font-medium text-primary hover:underline"
                        >
                          Official ↗
                        </a>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Private</Badge>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-primary p-3.5 text-primary-foreground">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Sparkles className="h-4 w-4" /> Decision support
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-primary-foreground/85">
                    Crop suitability, irrigation timing, expense tracking and market context — with the source and date attached to every external number.
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-3 hidden rounded-xl border bg-card px-3 py-2 text-[11px] shadow-lg sm:flex sm:items-center sm:gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span><strong>Estimates are labelled.</strong> Guarantees are never promised.</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">One workspace for the whole season</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">From sowing decision to sale, with the data in one place.</h2>
            <p className="mt-3 text-muted-foreground">
              FarmDesk connects your farm profile, field records and financial entries to public weather, climate and market datasets. You always see what is observed, what is estimated and when it was retrieved.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.key} className="group transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${feature.tone}`}>
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{t(`landing.features.${feature.key}.title`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t(`landing.features.${feature.key}.description`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="how" className="border-y bg-card/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">How it works</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">Three steps to a clearer season.</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  No sample farms, no invented prices. FarmDesk starts calculating only after you add your own farm details.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { number: '01', title: 'Add your farm', text: 'Location, area, soil, water source and season. Use your device location or enter coordinates.', icon: MapPin },
                  { number: '02', title: 'Get real inputs', text: 'Weather forecast, historical climate and saved mandi prices are fetched and labelled with their source.', icon: LineChart },
                  { number: '03', title: 'Act with context', text: 'Review scores, costs and risks, log activity and expenses, then compare outcomes through the season.', icon: Leaf },
                ].map((step) => (
                  <div key={step.number} className="rounded-xl border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold tracking-widest text-primary">{step.number}</span>
                      <step.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="sources" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Data honesty</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Every external number carries its source.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                If a provider is unavailable, FarmDesk says so and shows the last saved observation with its date. It does not fill gaps with made-up weather or prices.
              </p>
              <ul className="mt-5 space-y-3 text-sm">
                {[
                  'Weather and 7-day forecast: Open-Meteo, retrieved through a secured service.',
                  'Historical monthly climate: NASA POWER, with rainfall unit conversion documented.',
                  'Mandi prices: data.gov.in / AGMARKNET, or an official CSV import you control.',
                  'Crop suitability: calculated from your farm inputs and published reference agronomy.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">Open-Meteo ↗</a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer noopener">NASA POWER ↗</a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="https://agmarknet.gov.in/" target="_blank" rel="noreferrer noopener">AGMARKNET ↗</a>
                </Button>
              </div>
            </div>
            <Card className="border-primary/15 bg-gradient-to-br from-emerald-50 to-amber-50/70">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">What FarmDesk will not do</h3>
                    <p className="text-xs text-muted-foreground">Product principles, not marketing claims</p>
                  </div>
                </div>
                <ul className="mt-5 space-y-3 text-sm">
                  {[
                    'Present simulated data as live or observed.',
                    'Let market price alone decide which crop you should grow.',
                    'Publish a yield, profit or weather guarantee.',
                    'Let the AI assistant move money, delete records or act without you.',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 rounded-lg bg-white/70 p-2.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="languages" className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">Made for local use</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">English, मराठी and हिंदी — switch anytime.</h2>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
                Navigation, forms and guidance are available in three languages. Crop names include local names where the reference dataset provides them.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="lg">
                <Link to={primaryTo}>{session ? 'Open dashboard' : 'Create your free account'} <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sprout className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold">FarmDesk</p>
                <p className="text-[11px] text-muted-foreground">{APP_TAGLINE}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <Link to="/login" className="hover:text-foreground">Sign in</Link>
              <Link to="/signup" className="hover:text-foreground">Create account</Link>
              <a href="https://agmarknet.gov.in/" target="_blank" rel="noreferrer noopener" className="hover:text-foreground">AGMARKNET</a>
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener" className="hover:text-foreground">Open-Meteo</a>
              <Link to="/knowledge" className="hover:text-foreground">Knowledge centre</Link>
            </div>
          </div>
          <p className="mt-6 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">{APP_DISCLAIMER}</p>
        </div>
      </footer>
    </div>
  );
}
