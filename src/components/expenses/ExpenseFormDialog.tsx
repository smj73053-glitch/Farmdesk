import * as React from 'react';
import { AlertCircle, Loader2, Paperclip, Receipt, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useOfflineWrite } from '@/hooks/useOffline';
import { useFarmCrops } from '@/hooks/useAgriculture';
import { expenseSchema, firstError } from '@/lib/validation';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants';
import { uploadUserFile } from '@/lib/supabase';
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
import type { Expense, Farm } from '@/types/models';

interface ExpenseFormState {
  farm_id: string;
  farm_crop_id: string;
  category: string;
  amount: string;
  expense_date: string;
  description: string;
  payment_method: string;
  vendor: string;
  notes: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaults(expense: Expense | null | undefined, farmId: string, initialCropId = ''): ExpenseFormState {
  return {
    farm_id: expense?.farm_id ?? farmId,
    farm_crop_id: expense?.farm_crop_id ?? initialCropId,
    category: expense?.category ?? 'seeds',
    amount: expense != null ? String(expense.amount) : '',
    expense_date: expense?.expense_date ?? today(),
    description: expense?.description ?? '',
    payment_method: expense?.payment_method ?? 'Cash',
    vendor: expense?.vendor ?? '',
    notes: expense?.notes ?? '',
  };
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  farms,
  currentFarmId,
  expense,
  initialCropId = '',
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farms: Farm[];
  currentFarmId: string;
  expense?: Expense | null;
  initialCropId?: string;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { write, online } = useOfflineWrite('expenses');
  const [form, setForm] = React.useState<ExpenseFormState>(() => defaults(expense, currentFarmId));
  const [receiptPath, setReceiptPath] = React.useState<string>(expense?.receipt_url ?? '');
  const [file, setFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const crops = useFarmCrops(form.farm_id || null);

  React.useEffect(() => {
    if (open) {
      setForm(defaults(expense, currentFarmId, initialCropId));
      setReceiptPath(expense?.receipt_url ?? '');
      setFile(null);
      setError(null);
    }
  }, [open, expense, currentFarmId, initialCropId]);

  const set = <K extends keyof ExpenseFormState>(key: K, value: ExpenseFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = expenseSchema.safeParse(form);
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    try {
      let nextReceiptPath = receiptPath;
      if (file) {
        if (!online) {
          toast.info('Receipt will not be uploaded while offline. The expense itself is saved and synced.');
        } else if (user) {
          nextReceiptPath = await uploadUserFile('receipts', user.id, file, 'expense-');
        }
      }

      const data = parsed.data;
      const payload: Record<string, unknown> = {
        farm_id: data.farm_id,
        farm_crop_id: data.farm_crop_id ?? null,
        category: data.category,
        amount: data.amount,
        expense_date: data.expense_date,
        description: data.description ?? null,
        payment_method: data.payment_method ?? null,
        vendor: data.vendor ?? null,
        notes: data.notes ?? null,
        receipt_url: nextReceiptPath || null,
        currency: 'INR',
      };

      const result = expense
        ? await write('update', payload, expense.id, expense.updated_at)
        : await write('insert', payload);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);

      if (result.queued) {
        toast.success('Expense saved offline. It will sync when you reconnect.');
      } else {
        toast.success(expense ? 'Expense updated.' : 'Expense added.');
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {expense ? 'Edit expense' : 'Record an expense'}
          </DialogTitle>
          <DialogDescription>
            Every figure here is what you enter. FarmDesk never estimates an expense you did not record.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <FormRow>
            <FormField label="Farm" htmlFor="expense-farm" required>
              <Select
                value={form.farm_id}
                onValueChange={(value) => {
                  setForm((current) => ({ ...current, farm_id: value, farm_crop_id: '' }));
                }}
              >
                <SelectTrigger id="expense-farm"><SelectValue placeholder="Select farm" /></SelectTrigger>
                <SelectContent>
                  {farms.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Link to crop" htmlFor="expense-crop" hint="Optional, improves crop profit">
              <Select value={form.farm_crop_id || 'none'} onValueChange={(value) => set('farm_crop_id', value === 'none' ? '' : value)}>
                <SelectTrigger id="expense-crop"><SelectValue placeholder="No crop" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No crop</SelectItem>
                  {(crops.data ?? []).map((crop) => (
                    <SelectItem key={crop.id} value={crop.id}>
                      {crop.crop?.name ?? 'Crop'}{crop.variety ? ` · ${crop.variety}` : ''}{crop.status !== 'active' ? ' (completed)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Category" htmlFor="expense-category" required>
              <Select value={form.category} onValueChange={(value) => set('category', value)}>
                <SelectTrigger id="expense-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Amount (₹)" htmlFor="expense-amount" required>
              <Input id="expense-amount" value={form.amount} onChange={(e) => set('amount', e.target.value)} inputMode="decimal" placeholder="12500" autoFocus />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Date" htmlFor="expense-date" required>
              <Input id="expense-date" type="date" value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)} />
            </FormField>
            <FormField label="Payment method" htmlFor="expense-payment">
              <Select value={form.payment_method || 'none'} onValueChange={(value) => set('payment_method', value === 'none' ? '' : value)}>
                <SelectTrigger id="expense-payment"><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {PAYMENT_METHODS.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </FormRow>

          <FormField label="Vendor / shop" htmlFor="expense-vendor">
            <Input id="expense-vendor" value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="e.g. Krishi Seva Kendra" />
          </FormField>

          <FormField label="Description" htmlFor="expense-description">
            <Input id="expense-description" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. 2 bags DAP for soybean" />
          </FormField>

          <FormField label="Notes" htmlFor="expense-notes">
            <Textarea id="expense-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything you want to remember about this cost" rows={2} />
          </FormField>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium"><Paperclip className="h-4 w-4 text-primary" /> Receipt (optional)</p>
            <p className="text-[11px] text-muted-foreground">
              JPEG, PNG, WebP or PDF up to 10 MB. Stored privately in your account. {online ? '' : 'Uploading needs a connection; save the expense now and attach the receipt later.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="h-auto max-w-sm cursor-pointer py-1.5 text-xs"
              />
              {receiptPath ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => { setReceiptPath(''); setFile(null); }}
                >
                  <X className="h-3 w-3" /> Remove saved receipt
                </Button>
              ) : null}
            </div>
            {receiptPath ? <p className="mt-1 text-[11px] text-emerald-700">A receipt is already attached to this expense.</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
