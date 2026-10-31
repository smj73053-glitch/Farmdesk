import * as React from 'react';
import { AlertCircle, Calculator, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineWrite } from '@/hooks/useOffline';
import { useFarmCrops } from '@/hooks/useAgriculture';
import { incomeSchema, firstError } from '@/lib/validation';
import { INCOME_CATEGORIES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
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
import type { Farm, IncomeRecord } from '@/types/models';

interface IncomeFormState {
  farm_id: string;
  farm_crop_id: string;
  category: string;
  amount: string;
  income_date: string;
  description: string;
  quantity: string;
  unit: string;
  price_per_unit: string;
  buyer: string;
  market_name: string;
  notes: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaults(record: IncomeRecord | null | undefined, farmId: string, initialCropId = ''): IncomeFormState {
  return {
    farm_id: record?.farm_id ?? farmId,
    farm_crop_id: record?.farm_crop_id ?? initialCropId,
    category: record?.category ?? 'crop_sale',
    amount: record != null ? String(record.amount) : '',
    income_date: record?.income_date ?? today(),
    description: record?.description ?? '',
    quantity: record?.quantity != null ? String(record.quantity) : '',
    unit: record?.unit ?? 'quintal',
    price_per_unit: record?.price_per_unit != null ? String(record.price_per_unit) : '',
    buyer: record?.buyer ?? '',
    market_name: record?.market_name ?? '',
    notes: record?.notes ?? '',
  };
}

export function IncomeFormDialog({
  open,
  onOpenChange,
  farms,
  currentFarmId,
  record,
  initialCropId = '',
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farms: Farm[];
  currentFarmId: string;
  record?: IncomeRecord | null;
  initialCropId?: string;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const { write } = useOfflineWrite('income_records');
  const [form, setForm] = React.useState<IncomeFormState>(() => defaults(record, currentFarmId));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const crops = useFarmCrops(form.farm_id || null);

  React.useEffect(() => {
    if (open) {
      setForm(defaults(record, currentFarmId, initialCropId));
      setError(null);
    }
  }, [open, record, currentFarmId, initialCropId]);

  const set = <K extends keyof IncomeFormState>(key: K, value: IncomeFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const quantity = Number(form.quantity);
  const price = Number(form.price_per_unit);
  const computed = Number.isFinite(quantity) && Number.isFinite(price) && quantity > 0 && price > 0
    ? quantity * price
    : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const candidate = {
      ...form,
      amount: form.amount.trim() === '' && computed != null ? String(computed) : form.amount,
    };
    const parsed = incomeSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const data = parsed.data;
      const payload: Record<string, unknown> = {
        farm_id: data.farm_id,
        farm_crop_id: data.farm_crop_id ?? null,
        category: data.category,
        amount: data.amount,
        income_date: data.income_date,
        description: data.description ?? null,
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        price_per_unit: data.price_per_unit ?? null,
        buyer: data.buyer ?? null,
        market_name: data.market_name ?? null,
        notes: data.notes ?? null,
        currency: 'INR',
      };

      const result = record
        ? await write('update', payload, record.id, record.updated_at)
        : await write('insert', payload);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['income'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);

      if (result.queued) {
        toast.success('Income record saved offline. It will sync when you reconnect.');
      } else {
        toast.success(record ? 'Income record updated.' : 'Income record added.');
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this income record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {record ? 'Edit income record' : 'Record income'}
          </DialogTitle>
          <DialogDescription>
            Record crop sales, subsidies or insurance receipts. Quantity and price are optional but make crop profit more accurate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <FormRow>
            <FormField label="Farm" htmlFor="income-farm" required>
              <Select
                value={form.farm_id}
                onValueChange={(value) => setForm((current) => ({ ...current, farm_id: value, farm_crop_id: '' }))}
              >
                <SelectTrigger id="income-farm"><SelectValue placeholder="Select farm" /></SelectTrigger>
                <SelectContent>
                  {farms.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Link to crop" htmlFor="income-crop" hint="Optional">
              <Select value={form.farm_crop_id || 'none'} onValueChange={(value) => set('farm_crop_id', value === 'none' ? '' : value)}>
                <SelectTrigger id="income-crop"><SelectValue placeholder="No crop" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No crop</SelectItem>
                  {(crops.data ?? []).map((crop) => (
                    <SelectItem key={crop.id} value={crop.id}>
                      {crop.crop?.name ?? 'Crop'}{crop.variety ? ` · ${crop.variety}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Category" htmlFor="income-category" required>
              <Select value={form.category} onValueChange={(value) => set('category', value)}>
                <SelectTrigger id="income-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCOME_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="income-date" required>
              <Input id="income-date" type="date" value={form.income_date} onChange={(e) => set('income_date', e.target.value)} />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Quantity" htmlFor="income-quantity" hint={computed != null ? `= ${formatCurrency(computed)}` : 'Optional'}>
              <Input id="income-quantity" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} inputMode="decimal" placeholder="e.g. 18" />
            </FormField>
            <FormField label="Unit" htmlFor="income-unit">
              <Input id="income-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="quintal / kg / ton" list="income-unit-options" />
              <datalist id="income-unit-options">
                <option value="quintal" />
                <option value="kg" />
                <option value="ton" />
                <option value="dozen" />
                <option value="piece" />
                <option value="litre" />
                <option value="bag" />
              </datalist>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Price per unit (₹)" htmlFor="income-price" hint="Optional">
              <Input id="income-price" value={form.price_per_unit} onChange={(e) => set('price_per_unit', e.target.value)} inputMode="decimal" placeholder="e.g. 2400" />
            </FormField>
            <FormField label="Total amount (₹)" htmlFor="income-amount" required hint={computed != null ? 'Leave blank to use quantity × price' : undefined}>
              <Input id="income-amount" value={form.amount} onChange={(e) => set('amount', e.target.value)} inputMode="decimal" placeholder="43200" />
            </FormField>
          </FormRow>

          {computed != null ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
              <Calculator className="h-3.5 w-3.5 shrink-0" />
              {form.quantity} × {formatCurrency(price)} = <strong>{formatCurrency(computed)}</strong>. Leave the total blank to record this amount.
            </div>
          ) : null}

          <FormRow>
            <FormField label="Buyer / trader" htmlFor="income-buyer">
              <Input id="income-buyer" value={form.buyer} onChange={(e) => set('buyer', e.target.value)} placeholder="e.g. Local mandi trader" />
            </FormField>
            <FormField label="Mandi / market" htmlFor="income-market">
              <Input id="income-market" value={form.market_name} onChange={(e) => set('market_name', e.target.value)} placeholder="e.g. Pune APMC" />
            </FormField>
          </FormRow>

          <FormField label="Description" htmlFor="income-description">
            <Input id="income-description" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Soybean sale, 18 quintal" />
          </FormField>

          <FormField label="Notes" htmlFor="income-notes">
            <Textarea id="income-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Sale slip number, payment status, anything useful" />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : record ? 'Save changes' : 'Add income'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
