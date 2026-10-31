import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Beaker,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Landmark,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Sprout,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useSoilRecords } from '@/hooks/useFarmOps';
import { soilService } from '@/services/farmOpsService';
import { soilSchema, firstError } from '@/lib/validation';
import { SOIL_TYPES } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { generateReportPdf } from '@/lib/pdf';
import { signedFileUrl, uploadUserFile } from '@/lib/supabase';
import { formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/common/states';
import { FormField, FormRow } from '@/components/common/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import type { SoilRecord } from '@/types/models';

interface SoilFormState {
  test_date: string;
  field_id: string;
  soil_type: string;
  ph: string;
  organic_carbon: string;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  lab_name: string;
  notes: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaults(record: SoilRecord | null | undefined): SoilFormState {
  return {
    test_date: record?.test_date ?? todayIso(),
    field_id: record?.field_id ?? '',
    soil_type: record?.soil_type ?? '',
    ph: record?.ph != null ? String(record.ph) : '',
    organic_carbon: record?.organic_carbon != null ? String(record.organic_carbon) : '',
    nitrogen: record?.nitrogen != null ? String(record.nitrogen) : '',
    phosphorus: record?.phosphorus != null ? String(record.phosphorus) : '',
    potassium: record?.potassium != null ? String(record.potassium) : '',
    lab_name: record?.lab_name ?? '',
    notes: record?.notes ?? '',
  };
}

function phNote(ph: number | null): { label: string; tone: 'success' | 'warning' | 'info' } | null {
  if (ph == null) return null;
  if (ph < 6) return { label: 'Acidic — many crops prefer closer to neutral. Discuss liming with your KVK or agriculture officer.', tone: 'warning' };
  if (ph > 7.5) return { label: 'Alkaline — nutrient availability can fall. Discuss gypsum or organic matter with your agriculture officer.', tone: 'warning' };
  return { label: 'Near neutral — generally suitable for most field crops.', tone: 'success' };
}

function SoilFormDialog({
  open,
  onOpenChange,
  farmId,
  fields,
  record,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  fields: { id: string; name: string }[];
  record?: SoilRecord | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = React.useState<SoilFormState>(() => defaults(record));
  const [file, setFile] = React.useState<File | null>(null);
  const [existingReport, setExistingReport] = React.useState(record?.report_url ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(defaults(record));
      setExistingReport(record?.report_url ?? '');
      setFile(null);
      setError(null);
    }
  }, [open, record]);

  const set = <K extends keyof SoilFormState>(key: K, value: SoilFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = soilSchema.safeParse(form);
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    try {
      let reportUrl = existingReport;
      if (file) {
        if (!user) throw new Error('Please sign in to upload a report.');
        reportUrl = await uploadUserFile('soil-reports', user.id, file, 'soil-');
      }
      const data = parsed.data;
      const payload: Partial<SoilRecord> = {
        farm_id: farmId,
        field_id: data.field_id ?? null,
        test_date: data.test_date ?? null,
        soil_type: data.soil_type ?? null,
        ph: data.ph ?? null,
        organic_carbon: data.organic_carbon ?? null,
        nitrogen: data.nitrogen ?? null,
        phosphorus: data.phosphorus ?? null,
        potassium: data.potassium ?? null,
        lab_name: data.lab_name ?? null,
        notes: data.notes ?? null,
        report_url: reportUrl || null,
      };
      if (record) await soilService.update(record.id, payload);
      else await soilService.create(payload);
      toast.success(record ? 'Soil record updated.' : 'Soil test recorded.');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this soil record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {record ? 'Edit soil test' : 'Add a soil test'}
          </DialogTitle>
          <DialogDescription>
            Enter the values exactly as your laboratory reported them. Units vary by lab, so keep the report attached for reference.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <FormRow>
            <FormField label="Test date" htmlFor="soil-date" required>
              <Input id="soil-date" type="date" value={form.test_date} onChange={(event) => set('test_date', event.target.value)} />
            </FormField>
            <FormField label="Field" htmlFor="soil-field" hint="Optional">
              <Select value={form.field_id || 'none'} onValueChange={(value) => set('field_id', value === 'none' ? '' : value)}>
                <SelectTrigger id="soil-field"><SelectValue placeholder="Whole farm" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Whole farm</SelectItem>
                  {fields.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Soil type" htmlFor="soil-type">
              <Select value={form.soil_type || 'none'} onValueChange={(value) => set('soil_type', value === 'none' ? '' : value)}>
                <SelectTrigger id="soil-type"><SelectValue placeholder="As identified by the lab" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {SOIL_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="pH" htmlFor="soil-ph" hint="0 – 14">
              <Input id="soil-ph" value={form.ph} onChange={(event) => set('ph', event.target.value)} inputMode="decimal" placeholder="e.g. 6.8" />
            </FormField>
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Organic carbon" htmlFor="soil-oc" hint="As reported">
              <Input id="soil-oc" value={form.organic_carbon} onChange={(event) => set('organic_carbon', event.target.value)} inputMode="decimal" placeholder="e.g. 0.62" />
            </FormField>
            <FormField label="Nitrogen (N)" htmlFor="soil-n" hint="As reported">
              <Input id="soil-n" value={form.nitrogen} onChange={(event) => set('nitrogen', event.target.value)} inputMode="decimal" placeholder="e.g. 280" />
            </FormField>
            <FormField label="Phosphorus (P)" htmlFor="soil-p" hint="As reported">
              <Input id="soil-p" value={form.phosphorus} onChange={(event) => set('phosphorus', event.target.value)} inputMode="decimal" placeholder="e.g. 22" />
            </FormField>
            <FormField label="Potassium (K)" htmlFor="soil-k" hint="As reported">
              <Input id="soil-k" value={form.potassium} onChange={(event) => set('potassium', event.target.value)} inputMode="decimal" placeholder="e.g. 310" />
            </FormField>
          </div>

          <FormRow>
            <FormField label="Laboratory name" htmlFor="soil-lab">
              <Input id="soil-lab" value={form.lab_name} onChange={(event) => set('lab_name', event.target.value)} placeholder="e.g. District Soil Testing Laboratory" />
            </FormField>
            <FormField label="Report file (PDF or image)" htmlFor="soil-file" hint={existingReport ? 'A report is already attached' : 'Optional'}>
              <Input
                id="soil-file"
                type="file"
                accept="application/pdf,image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="cursor-pointer text-xs"
              />
            </FormField>
          </FormRow>

          <FormField label="Notes" htmlFor="soil-notes">
            <Textarea id="soil-notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} rows={2} placeholder="Sampling depth, lab remarks, recommendations given" />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : record ? 'Save changes' : 'Add soil test'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SoilPage() {
  const { farm, farmId, fields } = useWorkspace();
  const queryClient = useQueryClient();
  const recordsQuery = useSoilRecords(farmId);
  const [dialog, setDialog] = React.useState<{ open: boolean; record?: SoilRecord | null }>({ open: false });
  const [deleting, setDeleting] = React.useState<SoilRecord | null>(null);

  const records = recordsQuery.data ?? [];
  const latest = records[0] ?? null;
  const fieldNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const field of fields) map[field.id] = field.name;
    return map;
  }, [fields]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['soil', farmId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await soilService.remove(deleting.id);
      await invalidate();
      toast.success('Soil record deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this soil record.');
    }
  };

  const openReport = async (record: SoilRecord) => {
    if (!record.report_url) return;
    const url = await signedFileUrl('soil-reports', record.report_url);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.error('The report could not be opened. Check your connection and try again.');
  };

  const exportCsv = () => {
    downloadCsv(`farmdesk-soil-tests-${todayIso()}`, records, [
      { key: 'test_date', label: 'Test date' },
      { key: 'field_id', label: 'Field', format: (row) => fieldNames[row.field_id ?? ''] ?? 'Whole farm' },
      { key: 'soil_type', label: 'Soil type' },
      { key: 'ph', label: 'pH' },
      { key: 'organic_carbon', label: 'Organic carbon' },
      { key: 'nitrogen', label: 'Nitrogen' },
      { key: 'phosphorus', label: 'Phosphorus' },
      { key: 'potassium', label: 'Potassium' },
      { key: 'lab_name', label: 'Laboratory' },
      { key: 'notes', label: 'Notes' },
    ]);
    toast.success('Soil test records exported to CSV.');
  };

  const exportPdf = () => {
    generateReportPdf({
      title: 'Soil test records',
      subtitle: `${farm?.name ?? 'Farm'} · exported ${new Date().toLocaleDateString('en-IN')}`,
      fileName: `farmdesk-soil-tests-${todayIso()}`,
      summary: [
        { label: 'Tests recorded', value: formatNumber(records.length) },
        { label: 'Latest test', value: latest?.test_date ? formatDate(latest.test_date) : '—' },
        { label: 'Latest pH', value: latest?.ph != null ? formatNumber(latest.ph, 2) : '—' },
        { label: 'Organic carbon', value: latest?.organic_carbon != null ? formatNumber(latest.organic_carbon, 2) : '—' },
      ],
      sections: [
        {
          heading: 'Soil test history',
          columns: ['Date', 'Field', 'Soil type', 'pH', 'OC', 'N', 'P', 'K', 'Laboratory'],
          rows: records.map((record) => [
            record.test_date ?? '—',
            fieldNames[record.field_id ?? ''] ?? 'Whole farm',
            record.soil_type ?? '—',
            record.ph ?? '—',
            record.organic_carbon ?? '—',
            record.nitrogen ?? '—',
            record.phosphorus ?? '—',
            record.potassium ?? '—',
            record.lab_name ?? '—',
          ]),
        },
      ],
      notes: [
        'Values are copied from the soil test reports you entered. Units and interpretation methods differ between laboratories.',
        'FarmDesk does not recommend fertiliser doses. Discuss the report with your KVK or agriculture officer.',
      ],
    });
  };

  if (!farmId) {
    return (
      <div>
        <PageHeader title="Soil management" subtitle="Keep lab soil tests and reports with your farm" icon={Landmark} />
        <EmptyState
          icon={Landmark}
          title="Add a farm first"
          description="Soil tests belong to a farm. Add your farm to store soil records and reports."
          action={<Button asChild><Link to="/farms"><Plus className="h-4 w-4" /> Add farm</Link></Button>}
        />
      </div>
    );
  }

  const latestPhNote = phNote(latest?.ph ?? null);

  return (
    <div>
      <PageHeader
        title="Soil management"
        subtitle="Store your soil test results and laboratory reports, and track how your soil changes over time."
        icon={Landmark}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!records.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={!records.length}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" onClick={() => setDialog({ open: true, record: null })}>
              <Plus className="h-3.5 w-3.5" /> Add soil test
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tests recorded"
          value={formatNumber(records.length)}
          icon={Beaker}
          tone="soil"
          hint={latest?.test_date ? `Latest on ${formatDate(latest.test_date)}` : 'Add your first lab report'}
        />
        <StatCard label="Latest pH" value={latest?.ph != null ? formatNumber(latest.ph, 2) : '—'} icon={FlaskConical} tone="green" hint="From the most recent test you entered" />
        <StatCard label="Organic carbon" value={latest?.organic_carbon != null ? formatNumber(latest.organic_carbon, 2) : '—'} icon={Sprout} tone="amber" hint="As reported by your laboratory" />
        <StatCard
          label="Nitrogen / P / K"
          value={
            latest
              ? [latest.nitrogen, latest.phosphorus, latest.potassium].map((value) => (value != null ? formatNumber(value, 0) : '—')).join(' / ')
              : '—'
          }
          icon={Landmark}
          tone="sky"
          hint="Latest reported values, in your laboratory's units"
        />
      </div>

      {latestPhNote ? (
        <Notice tone={latestPhNote.tone} title="General pH guidance" className="mt-4">
          {latestPhNote.label} This is general reference guidance, not a fertiliser prescription.
        </Notice>
      ) : null}

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Soil test history</CardTitle>
          <CardDescription>
            Values are shown exactly as entered. Always keep the original laboratory report for interpretation and units.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recordsQuery.isLoading ? (
            <LoadingBlock rows={3} />
          ) : recordsQuery.error ? (
            <ErrorState message={(recordsQuery.error as Error).message} onRetry={() => void recordsQuery.refetch()} />
          ) : records.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test date</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead className="hidden sm:table-cell">Soil type</TableHead>
                    <TableHead>pH</TableHead>
                    <TableHead className="hidden md:table-cell">OC</TableHead>
                    <TableHead className="hidden md:table-cell">N</TableHead>
                    <TableHead className="hidden md:table-cell">P</TableHead>
                    <TableHead className="hidden md:table-cell">K</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap text-xs">{record.test_date ? formatDate(record.test_date) : 'Date not set'}</TableCell>
                      <TableCell className="text-xs">{fieldNames[record.field_id ?? ''] ?? 'Whole farm'}</TableCell>
                      <TableCell className="hidden text-xs sm:table-cell">{record.soil_type ?? '—'}</TableCell>
                      <TableCell className="text-xs font-medium">{record.ph != null ? formatNumber(record.ph, 2) : '—'}</TableCell>
                      <TableCell className="hidden text-xs md:table-cell">{record.organic_carbon != null ? formatNumber(record.organic_carbon, 2) : '—'}</TableCell>
                      <TableCell className="hidden text-xs md:table-cell">{record.nitrogen != null ? formatNumber(record.nitrogen, 0) : '—'}</TableCell>
                      <TableCell className="hidden text-xs md:table-cell">{record.phosphorus != null ? formatNumber(record.phosphorus, 0) : '—'}</TableCell>
                      <TableCell className="hidden text-xs md:table-cell">{record.potassium != null ? formatNumber(record.potassium, 0) : '—'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          {record.report_url ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Open laboratory report" onClick={() => void openReport(record)}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit soil test" onClick={() => setDialog({ open: true, record })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Delete soil test" onClick={() => setDeleting(record)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Beaker}
              title="No soil tests recorded"
              description="Add the results from your most recent soil test. A lab report gives far better guidance than a guess."
              action={<Button size="sm" onClick={() => setDialog({ open: true, record: null })}><Plus className="h-3.5 w-3.5" /> Add soil test</Button>}
            />
          )}
        </CardContent>
      </Card>

      {latest?.report_url ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" /> The latest test has a laboratory report attached.
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void openReport(latest)}>Open it</Button>
        </p>
      ) : null}

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        FarmDesk stores soil test values and reports. It does not replace laboratory analysis or your agriculture officer's advice.
      </p>

      <SoilFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, record: open ? dialog.record : null })}
        farmId={farmId}
        fields={fields}
        record={dialog.record}
        onSaved={() => void invalidate()}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete this soil record?"
        description="This removes the test values and any attached laboratory report. This cannot be undone."
        confirmLabel="Delete record"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
