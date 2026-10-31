import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Download,
  Droplets,
  FileText,
  Leaf,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Sprout,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useCropActivities, useFarmCrop } from '@/hooks/useAgriculture';
import { useFinanceRange } from '@/hooks/useFinance';
import { useOfflineWrite } from '@/hooks/useOffline';
import { cropService, computeStages, suggestCropTasks } from '@/services/cropService';
import { ACTIVITY_TYPES, CROP_STAGES } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { generateReportPdf } from '@/lib/pdf';
import { formatArea, toAcres } from '@/lib/units';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states';
import { ActivityFormDialog } from '@/components/crops/ActivityFormDialog';
import { CropFormDialog } from '@/components/crops/CropFormDialog';
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import { IncomeFormDialog } from '@/components/income/IncomeFormDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
import { FormField, FormRow } from '@/components/common/FormField';
import type { CropActivity, CropStage } from '@/types/models';

function stageLabel(stage: string): string {
  return CROP_STAGES.find((item) => item.value === stage)?.label ?? stage.replace(/_/g, ' ');
}

function activityLabel(type: string): string {
  return ACTIVITY_TYPES.find((item) => item.value === type)?.label ?? type;
}

function daysBetween(from: string, to = new Date()): number {
  return Math.floor((to.getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CropDetailPage() {
  const { cropId } = useParams<{ cropId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { farm, farmId, fields, farms } = useWorkspace();
  const cropQuery = useFarmCrop(cropId);
  const activitiesQuery = useCropActivities(cropId);
  const { write } = useOfflineWrite('crop_activities');
  const { write: writeTask } = useOfflineWrite('farm_tasks');

  const [activityDialog, setActivityDialog] = React.useState<{ open: boolean; activity?: CropActivity | null }>({ open: false });
  const [cropFormOpen, setCropFormOpen] = React.useState(false);
  const [deletingActivity, setDeletingActivity] = React.useState<CropActivity | null>(null);
  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [incomeOpen, setIncomeOpen] = React.useState(false);
  const [harvestOpen, setHarvestOpen] = React.useState(false);
  const [harvest, setHarvest] = React.useState({ date: todayIso(), quantity: '', unit: 'quintal' });
  const [harvestError, setHarvestError] = React.useState<string | null>(null);
  const [savingHarvest, setSavingHarvest] = React.useState(false);
  const [stageUpdating, setStageUpdating] = React.useState<CropStage | null>(null);

  const crop = cropQuery.data ?? null;
  const activities = activitiesQuery.data ?? [];
  const finance = useFinanceRange(farmId);

  const cropExpenses = React.useMemo(
    () => finance.expenses.filter((row) => row.farm_crop_id === cropId),
    [finance.expenses, cropId]
  );
  const cropIncome = React.useMemo(
    () => finance.income.filter((row) => row.farm_crop_id === cropId),
    [finance.income, cropId]
  );
  const totalExpenses = cropExpenses.reduce((sum, row) => sum + Number(row.amount), 0);
  const totalIncome = cropIncome.reduce((sum, row) => sum + Number(row.amount), 0);
  const net = totalIncome - totalExpenses;

  const stages = React.useMemo(() => {
    if (!crop) return [];
    return computeStages(
      crop.sowing_date,
      crop.crop?.growing_duration_days ?? null,
      crop.crop?.growth_stages ?? null,
      crop.current_stage
    );
  }, [crop]);

  const stageIndex = stages.findIndex((stage) => stage.stage === crop?.current_stage);
  const stageProgress = crop?.status === 'completed'
    ? 100
    : stages.length
      ? Math.round(((Math.max(0, stageIndex) + 1) / stages.length) * 100)
      : 0;

  const daysSinceSowing = crop?.sowing_date ? daysBetween(crop.sowing_date) : null;
  const daysToHarvest = crop?.expected_harvest_date ? daysBetween(crop.expected_harvest_date) * -1 : null;
  const areaAcres = crop ? toAcres(crop.area_planted, crop.area_unit) : 0;
  const costPerAcre = areaAcres > 0 ? totalExpenses / areaAcres : null;
  const suggestions = crop ? suggestCropTasks(crop) : [];
  const fieldName = crop?.field_id ? fields.find((field) => field.id === crop.field_id)?.name : null;

  const invalidate = async () => {
    if (!cropId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['farm-crop', cropId] }),
      queryClient.invalidateQueries({ queryKey: ['activities', cropId] }),
      queryClient.invalidateQueries({ queryKey: ['farm-crops', farmId] }),
      queryClient.invalidateQueries({ queryKey: ['finance'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };

  const updateStage = async (stage: CropStage) => {
    if (!crop) return;
    setStageUpdating(stage);
    try {
      await cropService.updateFarmCrop(crop.id, { current_stage: stage });
      await invalidate();
      toast.success(`Stage updated to ${stageLabel(stage)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the stage.');
    } finally {
      setStageUpdating(null);
    }
  };

  const removeActivity = async () => {
    if (!deletingActivity) return;
    try {
      const result = await write('delete', {}, deletingActivity.id);
      await invalidate();
      toast.success(result.queued ? 'Delete queued offline and will sync later.' : 'Activity deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this activity.');
    }
  };

  const saveHarvest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!crop) return;
    setHarvestError(null);
    if (!harvest.date) {
      setHarvestError('Choose the actual harvest date.');
      return;
    }
    const quantity = harvest.quantity.trim() === '' ? null : Number(harvest.quantity);
    if (quantity != null && (!Number.isFinite(quantity) || quantity < 0)) {
      setHarvestError('Harvest quantity must be a positive number.');
      return;
    }
    setSavingHarvest(true);
    try {
      await cropService.updateFarmCrop(crop.id, {
        actual_harvest_date: harvest.date,
        harvest_quantity: quantity,
        harvest_unit: quantity != null ? harvest.unit : null,
        current_stage: 'completed',
        status: 'completed',
      });
      await invalidate();
      setHarvestOpen(false);
      toast.success('Harvest recorded. The crop is now completed.');
    } catch (err) {
      setHarvestError(err instanceof Error ? err.message : 'Could not record the harvest.');
    } finally {
      setSavingHarvest(false);
    }
  };

  const addSuggestedTask = async (suggestion: { title: string; description: string; dueDate: string | null; priority: 'low' | 'medium' | 'high' }) => {
    if (!crop || !farmId) return;
    try {
      const result = await writeTask('insert', {
        farm_id: farmId,
        farm_crop_id: crop.id,
        title: suggestion.title,
        description: suggestion.description,
        due_date: suggestion.dueDate,
        priority: suggestion.priority,
        status: 'pending',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      toast.success(result.queued ? 'Task saved offline and will sync later.' : 'Task added to your reminders.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add this task.');
    }
  };

  const exportCsv = () => {
    if (!crop) return;
    downloadCsv(`farmdesk-crop-${crop.crop?.slug ?? crop.id}`, activities, [
      { key: 'activity_date', label: 'Date' },
      { key: 'activity_type', label: 'Activity', format: (row) => activityLabel(row.activity_type) },
      { key: 'description', label: 'Description' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unit', label: 'Unit' },
      { key: 'cost', label: 'Cost noted' },
      { key: 'notes', label: 'Notes' },
    ]);
    toast.success('Activity log exported to CSV.');
  };

  const exportPdf = () => {
    if (!crop) return;
    generateReportPdf({
      title: `Crop record — ${crop.crop?.name ?? 'Crop'}`,
      subtitle: `${farm?.name ?? 'Farm'}${fieldName ? ` · ${fieldName}` : ''} · exported ${new Date().toLocaleDateString('en-IN')}`,
      fileName: `farmdesk-crop-${crop.crop?.slug ?? crop.id}-${todayIso()}`,
      summary: [
        { label: 'Planted area', value: formatArea(crop.area_planted, crop.area_unit) },
        { label: 'Total expenses', value: formatCurrency(totalExpenses) },
        { label: 'Total income', value: formatCurrency(totalIncome) },
        { label: 'Net', value: formatCurrency(net) },
      ],
      sections: [
        {
          heading: 'Crop details',
          columns: ['Field', 'Value'],
          rows: [
            ['Crop', crop.crop?.name ?? 'Crop'],
            ['Variety', crop.variety ?? '—'],
            ['Field', fieldName ?? 'Whole farm'],
            ['Sowing date', crop.sowing_date ?? '—'],
            ['Expected harvest', crop.expected_harvest_date ?? '—'],
            ['Actual harvest', crop.actual_harvest_date ?? '—'],
            ['Harvest quantity', crop.harvest_quantity != null ? `${crop.harvest_quantity} ${crop.harvest_unit ?? ''}` : '—'],
            ['Current stage', stageLabel(crop.current_stage)],
            ['Status', crop.status],
          ],
        },
        {
          heading: 'Activity log',
          columns: ['Date', 'Activity', 'Description', 'Quantity', 'Cost noted'],
          rows: activities.map((row) => [
            row.activity_date,
            activityLabel(row.activity_type),
            row.description ?? '—',
            row.quantity != null ? `${row.quantity} ${row.unit ?? ''}` : '—',
            row.cost != null ? formatCurrency(row.cost) : '—',
          ]),
        },
        {
          heading: 'Linked money records',
          columns: ['Date', 'Type', 'Category', 'Amount', 'Description'],
          rows: [
            ...cropExpenses.map((row) => [row.expense_date, 'Expense', row.category, formatCurrency(row.amount), row.description ?? '—']),
            ...cropIncome.map((row) => [row.income_date, 'Income', row.category, formatCurrency(row.amount), row.description ?? '—']),
          ],
        },
      ],
      notes: [
        'Stage dates are guidance derived from your sowing date and reference crop duration, not a field observation.',
        'Only expenses and income explicitly linked to this crop are included in the crop totals.',
        'FarmDesk is planning support and does not guarantee yield, price or profit.',
      ],
    });
  };

  if (cropQuery.isLoading) {
    return <LoadingBlock rows={5} />;
  }

  if (cropQuery.error) {
    return (
      <ErrorState
        title="Could not load this crop"
        message={(cropQuery.error as Error).message}
        onRetry={() => void cropQuery.refetch()}
      />
    );
  }

  if (!crop) {
    return (
      <div>
        <PageHeader title="Crop not found" subtitle="This crop record may have been deleted." icon={Leaf} />
        <EmptyState
          icon={Leaf}
          title="Crop record not found"
          description="It may have been deleted, or it belongs to another account."
          action={<Button asChild><Link to="/crops"><ArrowLeft className="h-4 w-4" /> Back to crops</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/crops"><ArrowLeft className="h-3.5 w-3.5" /> All crops</Link>
        </Button>
      </div>

      <PageHeader
        title={`${crop.crop?.name ?? 'Crop'}${crop.variety ? ` · ${crop.variety}` : ''}`}
        subtitle={`${farm?.name ?? 'Farm'}${fieldName ? ` · ${fieldName}` : ''} · ${formatArea(crop.area_planted, crop.area_unit)}`}
        icon={Sprout}
        meta={
          <>
            <Badge variant={crop.status === 'active' ? 'success' : crop.status === 'completed' ? 'info' : 'warning'} className="capitalize">
              {crop.status}
            </Badge>
            <span>{stageLabel(crop.current_stage)}</span>
            {crop.sowing_date ? <span>· Sown {formatDate(crop.sowing_date)}</span> : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!activities.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCropFormOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            {crop.status === 'active' ? (
              <Button size="sm" onClick={() => {
                setHarvest({
                  date: crop.actual_harvest_date ?? todayIso(),
                  quantity: crop.harvest_quantity != null ? String(crop.harvest_quantity) : '',
                  unit: crop.harvest_unit ?? 'quintal',
                });
                setHarvestError(null);
                setHarvestOpen(true);
              }}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Record harvest
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Days since sowing"
          value={daysSinceSowing != null ? formatNumber(daysSinceSowing) : '—'}
          icon={CalendarDays}
          tone="sky"
          hint={crop.sowing_date ? `Sown on ${formatDate(crop.sowing_date)}` : 'Sowing date not recorded'}
        />
        <StatCard
          label="Stage progress"
          value={`${stageProgress}%`}
          icon={Leaf}
          tone="green"
          hint={`${stageLabel(crop.current_stage)} · reference timeline`}
          footer={<Progress value={stageProgress} className="h-1.5" />}
        />
        <StatCard
          label="Crop expenses"
          value={formatCurrency(totalExpenses)}
          icon={TrendingDown}
          tone="amber"
          hint={costPerAcre != null ? `${formatCurrency(costPerAcre)} per acre` : 'Link expenses to this crop for exact totals'}
        />
        <StatCard
          label="Net for this crop"
          value={formatCurrency(net)}
          icon={net >= 0 ? TrendingUp : TrendingDown}
          tone={net >= 0 ? 'green' : 'red'}
          hint={`Income ${formatCurrency(totalIncome)} against expenses ${formatCurrency(totalExpenses)}`}
        />
      </div>

      {daysToHarvest != null && crop.status === 'active' ? (
        <p className={`mt-3 text-xs ${daysToHarvest < 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
          {daysToHarvest >= 0
            ? `Expected harvest in ${daysToHarvest} day${daysToHarvest === 1 ? '' : 's'} (${formatDate(crop.expected_harvest_date!)}).`
            : `Expected harvest date was ${Math.abs(daysToHarvest)} day${Math.abs(daysToHarvest) === 1 ? '' : 's'} ago. Record the actual harvest when ready.`}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stage timeline</CardTitle>
            <CardDescription>
              Calculated from your sowing date and the crop reference duration. Set the stage as your field actually develops.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1">
              {stages.map((stage) => {
                const isCurrent = stage.stage === crop.current_stage && crop.status !== 'completed';
                const done = stage.status === 'done' || (crop.status === 'completed' && stage.stage !== 'completed');
                return (
                  <li
                    key={stage.stage}
                    className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                      isCurrent ? 'border-primary/40 bg-primary/5' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        done ? 'bg-emerald-100 text-emerald-700' : isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {stageLabel(stage.stage)}
                          {isCurrent ? <Badge className="ml-2 px-1.5 py-0 text-[10px]">Current</Badge> : null}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {stage.startDate
                            ? `${formatDate(stage.startDate)}${stage.endDate ? ` – ${formatDate(stage.endDate)}` : ''}`
                            : 'Dates unavailable until a sowing date is recorded'}
                        </p>
                      </div>
                    </div>
                    {crop.status === 'active' && stage.stage !== 'completed' ? (
                      <Button
                        size="sm"
                        variant={isCurrent ? 'secondary' : 'outline'}
                        className="h-7 text-xs"
                        disabled={isCurrent || stageUpdating !== null}
                        onClick={() => void updateStage(stage.stage)}
                      >
                        {stageUpdating === stage.stage ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        {isCurrent ? 'Current stage' : 'Set as current'}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {crop.status === 'completed' ? (
              <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
                Harvest recorded{crop.actual_harvest_date ? ` on ${formatDate(crop.actual_harvest_date)}` : ''}
                {crop.harvest_quantity != null ? ` · ${crop.harvest_quantity} ${crop.harvest_unit ?? ''}` : ''}.
                {areaAcres > 0 && crop.harvest_quantity != null
                  ? ` That is about ${formatNumber(crop.harvest_quantity / areaAcres, 2)} ${crop.harvest_unit ?? ''} per acre across the recorded area.`
                  : ''}
              </p>
            ) : null}
            {crop.status === 'failed' ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                This crop is marked as failed. Its activity and finance records are kept for your history.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Crop reference</CardTitle>
            <CardDescription>General guidance for {crop.crop?.name ?? 'this crop'}, not a field-specific promise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Duration</span>
              <span className="font-medium">{crop.crop?.growing_duration_days ? `${crop.crop.growing_duration_days} days` : 'Not recorded'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Droplets className="h-3.5 w-3.5" /> Water need</span>
              <span className="font-medium capitalize">{crop.crop?.water_requirement ?? 'Not recorded'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Sprout className="h-3.5 w-3.5" /> Typical yield</span>
              <span className="font-medium">
                {crop.crop?.typical_yield_per_acre != null
                  ? `${crop.crop.typical_yield_per_acre} ${crop.crop.yield_unit ?? ''}/acre`
                  : 'Not recorded'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Field</span>
              <span className="font-medium">{fieldName ?? 'Whole farm'}</span>
            </div>
            {crop.crop?.major_pests?.length ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Common pests to scout</p>
                <p className="mt-1 text-xs">{crop.crop.major_pests.join(', ')}</p>
              </div>
            ) : null}
            {crop.crop?.major_diseases?.length ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Common diseases</p>
                <p className="mt-1 text-xs">{crop.crop.major_diseases.join(', ')}</p>
              </div>
            ) : null}
            {crop.notes ? (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Your notes</p>
                  <p className="mt-1 whitespace-pre-line text-xs">{crop.notes}</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Field activities</CardTitle>
              <CardDescription>What you actually did, in your own record.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setActivityDialog({ open: true, activity: null })}>
              <Plus className="h-3.5 w-3.5" /> Log activity
            </Button>
          </CardHeader>
          <CardContent>
            {activitiesQuery.isLoading ? (
              <LoadingBlock rows={3} />
            ) : activities.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead className="hidden sm:table-cell">Detail</TableHead>
                      <TableHead className="hidden md:table-cell">Quantity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(activity.activity_date)}
                          {activity.cost != null ? (
                            <p className="text-[10px] text-muted-foreground">{formatCurrency(activity.cost)} noted</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">{activityLabel(activity.activity_type)}</Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-[280px] text-xs sm:table-cell">
                          <p className="truncate">{activity.description || activity.notes || '—'}</p>
                        </TableCell>
                        <TableCell className="hidden text-xs md:table-cell">
                          {activity.quantity != null ? `${activity.quantity} ${activity.unit ?? ''}` : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Edit activity"
                              onClick={() => setActivityDialog({ open: true, activity })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              title="Delete activity"
                              onClick={() => setDeletingActivity(activity)}
                            >
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
                icon={ClipboardList}
                title="No activities logged yet"
                description="Log irrigation, fertiliser, spraying, weeding or observations so this crop has a real field history."
                action={<Button size="sm" onClick={() => setActivityDialog({ open: true, activity: null })}><Plus className="h-3.5 w-3.5" /> Log first activity</Button>}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Suggested next checks</CardTitle>
            <CardDescription>Derived from the sowing date and reference duration. Add any that fit your field.</CardDescription>
          </CardHeader>
          <CardContent>
            {suggestions.length ? (
              <ul className="space-y-2">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.title} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{suggestion.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{suggestion.description}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {suggestion.dueDate ? `Target ${formatDate(suggestion.dueDate)}` : 'No target date'}
                      </span>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void addSuggestedTask(suggestion)}>
                        <Plus className="h-3 w-3" /> Add task
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {crop.sowing_date
                  ? 'No suggestions remain for this crop stage.'
                  : 'Record a sowing date to get reference-based checks.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Money linked to this crop</CardTitle>
            <CardDescription>
              Only expenses and income explicitly linked to this crop. Record them against the crop for exact totals.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Expense
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIncomeOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Income
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expenses</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(totalExpenses)}</p>
              <p className="text-[10px] text-muted-foreground">{cropExpenses.length} record{cropExpenses.length === 1 ? '' : 's'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Income</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(totalIncome)}</p>
              <p className="text-[10px] text-muted-foreground">{cropIncome.length} record{cropIncome.length === 1 ? '' : 's'}</p>
            </div>
            <div className={`rounded-lg border p-3 ${net < 0 ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Net so far</p>
              <p className={`mt-1 text-lg font-semibold ${net < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>{formatCurrency(net)}</p>
              <p className="text-[10px] text-muted-foreground">Income minus linked expenses</p>
            </div>
          </div>

          {cropExpenses.length || cropIncome.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...cropExpenses.map((row) => ({ id: row.id, date: row.expense_date, type: 'Expense', category: row.category, description: row.description, amount: -Number(row.amount) })),
                    ...cropIncome.map((row) => ({ id: row.id, date: row.income_date, type: 'Income', category: row.category, description: row.description, amount: Number(row.amount) })),
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 20)
                    .map((row) => (
                      <TableRow key={`${row.type}-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(row.date)}</TableCell>
                        <TableCell>
                          <Badge variant={row.type === 'Income' ? 'success' : 'warning'} className="font-normal">{row.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{row.category.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="hidden max-w-[260px] text-xs sm:table-cell"><p className="truncate">{row.description || '—'}</p></TableCell>
                        <TableCell className={`text-right text-xs font-medium ${row.amount < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                          {row.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(row.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title="No money linked to this crop"
              description="Link expenses such as seed, fertiliser and labour, and income from the crop sale, to see its real cost and return."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => setExpenseOpen(true)}><Plus className="h-3.5 w-3.5" /> Add expense</Button>
                  <Button size="sm" variant="outline" onClick={() => setIncomeOpen(true)}><Plus className="h-3.5 w-3.5" /> Add income</Button>
                </div>
              }
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Button asChild variant="ghost" size="sm">
              <Link to="/expenses"><Activity className="h-3.5 w-3.5" /> Full expense ledger</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/income"><Wallet className="h-3.5 w-3.5" /> Full income ledger</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <CropFormDialog
        open={cropFormOpen}
        onOpenChange={setCropFormOpen}
        farmId={crop.farm_id}
        fields={fields}
        defaultAreaUnit={crop.area_unit}
        cropRecord={crop}
        onSaved={() => void invalidate()}
      />

      <ActivityFormDialog
        open={activityDialog.open}
        onOpenChange={(open) => setActivityDialog({ open, activity: open ? activityDialog.activity : null })}
        farmCropId={crop.id}
        activity={activityDialog.activity}
        onSaved={() => void invalidate()}
      />

      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        farms={farms}
        currentFarmId={crop.farm_id}
        initialCropId={crop.id}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['finance'] })}
      />

      <IncomeFormDialog
        open={incomeOpen}
        onOpenChange={setIncomeOpen}
        farms={farms}
        currentFarmId={crop.farm_id}
        initialCropId={crop.id}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['finance'] })}
      />

      <ConfirmDialog
        open={Boolean(deletingActivity)}
        onOpenChange={(open) => { if (!open) setDeletingActivity(null); }}
        title="Delete this activity?"
        description="The activity will be removed from this crop's field history. This cannot be undone."
        confirmLabel="Delete activity"
        destructive
        onConfirm={removeActivity}
      />

      <Dialog open={harvestOpen} onOpenChange={setHarvestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record harvest</DialogTitle>
            <DialogDescription>
              Enter the actual harvest date and the quantity you measured. This marks the crop completed and keeps its records.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveHarvest(event)} className="space-y-4">
            {harvestError ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{harvestError}</p> : null}
            <FormField label="Actual harvest date" htmlFor="harvest-date" required>
              <Input
                id="harvest-date"
                type="date"
                value={harvest.date}
                onChange={(event) => setHarvest((current) => ({ ...current, date: event.target.value }))}
              />
            </FormField>
            <FormRow>
              <FormField label="Quantity harvested" htmlFor="harvest-quantity" hint="Optional; use what you measured">
                <Input
                  id="harvest-quantity"
                  value={harvest.quantity}
                  onChange={(event) => setHarvest((current) => ({ ...current, quantity: event.target.value }))}
                  inputMode="decimal"
                  placeholder="e.g. 18"
                />
              </FormField>
              <FormField label="Unit" htmlFor="harvest-unit">
                <Select value={harvest.unit} onValueChange={(value) => setHarvest((current) => ({ ...current, unit: value }))}>
                  <SelectTrigger id="harvest-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quintal">Quintal</SelectItem>
                    <SelectItem value="kg">Kilogram</SelectItem>
                    <SelectItem value="tonne">Tonne</SelectItem>
                    <SelectItem value="bag">Bag</SelectItem>
                    <SelectItem value="dozen">Dozen</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </FormRow>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHarvestOpen(false)} disabled={savingHarvest}>Cancel</Button>
              <Button type="submit" disabled={savingHarvest}>
                {savingHarvest ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {savingHarvest ? 'Saving…' : 'Mark completed'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Stage dates and suggested checks are planning guidance from reference agronomy, not a guarantee of crop performance.
        {' '}
        <button type="button" className="underline hover:text-foreground" onClick={() => navigate('/crop-intelligence')}>
          Review crop suitability
        </button>
      </p>
    </div>
  );
}
