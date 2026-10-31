import * as React from 'react';
import { AlertCircle, Crosshair, Loader2, MapPin, Tractor } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { farmService } from '@/services/farmService';
import { farmSchema, firstError } from '@/lib/validation';
import {
  AREA_UNITS,
  INDIAN_STATES,
  LAND_SLOPES,
  MAHARASHTRA_DISTRICTS,
  SEASONS,
  SOIL_TYPES,
  WATER_SOURCES,
} from '@/lib/constants';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField, FormRow } from '@/components/common/FormField';
import type { AreaUnit, Farm, Season } from '@/types/models';

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
  farming_season: Season | '';
  annual_budget: string;
  is_primary: boolean;
}

function defaults(farm?: Farm | null): FarmFormState {
  return {
    name: farm?.name ?? '',
    state: farm?.state ?? 'Maharashtra',
    district: farm?.district ?? '',
    taluka: farm?.taluka ?? '',
    village: farm?.village ?? '',
    latitude: farm?.latitude != null ? String(farm.latitude) : '',
    longitude: farm?.longitude != null ? String(farm.longitude) : '',
    total_area: farm?.total_area != null ? String(farm.total_area) : '',
    area_unit: farm?.area_unit ?? 'acres',
    soil_type: farm?.soil_type ?? '',
    soil_ph: farm?.soil_ph != null ? String(farm.soil_ph) : '',
    irrigation_available: farm?.irrigation_available ?? false,
    water_source: farm?.water_source ?? '',
    land_slope: farm?.land_slope ?? '',
    farming_season: farm?.farming_season ?? '',
    annual_budget: farm?.annual_budget != null ? String(farm.annual_budget) : '',
    is_primary: farm?.is_primary ?? false,
  };
}

export function FarmFormDialog({
  open,
  onOpenChange,
  farm,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farm?: Farm | null;
  onSaved?: (farm: Farm) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<FarmFormState>(() => defaults(farm));
  const [saving, setSaving] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(defaults(farm));
      setError(null);
    }
  }, [open, farm]);

  const set = <K extends keyof FarmFormState>(key: K, value: FarmFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error('This device does not provide a location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set('latitude', position.coords.latitude.toFixed(6));
        set('longitude', position.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success(`Location captured (±${Math.round(position.coords.accuracy)} m accuracy).`);
      },
      (geoError) => {
        setLocating(false);
        toast.error(geoError.message || 'Could not get your location. Enter coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = farmSchema.safeParse(form);
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const data = parsed.data;
      const payload: Partial<Farm> = {
        name: data.name,
        state: data.state ?? null,
        district: data.district ?? null,
        taluka: data.taluka ?? null,
        village: data.village ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        total_area: data.total_area ?? null,
        area_unit: data.area_unit,
        soil_type: data.soil_type ?? null,
        soil_ph: data.soil_ph ?? null,
        irrigation_available: data.irrigation_available,
        water_source: data.water_source ?? null,
        land_slope: data.land_slope ?? null,
        farming_season: data.farming_season ?? null,
        annual_budget: data.annual_budget ?? null,
        is_primary: data.is_primary ?? farm?.is_primary ?? false,
      };
      const saved = farm ? await farmService.update(farm.id, payload) : await farmService.create(payload);
      if (payload.is_primary && user) await farmService.setPrimary(saved.id, user.id);
      await queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success(farm ? 'Farm details updated.' : 'Farm added.');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this farm.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tractor className="h-5 w-5 text-primary" />
            {farm ? 'Edit farm' : 'Add a farm'}
          </DialogTitle>
          <DialogDescription>
            These details drive weather, climate, crop scores and financial tracking. Only enter what you know — leave unknown fields blank.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <FormField label="Farm name" htmlFor="farm-name" required>
            <Input id="farm-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kulkarni farm – Block A" autoFocus />
          </FormField>

          <FormRow>
            <FormField label="State" htmlFor="farm-state">
              <Select value={form.state || 'none'} onValueChange={(value) => set('state', value === 'none' ? '' : value)}>
                <SelectTrigger id="farm-state"><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {INDIAN_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="District" htmlFor="farm-district">
              {form.state === 'Maharashtra' ? (
                <Select value={form.district || 'none'} onValueChange={(value) => set('district', value === 'none' ? '' : value)}>
                  <SelectTrigger id="farm-district"><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {MAHARASHTRA_DISTRICTS.map((district) => <SelectItem key={district} value={district}>{district}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="farm-district" value={form.district} onChange={(e) => set('district', e.target.value)} placeholder="District" />
              )}
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Taluka / block" htmlFor="farm-taluka"><Input id="farm-taluka" value={form.taluka} onChange={(e) => set('taluka', e.target.value)} /></FormField>
            <FormField label="Village" htmlFor="farm-village"><Input id="farm-village" value={form.village} onChange={(e) => set('village', e.target.value)} /></FormField>
          </FormRow>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium"><MapPin className="h-4 w-4 text-primary" /> Farm coordinates</p>
                <p className="text-[11px] text-muted-foreground">Required for weather, climate and crop scoring. Captured from this device only when you ask.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={locate} disabled={locating}>
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                {locating ? 'Locating…' : 'Use my location'}
              </Button>
            </div>
            <FormRow className="mt-3">
              <FormField label="Latitude" htmlFor="farm-lat"><Input id="farm-lat" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} inputMode="decimal" placeholder="18.5204" /></FormField>
              <FormField label="Longitude" htmlFor="farm-lng"><Input id="farm-lng" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} inputMode="decimal" placeholder="73.8567" /></FormField>
            </FormRow>
          </div>

          <FormRow>
            <FormField label="Total area" htmlFor="farm-area"><Input id="farm-area" value={form.total_area} onChange={(e) => set('total_area', e.target.value)} inputMode="decimal" placeholder="2.5" /></FormField>
            <FormField label="Area unit" htmlFor="farm-unit">
              <Select value={form.area_unit} onValueChange={(value) => set('area_unit', value as AreaUnit)}>
                <SelectTrigger id="farm-unit"><SelectValue /></SelectTrigger>
                <SelectContent>{AREA_UNITS.map((unit) => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Soil type" htmlFor="farm-soil">
              <Select value={form.soil_type || 'none'} onValueChange={(value) => set('soil_type', value === 'none' ? '' : value)}>
                <SelectTrigger id="farm-soil"><SelectValue placeholder="Select soil" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {SOIL_TYPES.map((soil) => <SelectItem key={soil} value={soil}>{soil}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Soil pH" htmlFor="farm-ph" hint="0–14">
              <Input id="farm-ph" value={form.soil_ph} onChange={(e) => set('soil_ph', e.target.value)} inputMode="decimal" placeholder="6.8" />
            </FormField>
          </FormRow>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Irrigation available</p>
              <p className="text-[11px] text-muted-foreground">Turn on only if the farm can be irrigated when needed.</p>
            </div>
            <Switch checked={form.irrigation_available} onCheckedChange={(checked) => set('irrigation_available', checked)} />
          </div>

          <FormRow>
            <FormField label="Water source" htmlFor="farm-water">
              <Select value={form.water_source || 'none'} onValueChange={(value) => set('water_source', value === 'none' ? '' : value)}>
                <SelectTrigger id="farm-water"><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {WATER_SOURCES.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Land slope" htmlFor="farm-slope">
              <Select value={form.land_slope || 'none'} onValueChange={(value) => set('land_slope', value === 'none' ? '' : value)}>
                <SelectTrigger id="farm-slope"><SelectValue placeholder="Select slope" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {LAND_SLOPES.map((slope) => <SelectItem key={slope} value={slope}>{slope}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Main farming season" htmlFor="farm-season">
              <Select value={form.farming_season || 'none'} onValueChange={(value) => set('farming_season', value === 'none' ? '' : value as Season)}>
                <SelectTrigger id="farm-season"><SelectValue placeholder="Select season" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use current season</SelectItem>
                  {SEASONS.map((season) => <SelectItem key={season.value} value={season.value}>{season.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Annual farm budget" htmlFor="farm-budget" hint="₹ optional">
              <Input id="farm-budget" value={form.annual_budget} onChange={(e) => set('annual_budget', e.target.value)} inputMode="decimal" placeholder="100000" />
            </FormField>
          </FormRow>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Primary farm</p>
              <p className="text-[11px] text-muted-foreground">Used as the default when you sign in.</p>
            </div>
            <Switch checked={form.is_primary} onCheckedChange={(checked) => set('is_primary', checked)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : farm ? 'Save changes' : 'Add farm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
