import * as React from 'react';
import { AlertCircle, ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineWrite } from '@/hooks/useOffline';
import { activitySchema, firstError } from '@/lib/validation';
import { ACTIVITY_TYPES } from '@/lib/constants';
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
import type { CropActivity } from '@/types/models';

interface ActivityFormState {
  activity_type: string;
  activity_date: string;
  description: string;
  quantity: string;
  unit: string;
  cost: string;
  notes: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaults(activity: CropActivity | null | undefined): ActivityFormState {
  return {
    activity_type: activity?.activity_type ?? 'irrigation',
    activity_date: activity?.activity_date ?? today(),
    description: activity?.description ?? '',
    quantity: activity?.quantity != null ? String(activity.quantity) : '',
    unit: activity?.unit ?? '',
    cost: activity?.cost != null ? String(activity.cost) : '',
    notes: activity?.notes ?? '',
  };
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  farmCropId,
  activity,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmCropId: string;
  activity?: CropActivity | null;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const { write, online } = useOfflineWrite('crop_activities');
  const [form, setForm] = React.useState<ActivityFormState>(() => defaults(activity));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(defaults(activity));
      setError(null);
    }
  }, [open, activity]);

  const set = <K extends keyof ActivityFormState>(key: K, value: ActivityFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = activitySchema.safeParse({ ...form, farm_crop_id: farmCropId });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const data = parsed.data;
      const payload: Record<string, unknown> = {
        farm_crop_id: data.farm_crop_id,
        activity_type: data.activity_type,
        activity_date: data.activity_date,
        description: data.description ?? null,
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        cost: data.cost ?? null,
        notes: data.notes ?? null,
      };
      const result = activity
        ? await write('update', payload, activity.id, activity.updated_at ?? null)
        : await write('insert', payload);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['activities', farmCropId] }),
        queryClient.invalidateQueries({ queryKey: ['farm-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);

      if (result.queued) {
        toast.success('Activity saved offline. It will sync when you reconnect.');
      } else {
        toast.success(activity ? 'Activity updated.' : 'Activity logged.');
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this activity.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            {activity ? 'Edit activity' : 'Log a field activity'}
          </DialogTitle>
          <DialogDescription>
            {online
              ? 'Record what you actually did in the field. Costs here are activity notes; record money in Expenses for financial totals.'
              : 'You are offline. The activity is saved on this device and synced when you reconnect.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <FormRow>
            <FormField label="Activity" htmlFor="activity-type" required>
              <Select value={form.activity_type} onValueChange={(value) => set('activity_type', value)}>
                <SelectTrigger id="activity-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="activity-date" required>
              <Input id="activity-date" type="date" value={form.activity_date} onChange={(e) => set('activity_date', e.target.value)} />
            </FormField>
          </FormRow>

          <FormField label="What did you do?" htmlFor="activity-description">
            <Input
              id="activity-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="e.g. Second irrigation, 2 hours"
            />
          </FormField>

          <FormRow>
            <FormField label="Quantity" htmlFor="activity-quantity">
              <Input id="activity-quantity" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} inputMode="decimal" placeholder="e.g. 2" />
            </FormField>
            <FormField label="Unit" htmlFor="activity-unit">
              <Input id="activity-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} list="activity-unit-options" placeholder="hours / kg / litre" />
              <datalist id="activity-unit-options">
                <option value="hours" />
                <option value="kg" />
                <option value="litre" />
                <option value="bag" />
                <option value="acre" />
              </datalist>
            </FormField>
          </FormRow>

          <FormField label="Cost noted (₹)" htmlFor="activity-cost" hint="Optional; use Expenses for the ledger">
            <Input id="activity-cost" value={form.cost} onChange={(e) => set('cost', e.target.value)} inputMode="decimal" placeholder="e.g. 800" />
          </FormField>

          <FormField label="Notes" htmlFor="activity-notes">
            <Textarea id="activity-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Weather, observations, product name or dosage" />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : activity ? 'Save changes' : 'Log activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
