import * as React from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { farmService } from '@/services/farmService';
import { fieldSchema, firstError } from '@/lib/validation';
import { AREA_UNITS, SOIL_TYPES, WATER_SOURCES } from '@/lib/constants';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField, FormRow } from '@/components/common/FormField';
import type { AreaUnit, FarmField } from '@/types/models';

export function FieldFormDialog({
  open,
  onOpenChange,
  farmId,
  field,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  field?: FarmField | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    name: '',
    area: '',
    area_unit: 'acres' as AreaUnit,
    soil_type: '',
    soil_ph: '',
    irrigation_available: false,
    water_source: '',
    notes: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: field?.name ?? '',
      area: field?.area != null ? String(field.area) : '',
      area_unit: field?.area_unit ?? 'acres',
      soil_type: field?.soil_type ?? '',
      soil_ph: field?.soil_ph != null ? String(field.soil_ph) : '',
      irrigation_available: field?.irrigation_available ?? false,
      water_source: field?.water_source ?? '',
      notes: field?.notes ?? '',
    });
  }, [open, field]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = fieldSchema.safeParse(form);
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const data = parsed.data;
      const payload = {
        farm_id: farmId,
        name: data.name,
        area: data.area ?? null,
        area_unit: data.area_unit,
        soil_type: data.soil_type ?? null,
        soil_ph: data.soil_ph ?? null,
        irrigation_available: data.irrigation_available,
        water_source: data.water_source ?? null,
        notes: data.notes ?? null,
      };
      if (field) await farmService.updateField(field.id, payload);
      else await farmService.createField(payload);
      await queryClient.invalidateQueries({ queryKey: ['farm-fields', farmId] });
      toast.success(field ? 'Field updated.' : 'Field added.');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this field.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> {field ? 'Edit field' : 'Add a field'}</DialogTitle>
          <DialogDescription>Fields help you allocate crops and soil tests inside a farm. All values are optional except the name.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}
          <FormField label="Field name" htmlFor="field-name" required>
            <Input id="field-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. North plot" autoFocus />
          </FormField>
          <FormRow>
            <FormField label="Area" htmlFor="field-area"><Input id="field-area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} inputMode="decimal" /></FormField>
            <FormField label="Unit" htmlFor="field-unit">
              <Select value={form.area_unit} onValueChange={(value) => setForm({ ...form, area_unit: value as AreaUnit })}>
                <SelectTrigger id="field-unit"><SelectValue /></SelectTrigger>
                <SelectContent>{AREA_UNITS.map((unit) => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Soil type" htmlFor="field-soil">
              <Select value={form.soil_type || 'none'} onValueChange={(value) => setForm({ ...form, soil_type: value === 'none' ? '' : value })}>
                <SelectTrigger id="field-soil"><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {SOIL_TYPES.map((soil) => <SelectItem key={soil} value={soil}>{soil}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Soil pH" htmlFor="field-ph"><Input id="field-ph" value={form.soil_ph} onChange={(e) => setForm({ ...form, soil_ph: e.target.value })} inputMode="decimal" /></FormField>
          </FormRow>
          <FormRow>
            <FormField label="Water source" htmlFor="field-water">
              <Select value={form.water_source || 'none'} onValueChange={(value) => setForm({ ...form, water_source: value === 'none' ? '' : value })}>
                <SelectTrigger id="field-water"><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {WATER_SOURCES.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Irrigation</span>
              <Switch checked={form.irrigation_available} onCheckedChange={(checked) => setForm({ ...form, irrigation_available: checked })} />
            </div>
          </FormRow>
          <FormField label="Notes" htmlFor="field-notes">
            <Textarea id="field-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this plot" />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? 'Saving…' : 'Save field'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
