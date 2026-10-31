import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Crosshair,
  Loader2,
  LogOut,
  MapPin,
  Sprout,
  Tractor,
  UserRound,
  Waves,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { farmService } from '@/services/farmService';
import { farmSchema, profileSchema, firstError } from '@/lib/validation';
import {
  AREA_UNITS,
  INDIAN_STATES,
  LAND_SLOPES,
  LANGUAGE_OPTIONS,
  MAHARASHTRA_DISTRICTS,
  SEASONS,
  SOIL_TYPES,
  WATER_SOURCES,
  APP_DISCLAIMER,
} from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { FormField, FormRow } from '@/components/common/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AreaUnit, Farm, Language, Season } from '@/types/models';

const STEPS = [
  { title: 'About you', icon: UserRound },
  { title: 'Farm location', icon: MapPin },
  { title: 'Land & water', icon: Waves },
  { title: 'Review', icon: CheckCircle2 },
] as const;

interface FarmFormState {
  name: string;
  state: string;
  district: string;
  taluka: string;
  village: string;
  latitude: string;
  longitude: string;
  total_area: string;
  area_unit: AreaUnit;
  soil_type: string;
  soil_ph: string;
  irrigation_available: boolean;
  water_source: string;
  land_slope: string;
  farming_season: Season;
  annual_budget: string;
}

const initialFarm: FarmFormState = {
  name: '',
  state: 'Maharashtra',
  district: '',
  taluka: '',
  village: '',
  latitude: '',
  longitude: '',
  total_area: '',
  area_unit: 'acres',
  soil_type: '',
  soil_ph: '',
  irrigation_available: false,
  water_source: '',
  land_slope: 'Level',
  farming_season: 'kharif',
  annual_budget: '',
};

export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, preferences, saveProfile, savePreferences, refresh, signOut } = useAuth();
  const { refreshFarms } = useWorkspace();
  const [step, setStep] = React.useState(0);
  const [fullName, setFullName] = React.useState(profile?.full_name ?? '');
  const [phone, setPhone] = React.useState(profile?.phone ?? '');
  const [language, setLanguage] = React.useState<Language>(profile?.preferred_language ?? 'en');
  const [farm, setFarm] = React.useState<FarmFormState>({
    ...initialFarm,
    area_unit: preferences?.area_unit ?? 'acres',
  });
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [createdFarm, setCreatedFarm] = React.useState<Farm | null>(null);

  React.useEffect(() => {
    if (profile) {
      setFullName((current) => current || profile.full_name || '');
      setPhone((current) => current || profile.phone || '');
      setLanguage(profile.preferred_language ?? 'en');
    }
  }, [profile]);

  React.useEffect(() => {
    if (profile?.onboarding_completed && !createdFarm) {
      navigate('/dashboard', { replace: true });
    }
  }, [createdFarm, navigate, profile?.onboarding_completed]);

  const updateFarm = <K extends keyof FarmFormState>(key: K, value: FarmFormState[K]) => {
    setFarm((current) => ({ ...current, [key]: value }));
  };

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error('This device does not provide location access.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateFarm('latitude', position.coords.latitude.toFixed(6));
        updateFarm('longitude', position.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success('Coordinates added. Check that they point to your farm, not your current town.');
      },
      () => {
        setLocating(false);
        toast.error('Location permission was not granted. You can enter coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const validateProfile = () => {
    const parsed = profileSchema.safeParse({ full_name: fullName, phone, preferred_language: language });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return false;
    }
    return true;
  };

  const validateFarm = (includeOptional: boolean) => {
    const parsed = farmSchema.safeParse({
      ...farm,
      name: farm.name || (includeOptional ? 'My farm' : ''),
      latitude: farm.latitude,
      longitude: farm.longitude,
      total_area: farm.total_area,
      soil_ph: farm.soil_ph,
      annual_budget: farm.annual_budget,
    });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return false;
    }
    return true;
  };

  const next = () => {
    setError('');
    if (step === 0 && !validateProfile()) return;
    if (step === 1) {
      if (!farm.name.trim() || farm.name.trim().length < 2) {
        setError('Give your farm a name so you can find it later.');
        return;
      }
      if (!validateFarm(false)) return;
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const back = () => {
    setError('');
    setStep((current) => Math.max(0, current - 1));
  };

  const finish = async () => {
    setError('');
    if (!validateProfile() || !validateFarm(true)) return;
    setSubmitting(true);
    try {
      const created = await farmService.create({
        name: farm.name.trim(),
        state: farm.state || null,
        district: farm.district || null,
        taluka: farm.taluka || null,
        village: farm.village || null,
        latitude: farm.latitude ? Number(farm.latitude) : null,
        longitude: farm.longitude ? Number(farm.longitude) : null,
        total_area: farm.total_area ? Number(farm.total_area) : null,
        area_unit: farm.area_unit,
        soil_type: farm.soil_type || null,
        soil_ph: farm.soil_ph ? Number(farm.soil_ph) : null,
        irrigation_available: farm.irrigation_available,
        water_source: farm.water_source || null,
        land_slope: farm.land_slope || null,
        farming_season: farm.farming_season,
        annual_budget: farm.annual_budget ? Number(farm.annual_budget) : null,
        is_primary: true,
      });
      setCreatedFarm(created);
      await saveProfile({
        full_name: fullName.trim(),
        phone: phone || null,
        preferred_language: language,
        onboarding_completed: true,
      });
      await savePreferences({ area_unit: farm.area_unit, default_farm_id: created.id });
      await refreshFarms();
      await refresh();
      await i18n.changeLanguage(language);
      toast.success('Farm setup complete. Your workspace is ready.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish the farm setup.');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sprout className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-bold leading-tight">FarmDesk</span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Farm setup</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step {step + 1} of {STEPS.length}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Set up your farm</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            These details drive every calculation. You can change them later in Farm Management.
          </p>
          <Progress value={progress} className="mt-4" />
          <div className="mt-3 grid grid-cols-4 gap-1">
            {STEPS.map((item, index) => (
              <div key={item.title} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    index < step ? 'bg-primary text-primary-foreground' : index === step ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index < step ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className={`hidden truncate sm:inline ${index === step ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <Alert className="mb-4 border-red-200 bg-red-50 text-red-950">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardContent className="p-5 sm:p-6">
            {step === 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Who is managing this farm?</h2>
                </div>
                <FormField label="Full name" htmlFor="fullName" required>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Farmer's full name" />
                </FormField>
                <FormRow>
                  <FormField label="Mobile number" htmlFor="phone" hint="Optional">
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+91 98765 43210" />
                  </FormField>
                  <FormField label="Language" htmlFor="language" hint="Used across the app">
                    <Select
                      value={language}
                      onValueChange={async (value) => {
                        setLanguage(value as Language);
                        await i18n.changeLanguage(value);
                      }}
                    >
                      <SelectTrigger id="language"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.native} · {option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </FormRow>
                <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  Your name and phone are stored only in your FarmDesk profile. Phone is optional and is not used for SMS unless you enable notifications later.
                </p>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Tractor className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Where is the farm?</h2>
                </div>
                <FormField label="Farm name" htmlFor="farmName" required>
                  <Input id="farmName" value={farm.name} onChange={(e) => updateFarm('name', e.target.value)} placeholder="e.g. Patil farm — east block" />
                </FormField>
                <FormRow>
                  <FormField label="State" htmlFor="state">
                    <Select value={farm.state} onValueChange={(value) => updateFarm('state', value)}>
                      <SelectTrigger id="state"><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="District" htmlFor="district">
                    <Input id="district" list="district-options" value={farm.district} onChange={(e) => updateFarm('district', e.target.value)} placeholder="e.g. Pune" />
                    <datalist id="district-options">
                      {MAHARASHTRA_DISTRICTS.map((district) => <option key={district} value={district} />)}
                    </datalist>
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Taluka / block" htmlFor="taluka">
                    <Input id="taluka" value={farm.taluka} onChange={(e) => updateFarm('taluka', e.target.value)} placeholder="e.g. Baramati" />
                  </FormField>
                  <FormField label="Village" htmlFor="village">
                    <Input id="village" value={farm.village} onChange={(e) => updateFarm('village', e.target.value)} placeholder="e.g. Malegaon" />
                  </FormField>
                </FormRow>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Farm coordinates</p>
                      <p className="text-[11px] text-muted-foreground">Used for weather and NASA POWER climate grids. Both fields are optional.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
                      {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                      {locating ? 'Locating…' : 'Use my location'}
                    </Button>
                  </div>
                  <FormRow className="mt-3">
                    <FormField label="Latitude" htmlFor="latitude">
                      <Input id="latitude" inputMode="decimal" value={farm.latitude} onChange={(e) => updateFarm('latitude', e.target.value)} placeholder="18.5204" />
                    </FormField>
                    <FormField label="Longitude" htmlFor="longitude">
                      <Input id="longitude" inputMode="decimal" value={farm.longitude} onChange={(e) => updateFarm('longitude', e.target.value)} placeholder="73.8567" />
                    </FormField>
                  </FormRow>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Land, soil and water</h2>
                </div>
                <FormRow>
                  <FormField label="Total area" htmlFor="area">
                    <Input id="area" inputMode="decimal" value={farm.total_area} onChange={(e) => updateFarm('total_area', e.target.value)} placeholder="Optional" />
                  </FormField>
                  <FormField label="Area unit" htmlFor="areaUnit">
                    <Select value={farm.area_unit} onValueChange={(value) => updateFarm('area_unit', value as AreaUnit)}>
                      <SelectTrigger id="areaUnit"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AREA_UNITS.map((unit) => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Soil type" htmlFor="soilType">
                    <Select value={farm.soil_type} onValueChange={(value) => updateFarm('soil_type', value)}>
                      <SelectTrigger id="soilType"><SelectValue placeholder="Select if known" /></SelectTrigger>
                      <SelectContent>
                        {SOIL_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Soil pH" htmlFor="ph" hint="0 – 14">
                    <Input id="ph" inputMode="decimal" value={farm.soil_ph} onChange={(e) => updateFarm('soil_ph', e.target.value)} placeholder="e.g. 7.2" />
                  </FormField>
                </FormRow>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <Label htmlFor="irrigation">Irrigation available</Label>
                    <p className="text-[11px] text-muted-foreground">Turn on if the farm has assured irrigation beyond rainfall.</p>
                  </div>
                  <Switch
                    id="irrigation"
                    checked={farm.irrigation_available}
                    onCheckedChange={(checked) => updateFarm('irrigation_available', checked)}
                  />
                </div>
                <FormRow>
                  <FormField label="Water source" htmlFor="waterSource">
                    <Select
                      value={farm.water_source}
                      onValueChange={(value) => updateFarm('water_source', value)}
                      disabled={!farm.irrigation_available}
                    >
                      <SelectTrigger id="waterSource"><SelectValue placeholder={farm.irrigation_available ? 'Select source' : 'Rain-fed only'} /></SelectTrigger>
                      <SelectContent>
                        {WATER_SOURCES.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Land slope" htmlFor="slope">
                    <Select value={farm.land_slope} onValueChange={(value) => updateFarm('land_slope', value)}>
                      <SelectTrigger id="slope"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LAND_SLOPES.map((slope) => <SelectItem key={slope} value={slope}>{slope}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Main season" htmlFor="season">
                    <Select value={farm.farming_season} onValueChange={(value) => updateFarm('farming_season', value as Season)}>
                      <SelectTrigger id="season"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEASONS.map((season) => (
                          <SelectItem key={season.value} value={season.value}>{season.label} · {season.months}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Annual farm budget" htmlFor="budget" hint="Optional, ₹">
                    <Input id="budget" inputMode="decimal" value={farm.annual_budget} onChange={(e) => updateFarm('annual_budget', e.target.value)} placeholder="e.g. 250000" />
                  </FormField>
                </FormRow>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Review before creating the farm</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReviewItem label="Farmer" value={fullName || '—'} />
                  <ReviewItem label="Mobile" value={phone || 'Not provided'} />
                  <ReviewItem label="Farm" value={farm.name || '—'} />
                  <ReviewItem label="Location" value={[farm.village, farm.taluka, farm.district, farm.state].filter(Boolean).join(', ') || 'Not provided'} />
                  <ReviewItem label="Coordinates" value={farm.latitude && farm.longitude ? `${farm.latitude}, ${farm.longitude}` : 'Not provided — weather cannot load until set'} />
                  <ReviewItem label="Area" value={farm.total_area ? `${farm.total_area} ${farm.area_unit}` : 'Not provided'} />
                  <ReviewItem label="Soil" value={[farm.soil_type, farm.soil_ph ? `pH ${farm.soil_ph}` : ''].filter(Boolean).join(' · ') || 'Not provided'} />
                  <ReviewItem label="Irrigation" value={farm.irrigation_available ? farm.water_source || 'Available' : 'Rain-fed'} />
                  <ReviewItem label="Main season" value={SEASONS.find((s) => s.value === farm.farming_season)?.label ?? farm.farming_season} />
                  <ReviewItem label="Annual budget" value={farm.annual_budget ? `₹${Number(farm.annual_budget).toLocaleString('en-IN')}` : 'Not provided'} />
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                  <p className="font-semibold">What happens next</p>
                  <p className="mt-1">
                    FarmDesk will load a 7-day forecast and historical climate for these coordinates, then score crops using your soil, water and market observations. Missing inputs reduce confidence rather than being invented.
                  </p>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{APP_DISCLAIMER}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={back} disabled={step === 0 || submitting}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => void finish()} disabled={submitting} size="lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? 'Creating your farm…' : t('onboarding.finish')}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
