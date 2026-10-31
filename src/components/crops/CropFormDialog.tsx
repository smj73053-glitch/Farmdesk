import * as React from 'react';
import { AlertCircle, Leaf, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCropReference, useCropVarieties } from '@/hooks/useAgriculture';
import { cropService, stageFromSowingDate } from '@/services/cropService';
import { farmCropSchema, firstError } from '@/lib/validation';
import { AREA_UNITS } from '@/lib/constants';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField, FormRow } from '@/components/common/FormField';
import type { AreaUnit, FarmCrop, FarmField } from '@/types/models';

interface CropFormState {
  crop_id: string;
  field_id: string;
  variety: string;
  sowing_date: string;
  expected_harvest_date: string;
  area_planted: string;
  area_unit: AreaUnit;
  seed_quantity: string;
  seed_cost: string;
  notes: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaults(record: FarmCrop | null | undefined, initialCropId: string, defaultUnit: AreaUnit): CropFormState {
  return {
    crop_id: record?.crop_id ?? initialCropId ?? '',
    field_id: record?.field_id ?? '',
    variety: record?.variety ?? '',
    sowing_date: record?.sowing_date ?? today(),
    expected_harvest_date: record?.expected_harvest_date ?? '',
    area_planted: record?.area_planted != null ? String(record.area_planted) : '',
    area_unit: record?.area_unit ?? defaultUnit,
    seed_quantity: record?.seed_quantity != null ? String(record.seed_quantity) : '',
    seed_cost: record?.seed_cost != null ? String(record.seed_cost) : '',
    notes: record?.notes ?? '',
  };
}

export function CropFormDialog({
  open,
  onOpenChange,
  farmId,
  fields,
  defaultAreaUnit = 'acres',
  initialCropId = '',
  cropRecord,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  fields: FarmField[];
  defaultAreaUnit?: AreaUnit;
  initialCropId?: string;
  cropRecord?: FarmCrop | null;
  onSaved?: (crop: FarmCrop) => void;
}) {
  const queryClient = useQueryClient();
  const cropsQuery = useCropReference();
  const [form, setForm] = React.useState<CropFormState>(() => defaults(cropRecord, initialCropId, defaultAreaUnit));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const varieties = useCropVarieties(form.crop_id || null);

  React.useEffect(() => {
    if (open) {
      setForm(defaults(cropRecord, initialCropId, defaultAreaUnit));
      setError(null);
    }
  }, [open, cropRecord, initialCropId, defaultAreaUnit]);

  const selectedCrop = (cropsQuery.data ?? []).find((crop) => crop.id === form.crop_id) ?? null;
  const duration = selectedCrop?.growing_duration_days ?? null;

  const set = <K extends keyof CropFormState>(key: K, value: CropFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const chooseCrop = (cropId: string) => {
    const crop = (cropsQuery.data ?? []).find((item) => item.id === cropId);
    setForm((current) => {
      const expected = current.expected_harvest_date
        ? current.expected_harvest_date
        : crop?.growing_duration_days && current.sowing_date
          ? addDays(current.sowing_date, crop.growing_duration_days)
          : '';
      return { ...current, crop_id: cropId, variety: '', expected_harvest_date: expected };
    });
  };

  const chooseSowingDate = (value: string) => {
    setForm((current) => {
      const expected = current.expected_harvest_date
        ? current.expected_harvest_date
        : duration && value
          ? addDays(value, duration)
          : '';
      return { ...current, sowing_date: value, expected_harvest_date: expected };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = farmCropSchema.safeParse(form);
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const data = parsed.data;
      const payload: Partial<FarmCrop> = {
        farm_id: farmId,
        crop_id: data.crop_id,
        field_id: data.field_id ?? null,
        variety: data.variety ?? null,
        sowing_date: data.sowing_date ?? null,
        expected_harvest_date: data.expected_harvest_date ?? null,
        area_planted: data.area_planted ?? null,
        area_unit: data.area_unit,
        seed_quantity: data.seed_quantity ?? null,
        seed_cost: data.seed_cost ?? null,
        notes: data.notes ?? null,
      };
      if (!cropRecord) {
        payload.current_stage = stageFromSowingDate(data.sowing_date ?? null, duration, 'land_preparation');
        payload.status = 'active';
      }
      const saved = cropRecord
        ? await cropService.updateFarmCrop(cropRecord.id, payload)
        : await cropService.createFarmCrop(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['farm-crops', farmId] }),
        queryClient.invalidateQueries({ queryKey: ['farm-crop', saved.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      toast.success(cropRecord ? 'Crop record updated.' : 'Crop added to your farm.');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this crop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            {cropRecord ? 'Edit crop record' : 'Add a crop'}
          </DialogTitle>
          <DialogDescription>
            Record what you actually planted. Sowing date and area drive the stage timeline and crop-level profit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <FormRow>
            <FormField label="Crop" htmlFor="crop-ref" required>
              <Select value={form.crop_id || 'none'} onValueChange={(value) => value !== 'none' && chooseCrop(value)}>
                <SelectTrigger id="crop-ref"><SelectValue placeholder="Choose a crop" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a crop</SelectItem>
                  {(cropsQuery.data ?? []).map((crop) => (
                    <SelectItem key={crop.id} value={crop.id}>
                      {crop.name}{crop.name_mr ? ` · ${crop.name_mr}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Field / plot" htmlFor="crop-field" hint="Optional">
              <Select value={form.field_id || 'none'} onValueChange={(value) => set('field_id', value === 'none' ? '' : value)}>
                <SelectTrigger id="crop-field"><SelectValue placeholder="Whole farm" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Whole farm</SelectItem>
                  {fields.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Variety" htmlFor="crop-variety" hint={duration ? `Reference duration ${duration} days` : 'Optional'}>
              <Input id="crop-variety" value={form.variety} onChange={(e) => set('variety', e.target.value)} placeholder="e.g. JS-335" list="variety-options" />
              <datalist id="variety-options">
                {(varieties.data ?? []).map((variety) => <option key={variety.id} value={variety.name} />)}
              </datalist>
            </FormField>
            <FormField label="Area planted" htmlFor="crop-area">
              <div className="flex gap-2">
                <Input id="crop-area" value={form.area_planted} onChange={(e) => set('area_planted', e.target.value)} inputMode="decimal" placeholder="1.5" />
                <Select value={form.area_unit} onValueChange={(value) => set('area_unit', value as AreaUnit)}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AREA_UNITS.map((unit) => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Sowing date" htmlFor="crop-sowing">
              <Input id="crop-sowing" type="date" value={form.sowing_date} onChange={(e) => chooseSowingDate(e.target.value)} />
            </FormField>
            <FormField label="Expected harvest" htmlFor="crop-harvest" hint={duration ? 'Auto-filled from reference duration' : 'Optional'}>
              <Input id="crop-harvest" type="date" value={form.expected_harvest_date} onChange={(e) => set('expected_harvest_date', e.target.value)} />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Seed quantity" htmlFor="crop-seed" hint="kg">
              <Input id="crop-seed" value={form.seed_quantity} onChange={(e) => set('seed_quantity', e.target.value)} inputMode="decimal" placeholder="e.g. 30" />
            </FormField>
            <FormField label="Seed cost (₹)" htmlFor="crop-seed-cost">
              <Input id="crop-seed-cost" value={form.seed_cost} onChange={(e) => set('seed_cost', e.target.value)} inputMode="decimal" placeholder="e.g. 4500" />
            </FormField>
          </FormRow>

          {selectedCrop ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{selectedCrop.name} reference</p>
              <p className="mt-1">
                {selectedCrop.growing_duration_days ? `${selectedCrop.growing_duration_days} days · ` : ''}
                {selectedCrop.water_requirement ? `${selectedCrop.water_requirement} water · ` : ''}
                {selectedCrop.typical_yield_per_acre != null ? `typical ${selectedCrop.typical_yield_per_acre} ${selectedCrop.yield_unit ?? ''}/acre` : 'Yield reference not recorded'}
              </p>
              <p className="mt-1">Reference values are general guidance, not a promise for your field.</p>
            </div>
          ) : null}

          <FormField label="Notes" htmlFor="crop-notes">
            <Textarea id="crop-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Seed source, plot condition, anything to remember" />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.crop_id}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : cropRecord ? 'Save changes' : 'Add crop'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
