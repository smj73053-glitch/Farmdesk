import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Download,
  FileText,
  Leaf,
  Pencil,
  Plus,
  Search,
  Sprout,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useCropReference, useFarmActivities, useFarmCrops } from '@/hooks/useAgriculture';
import { cropService } from '@/services/cropService';
import { CROP_STAGES } from '@/lib/constants';
import { toAcres, formatArea } from '@/lib/units';
import { downloadCsv } from '@/lib/csv';
import { generateReportPdf } from '@/lib/pdf';
import { formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, LoadingBlock } from '@/components/common/states';
import { CropFormDialog } from '@/components/crops/CropFormDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FarmCrop } from '@/types/models';

type FilterStatus = 'active' | 'completed' | 'failed' | 'all';

const STAGE_INDEX = new Map(CROP_STAGES.map((stage, index) => [stage.value, index]));

function stageLabel(stage: string): string {
  return CROP_STAGES.find((item) => item.value === stage)?.label ?? stage.replace(/_/g, ' ');
}

function daysBetween(from: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);
}

export function CropLifecyclePage() {
  const { t } = useTranslation();
  const { farm, farmId, fields } = useWorkspace();
  const queryClient = useQueryClient();
  const cropsQuery = useFarmCrops(farmId);
  const referenceQuery = useCropReference();
  const [params, setParams] = useSearchParams();
  const initialCropId = params.get('add') ?? '';
  const [status, setStatus] = React.useState<FilterStatus>('active');
  const [search, setSearch] = React.useState('');
  const [dialog, setDialog] = React.useState<{ open: boolean; crop?: FarmCrop | null }>({ open: false });
  const [deleting, setDeleting] = React.useState<FarmCrop | null>(null);

  const crops = cropsQuery.data ?? [];
  const activities = useFarmActivities(crops.map((crop) => crop.id));
  const referenceCrops = referenceQuery.data ?? [];

  React.useEffect(() => {
    if (initialCropId) {
      setDialog({ open: true, crop: null });
    }
  }, [initialCropId]);

  const fieldNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const field of fields) map[field.id] = field.name;
    return map;
  }, [fields]);

  const activityCount = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of activities.data ?? []) {
      map[item.farm_crop_id] = (map[item.farm_crop_id] ?? 0) + 1;
    }
    return map;
  }, [activities.data]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return crops.filter((crop) => {
      if (status !== 'all' && crop.status !== status) return false;
      if (!term) return true;
      return [crop.crop?.name, crop.variety, fieldNames[crop.field_id ?? '']]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
    });
  }, [crops, status, search, fieldNames]);

  const active = crops.filter((crop) => crop.status === 'active');
  const plantedAcres = active.reduce((sum, crop) => sum + toAcres(crop.area_planted, crop.area_unit), 0);
  const now = new Date();
  const harvestSoon = active.filter((crop) => {
    if (!crop.expected_harvest_date) return false;
    const days = daysBetween(crop.expected_harvest_date, now) * -1;
    return days >= 0 && days <= 30;
  }).length;
  const totalActivities = activities.data?.length ?? 0;

  const closeDialog = (open: boolean) => {
    setDialog({ open, crop: open ? dialog.crop : null });
    if (!open && params.has('add')) {
      params.delete('add');
      setParams(params, { replace: true });
    }
  };

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['farm-crops', farmId] }),
      queryClient.invalidateQueries({ queryKey: ['farm-activities'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };

  const removeCrop = async () => {
    if (!deleting) return;
    try {
      await cropService.removeFarmCrop(deleting.id);
      await invalidate();
      toast.success('Crop record deleted with its activities.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this crop.');
    }
  };

  const exportRows = () => {
    downloadCsv(`farmdesk-crop-register-${new Date().toISOString().slice(0, 10)}`, filtered, [
      { key: 'crop', label: 'Crop', format: (row) => row.crop?.name ?? '' },
      { key: 'variety', label: 'Variety' },
      { key: 'field_id', label: 'Field', format: (row) => fieldNames[row.field_id ?? ''] ?? 'Whole farm' },
      { key: 'area_planted', label: 'Area planted', format: (row) => `${row.area_planted ?? ''} ${row.area_unit}` },
      { key: 'sowing_date', label: 'Sowing date' },
      { key: 'expected_harvest_date', label: 'Expected harvest' },
      { key: 'actual_harvest_date', label: 'Actual harvest' },
      { key: 'current_stage', label: 'Stage' },
      { key: 'status', label: 'Status' },
      { key: 'harvest_quantity', label: 'Harvest quantity', format: (row) => row.harvest_quantity != null ? `${row.harvest_quantity} ${row.harvest_unit ?? ''}` : '' },
    ]);
    toast.success(`${filtered.length} crop record${filtered.length === 1 ? '' : 's'} exported to CSV.`);
  };

  const exportPdf = () => {
    generateReportPdf({
      title: 'Crop register',
      subtitle: `${farm?.name ?? 'Farm'} · exported ${new Date().toLocaleDateString('en-IN')}`,
      fileName: `farmdesk-crop-register-${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: 'Crops shown', value: formatNumber(filtered.length) },
        { label: 'Active crops', value: formatNumber(active.length) },
        { label: 'Planted area', value: formatArea(plantedAcres, 'acres') },
        { label: 'Activities logged', value: formatNumber(totalActivities) },
      ],
      sections: [
        {
          heading: 'Crop records',
          columns: ['Crop', 'Variety', 'Field', 'Area', 'Sowing', 'Expected harvest', 'Stage', 'Status'],
          rows: filtered.map((crop) => [
            crop.crop?.name ?? 'Crop',
            crop.variety ?? '—',
            fieldNames[crop.field_id ?? ''] ?? 'Whole farm',
            formatArea(crop.area_planted, crop.area_unit),
            crop.sowing_date ?? '—',
            crop.expected_harvest_date ?? '—',
            stageLabel(crop.current_stage),
            crop.status,
          ]),
        },
      ],
      notes: [
        'The crop register lists the records you entered. Stage dates are guidance based on reference duration, not a field observation.',
        'Harvest and yield figures are your recorded values; FarmDesk does not estimate them for you.',
      ],
    });
  };

  if (!farmId) {
    return (
      <div>
        <PageHeader title={t('nav.cropLifecycle')} subtitle="Track every crop from sowing to harvest" icon={Leaf} />
        <EmptyState
          icon={Leaf}
          title="Add a farm first"
          description="Crop records belong to a farm. Add your farm to start the crop lifecycle."
          action={<Button asChild><Link to="/farms"><Plus className="h-4 w-4" /> Add farm</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('nav.cropLifecycle')}
        subtitle="Track sowing, field activities, stage progress and harvest for every crop on this farm."
        icon={Leaf}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportRows} disabled={!filtered.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={!filtered.length}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" onClick={() => setDialog({ open: true, crop: null })}>
              <Plus className="h-3.5 w-3.5" /> Add crop
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active crops" value={active.length} icon={Sprout} tone="green" hint={`${crops.length} crop record${crops.length === 1 ? '' : 's'} in total`} />
        <StatCard label="Planted area" value={formatArea(plantedAcres, 'acres')} icon={Leaf} tone="soil" hint="Sum of active crop areas, converted to acres" />
        <StatCard label="Harvest next 30 days" value={harvestSoon} icon={CalendarDays} tone="amber" hint="Based on expected harvest dates you entered" />
        <StatCard label="Activities logged" value={totalActivities} icon={TrendingUp} tone="sky" hint="Field activities across this farm" />
      </div>

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1">
            {([
              ['active', 'Active'],
              ['completed', 'Completed'],
              ['failed', 'Failed'],
              ['all', 'All'],
            ] as [FilterStatus, string][]).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={status === value ? 'default' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => setStatus(value)}
              >
                {label}
                <Badge variant={status === value ? 'secondary' : 'outline'} className="ml-1 px-1.5 py-0 text-[10px]">
                  {value === 'all' ? crops.length : crops.filter((crop) => crop.status === value).length}
                </Badge>
              </Button>
            ))}
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search crop, variety or field" className="h-8 pl-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Crops on {farm?.name ?? 'this farm'}</CardTitle>
          <CardDescription>
            Stage progress is guidance from the sowing date and reference duration. Update the stage as your field actually develops.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cropsQuery.isLoading ? (
            <LoadingBlock rows={4} />
          ) : filtered.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Crop</TableHead>
                    <TableHead>Field / area</TableHead>
                    <TableHead className="hidden sm:table-cell">Sowing</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="hidden md:table-cell">Harvest</TableHead>
                    <TableHead className="hidden lg:table-cell">Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((crop) => {
                    const stage = stageLabel(crop.current_stage);
                    const progress = crop.status === 'completed'
                      ? 100
                      : Math.round(((STAGE_INDEX.get(crop.current_stage) ?? 0) / (CROP_STAGES.length - 1)) * 100);
                    const daysSince = crop.sowing_date ? daysBetween(crop.sowing_date, now) : null;
                    const daysToHarvest = crop.expected_harvest_date ? daysBetween(crop.expected_harvest_date, now) * -1 : null;
                    return (
                      <TableRow key={crop.id}>
                        <TableCell>
                          <Link to={`/crops/${crop.id}`} className="font-medium hover:text-primary hover:underline">
                            {crop.crop?.name ?? 'Crop'}
                          </Link>
                          <p className="text-[10px] text-muted-foreground">
                            {crop.variety || 'Variety not set'}
                            {' · '}
                            <Badge variant={crop.status === 'active' ? 'success' : crop.status === 'completed' ? 'info' : 'warning'} className="px-1.5 py-0 text-[9px] capitalize">
                              {crop.status}
                            </Badge>
                          </p>
                        </TableCell>
                        <TableCell className="text-xs">
                          {fieldNames[crop.field_id ?? ''] ?? 'Whole farm'}
                          <p className="text-[10px] text-muted-foreground">{formatArea(crop.area_planted, crop.area_unit)}</p>
                        </TableCell>
                        <TableCell className="hidden text-xs sm:table-cell">
                          {crop.sowing_date ? formatDate(crop.sowing_date) : 'Not set'}
                          {daysSince != null ? <p className="text-[10px] text-muted-foreground">{daysSince} days ago</p> : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex w-32 items-center gap-2">
                            <Progress value={progress} className="h-1.5" />
                            <span className="shrink-0 text-[10px] capitalize text-muted-foreground">{stage.split(' ')[0]}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-xs md:table-cell">
                          {crop.expected_harvest_date ? formatDate(crop.expected_harvest_date) : 'Not set'}
                          {daysToHarvest != null ? (
                            <p className={`text-[10px] ${daysToHarvest < 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                              {daysToHarvest >= 0 ? `in ${daysToHarvest} days` : `${Math.abs(daysToHarvest)} days overdue`}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden text-xs lg:table-cell">{activityCount[crop.id] ?? 0} logged</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5">
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                              <Link to={`/crops/${crop.id}`}>Open</Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit crop" onClick={() => setDialog({ open: true, crop })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Delete crop" onClick={() => setDeleting(crop)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Leaf}
              title={search ? 'No crops match this search' : status === 'active' ? 'No active crops' : 'No crop records here'}
              description={
                search
                  ? 'Try a different crop, variety or field name.'
                  : 'Add a crop after sowing so you can log activities, track its stage and compare cost with income.'
              }
              action={<Button size="sm" onClick={() => setDialog({ open: true, crop: null })}><Plus className="h-3.5 w-3.5" /> Add crop</Button>}
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Button asChild variant="outline" size="sm">
          <Link to="/crop-intelligence"><Sprout className="h-3.5 w-3.5" /> Not sure what to plant? Use Crop Intelligence</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/expenses"><TrendingUp className="h-3.5 w-3.5" /> Record crop expenses</Link>
        </Button>
      </div>

      <CropFormDialog
        open={dialog.open}
        onOpenChange={closeDialog}
        farmId={farmId}
        fields={fields}
        defaultAreaUnit={farm?.area_unit ?? 'acres'}
        initialCropId={initialCropId}
        cropRecord={dialog.crop}
        onSaved={(saved) => {
          void invalidate();
          if (!dialog.crop) toast.info(`${saved.crop?.name ?? 'Crop'} added. Open it to log field activities.`);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={`Delete ${deleting?.crop?.name ?? 'this crop'}?`}
        description="This deletes the crop record and all its logged activities. Linked expenses and income stay in your ledger but become unlinked. This cannot be undone."
        confirmLabel="Delete crop"
        destructive
        onConfirm={removeCrop}
      />

      {!referenceCrops.length && !referenceQuery.isLoading ? (
        <p className="mt-3 text-xs text-red-600">Crop reference data could not be loaded. Run the database migrations and refresh.</p>
      ) : null}
    </div>
  );
}
