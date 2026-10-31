import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Droplets,
  ExternalLink,
  Landmark,
  Leaf,
  MapPin,
  Pencil,
  Plus,
  Ruler,
  Star,
  Tractor,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFarmCrops } from '@/hooks/useAgriculture';
import { useTasks } from '@/hooks/useFarmOps';
import { farmService } from '@/services/farmService';
import { FarmFormDialog } from '@/components/farms/FarmFormDialog';
import { FieldFormDialog } from '@/components/farms/FieldFormDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatArea } from '@/lib/units';
import { formatCurrency } from '@/lib/utils';
import { SEASONS } from '@/lib/constants';
import type { Farm, FarmField } from '@/types/models';

export function FarmManagementPage() {
  const { farmId } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { farms, farm, fields, selectFarm, refreshFarms, isLoading, error } = useWorkspace();
  const queryClient = useQueryClient();
  const crops = useFarmCrops(farm?.id ?? null);
  const tasks = useTasks(farm?.id ?? null);
  const [farmDialog, setFarmDialog] = React.useState<{ open: boolean; farm?: Farm | null }>({ open: false });
  const [fieldDialog, setFieldDialog] = React.useState<{ open: boolean; field?: FarmField | null }>({ open: false });
  const [deletingFarm, setDeletingFarm] = React.useState<Farm | null>(null);
  const [deletingField, setDeletingField] = React.useState<FarmField | null>(null);
  const [settingPrimary, setSettingPrimary] = React.useState(false);

  React.useEffect(() => {
    if (farmId && farms.some((item) => item.id === farmId) && farmId !== farm?.id) selectFarm(farmId);
  }, [farmId, farms, farm?.id, selectFarm]);

  const activeCrops = (crops.data ?? []).filter((crop) => crop.status === 'active');
  const pendingTasks = (tasks.data ?? []).filter((task) => task.status === 'pending' || task.status === 'in_progress');

  const refreshAll = async () => {
    await Promise.all([
      refreshFarms(),
      queryClient.invalidateQueries({ queryKey: ['farm-fields'] }),
      queryClient.invalidateQueries({ queryKey: ['farm-crops'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    ]);
  };

  const makePrimary = async (target: Farm) => {
    if (!user) return;
    setSettingPrimary(true);
    try {
      await farmService.setPrimary(target.id, user.id);
      await refreshAll();
      toast.success(`${target.name} is now your primary farm.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not set the primary farm.');
    } finally {
      setSettingPrimary(false);
    }
  };

  const deleteFarm = async () => {
    if (!deletingFarm) return;
    try {
      await farmService.remove(deletingFarm.id);
      await refreshAll();
      toast.success('Farm deleted with its related records.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the farm.');
    }
  };

  const deleteField = async () => {
    if (!deletingField) return;
    try {
      await farmService.removeField(deletingField.id);
      await queryClient.invalidateQueries({ queryKey: ['farm-fields', farm?.id] });
      toast.success('Field deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the field.');
    }
  };

  if (isLoading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error.message} onRetry={() => void refreshFarms()} />;

  return (
    <div>
      <PageHeader
        title={t('farm.title')}
        subtitle="Manage multiple farms and the fields inside them. Area is stored in your chosen unit and converted to acres for calculations."
        icon={Tractor}
        actions={
          <Button size="sm" onClick={() => setFarmDialog({ open: true, farm: null })}>
            <Plus className="h-3.5 w-3.5" /> Add farm
          </Button>
        }
      />

      {!farms.length ? (
        <EmptyState
          icon={Tractor}
          title="No farm registered"
          description="Add your farm to unlock weather, crop intelligence and financial tracking."
          action={<Button onClick={() => setFarmDialog({ open: true, farm: null })}><Plus className="h-4 w-4" /> Add your first farm</Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {farms.map((item) => {
              const active = item.id === farm?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectFarm(item.id)}
                  className={`rounded-xl border p-4 text-left shadow-sm transition ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-card hover:border-primary/30'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {item.name}
                        {item.is_primary ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> : null}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {[item.village, item.taluka, item.district, item.state].filter(Boolean).join(', ') || 'Location not set'}
                      </p>
                    </div>
                    {active ? <Badge variant="success" className="shrink-0">Selected</Badge> : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Ruler className="h-3 w-3" /> {formatArea(item.total_area, item.area_unit)}</span>
                    <span className="inline-flex items-center gap-1"><Droplets className="h-3 w-3" /> {item.irrigation_available ? 'Irrigated' : 'Rain-fed'}</span>
                    <span className="inline-flex items-center gap-1"><Landmark className="h-3 w-3" /> {item.soil_type ?? 'Soil not set'}</span>
                    <span className="inline-flex items-center gap-1"><Leaf className="h-3 w-3" /> {item.farming_season ?? 'Season not set'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {farm ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{farm.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {[farm.village, farm.taluka, farm.district, farm.state].filter(Boolean).join(', ') || 'Add a location for localised data'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!farm.is_primary ? (
                    <Button variant="outline" size="sm" onClick={() => void makePrimary(farm)} disabled={settingPrimary}>
                      <Star className="h-3.5 w-3.5" /> Set primary
                    </Button>
                  ) : <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Primary farm</Badge>}
                  <Button variant="outline" size="sm" onClick={() => setFarmDialog({ open: true, farm })}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDeletingFarm(farm)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Summary label="Total area" value={formatArea(farm.total_area, farm.area_unit)} icon={Ruler} />
                <Summary label="Fields" value={`${fields.length}`} icon={Landmark} />
                <Summary label="Active crops" value={`${activeCrops.length}`} icon={Leaf} />
                <Summary label="Pending tasks" value={`${pendingTasks.length}`} icon={CheckCircle2} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Farm profile</CardTitle>
                    <CardDescription>Used by weather, climate and crop scoring</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm">
                    <DetailRow label="Coordinates" value={farm.latitude != null && farm.longitude != null ? `${Number(farm.latitude).toFixed(5)}, ${Number(farm.longitude).toFixed(5)}` : 'Not set'} />
                    <DetailRow label="Soil type" value={farm.soil_type ?? 'Not set'} />
                    <DetailRow label="Soil pH" value={farm.soil_ph != null ? String(farm.soil_ph) : 'Not set'} />
                    <DetailRow label="Irrigation" value={farm.irrigation_available ? 'Available' : 'Not available / rain-fed'} />
                    <DetailRow label="Water source" value={farm.water_source ?? 'Not set'} />
                    <DetailRow label="Land slope" value={farm.land_slope ?? 'Not set'} />
                    <DetailRow label="Season" value={SEASONS.find((item) => item.value === farm.farming_season)?.label ?? 'Not set'} />
                    <DetailRow label="Annual budget" value={farm.annual_budget != null ? formatCurrency(farm.annual_budget) : 'Not set'} />
                    {farm.latitude != null && farm.longitude != null ? (
                      <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-xs">
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${farm.latitude}&mlon=${farm.longitude}#map=14/${farm.latitude}/${farm.longitude}`}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          View location on OpenStreetMap <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    ) : (
                      <p className="pt-1 text-xs text-muted-foreground">
                        Add coordinates to enable the forecast and climate history. <Link to="/weather" className="font-medium text-primary hover:underline">Weather needs them.</Link>
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Quick actions</CardTitle>
                    <CardDescription>Continue working with this farm</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2">
                    <QuickLink to="/crop-intelligence" icon={Leaf} title="Crop suitability" text="See crops scored for this farm" />
                    <QuickLink to="/crops" icon={Leaf} title="Add a crop" text="Start a crop lifecycle record" />
                    <QuickLink to="/soil" icon={Landmark} title="Soil records" text="Add tests and upload reports" />
                    <QuickLink to="/expenses" icon={Ruler} title="Expenses" text="Record a farm cost" />
                    <QuickLink to="/weather" icon={Droplets} title="Weather" text="Forecast and climate history" />
                    <QuickLink to="/reports" icon={CheckCircle2} title="Reports" text="Export farm records" />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">Fields</CardTitle>
                    <CardDescription>Optional sub-plots for crop allocation and soil tests</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setFieldDialog({ open: true, field: null })}>
                    <Plus className="h-3.5 w-3.5" /> Add field
                  </Button>
                </CardHeader>
                <CardContent>
                  {fields.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Area</TableHead>
                          <TableHead className="hidden sm:table-cell">Soil</TableHead>
                          <TableHead className="hidden sm:table-cell">Water</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field) => (
                          <TableRow key={field.id}>
                            <TableCell>
                              <p className="font-medium">{field.name}</p>
                              {field.notes ? <p className="line-clamp-1 text-[10px] text-muted-foreground">{field.notes}</p> : null}
                            </TableCell>
                            <TableCell className="text-xs">{formatArea(field.area, field.area_unit)}</TableCell>
                            <TableCell className="hidden text-xs sm:table-cell">{field.soil_type ?? '—'}{field.soil_ph != null ? ` · pH ${field.soil_ph}` : ''}</TableCell>
                            <TableCell className="hidden text-xs sm:table-cell">{field.irrigation_available ? (field.water_source ?? 'Irrigated') : 'Rain-fed'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFieldDialog({ open: true, field })} aria-label={`Edit ${field.name}`}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setDeletingField(field)} aria-label={`Delete ${field.name}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState
                      icon={Landmark}
                      title="No fields added"
                      description="Fields are optional. Add them if you want to allocate crops and soil tests to specific plots."
                      action={<Button size="sm" variant="outline" onClick={() => setFieldDialog({ open: true, field: null })}><Plus className="h-3.5 w-3.5" /> Add field</Button>}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}

      <FarmFormDialog
        open={farmDialog.open}
        onOpenChange={(open) => setFarmDialog({ open, farm: open ? farmDialog.farm : null })}
        farm={farmDialog.farm}
        onSaved={(saved) => {
          if (saved) selectFarm(saved.id);
        }}
      />
      {farm ? (
        <FieldFormDialog
          open={fieldDialog.open}
          onOpenChange={(open) => setFieldDialog({ open, field: open ? fieldDialog.field : null })}
          farmId={farm.id}
          field={fieldDialog.field}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deletingFarm)}
        onOpenChange={(open) => { if (!open) setDeletingFarm(null); }}
        title={`Delete ${deletingFarm?.name ?? 'this farm'}?`}
        description="This permanently deletes the farm and its crops, field records, expenses, income, soil tests, tasks and documents. This cannot be undone."
        confirmLabel="Delete farm"
        destructive
        onConfirm={deleteFarm}
      />
      <ConfirmDialog
        open={Boolean(deletingField)}
        onOpenChange={(open) => { if (!open) setDeletingField(null); }}
        title={`Delete ${deletingField?.name ?? 'this field'}?`}
        description="Crops or soil records linked to this field may also be removed or unlinked, depending on the database rule."
        confirmLabel="Delete field"
        destructive
        onConfirm={deleteField}
      />
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed pb-1 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium capitalize">{value}</span>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, text }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <Link to={to} className="flex items-start gap-2 rounded-lg border p-2.5 transition hover:border-primary/40 hover:bg-accent/60">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        <span className="block text-xs font-semibold">{title}</span>
        <span className="block text-[10px] text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}
