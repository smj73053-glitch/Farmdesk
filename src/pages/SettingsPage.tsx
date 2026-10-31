import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe2,
  KeyRound,
  Laptop,
  Loader2,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useOfflineSync, useOnlineStatus } from '@/hooks/useOffline';
import { useSources } from '@/hooks/useFarmOps';
import { listOutbox, type OutboxItem } from '@/lib/offlineQueue';
import { resolveConflictApplyMine, resolveConflictKeepServer } from '@/lib/offlineSync';
import { AREA_UNITS, LANGUAGE_OPTIONS } from '@/lib/constants';
import { passwordChangeSchema, firstError } from '@/lib/validation';
import { formatDate } from '@/lib/utils';
import { formatFetchedAt } from '@/lib/weather';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/common/states';
import { VerificationBadge } from '@/components/common/DataSourceBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField, FormRow } from '@/components/common/FormField';
import type { AreaUnit, Language } from '@/types/models';

const TABLE_LABELS: Record<string, string> = {
  expenses: 'Expense',
  income_records: 'Income',
  crop_activities: 'Crop activity',
  farm_tasks: 'Task',
};

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, profile, preferences, saveProfile, savePreferences, updatePassword, signOut } = useAuth();
  const { farms } = useWorkspace();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const { pending, conflicts, syncing, sync, refresh } = useOfflineSync();
  const sourcesQuery = useSources();

  const [language, setLanguage] = React.useState<Language>((profile?.preferred_language as Language) ?? 'en');
  const [areaUnit, setAreaUnit] = React.useState<AreaUnit>(preferences?.area_unit ?? 'acres');
  const [defaultFarmId, setDefaultFarmId] = React.useState<string>(preferences?.default_farm_id ?? '');
  const [notifications, setNotifications] = React.useState<boolean>(preferences?.notifications_enabled ?? true);
  const [savingPreference, setSavingPreference] = React.useState<string | null>(null);

  const [passwords, setPasswords] = React.useState({ password: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [confirmSignOut, setConfirmSignOut] = React.useState(false);
  const [resolving, setResolving] = React.useState<string | null>(null);

  const outboxQuery = useQuery({
    queryKey: ['outbox', user?.id],
    queryFn: () => listOutbox(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 10 * 1000,
  });

  React.useEffect(() => {
    if (profile?.preferred_language) setLanguage(profile.preferred_language as Language);
    setAreaUnit(preferences?.area_unit ?? 'acres');
    setDefaultFarmId(preferences?.default_farm_id ?? '');
    setNotifications(preferences?.notifications_enabled ?? true);
  }, [profile?.preferred_language, preferences]);

  const savePreference = async (label: string, action: () => Promise<void>) => {
    setSavingPreference(label);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success('Preference saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save this preference.');
    } finally {
      setSavingPreference(null);
    }
  };

  const changeLanguage = (value: Language) => {
    setLanguage(value);
    void savePreference('language', async () => {
      await saveProfile({ preferred_language: value });
      await i18n.changeLanguage(value);
    });
  };

  const changeAreaUnit = (value: AreaUnit) => {
    setAreaUnit(value);
    void savePreference('areaUnit', () => savePreferences({ area_unit: value }));
  };

  const changeDefaultFarm = (value: string) => {
    setDefaultFarmId(value);
    void savePreference('farm', () => savePreferences({ default_farm_id: value === 'none' ? null : value }));
  };

  const changeNotifications = (value: boolean) => {
    setNotifications(value);
    void savePreference('notifications', () => savePreferences({ notifications_enabled: value }));
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    const parsed = passwordChangeSchema.safeParse(passwords);
    if (!parsed.success) {
      setPasswordError(firstError(parsed.error));
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(parsed.data.password);
      setPasswords({ password: '', confirmPassword: '' });
      toast.success('Password updated.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const resolveMine = async (item: OutboxItem) => {
    if (!user) return;
    setResolving(item.id);
    try {
      await resolveConflictApplyMine(item, user.id);
      await Promise.all([
        refresh(),
        outboxQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['income'] }),
        queryClient.invalidateQueries({ queryKey: ['activities'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
      ]);
      toast.success('Your queued version was applied.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not apply your queued change.');
    } finally {
      setResolving(null);
    }
  };

  const resolveServer = async (item: OutboxItem) => {
    setResolving(item.id);
    try {
      await resolveConflictKeepServer(item);
      await Promise.all([refresh(), outboxQuery.refetch()]);
      toast.success('Kept the server version and discarded the queued edit.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not discard this queued change.');
    } finally {
      setResolving(null);
    }
  };

  const outbox = outboxQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title={t('nav.settings')}
        subtitle="Language, units, reminders, account security, offline changes and the data sources behind every external number."
        icon={SettingsIcon}
      />

      <Tabs defaultValue="preferences" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="preferences" className="text-xs sm:text-sm">Preferences</TabsTrigger>
          <TabsTrigger value="account" className="text-xs sm:text-sm">Account</TabsTrigger>
          <TabsTrigger value="offline" className="text-xs sm:text-sm">
            Offline & sync
            {pending > 0 ? <Badge variant="warning" className="ml-1.5 px-1.5 py-0 text-[10px]">{pending}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="sources" className="text-xs sm:text-sm">Data sources</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4" /> Language and units</CardTitle>
              <CardDescription>These preferences apply across the app and on every device where you sign in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormRow>
                <FormField label="App language" htmlFor="settings-language" hint={savingPreference === 'language' ? 'Saving…' : undefined}>
                  <Select value={language} onValueChange={(value) => changeLanguage(value as Language)} disabled={savingPreference === 'language'}>
                    <SelectTrigger id="settings-language"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label} · {option.native}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Area unit" htmlFor="settings-area" hint="Stored internally in acres">
                  <Select value={areaUnit} onValueChange={(value) => changeAreaUnit(value as AreaUnit)} disabled={savingPreference === 'areaUnit'}>
                    <SelectTrigger id="settings-area"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AREA_UNITS.map((unit) => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Default farm" htmlFor="settings-farm" hint="Opened first on sign-in">
                  <Select value={defaultFarmId || 'none'} onValueChange={changeDefaultFarm} disabled={savingPreference === 'farm'}>
                    <SelectTrigger id="settings-farm"><SelectValue placeholder="Primary farm" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Use my primary farm</SelectItem>
                      {farms.map((farm) => <SelectItem key={farm.id} value={farm.id}>{farm.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="In-app notifications" htmlFor="settings-notifications" hint="Weather alerts and reminders">
                  <div className="flex h-10 items-center justify-between rounded-md border px-3">
                    <span className="text-xs text-muted-foreground">{notifications ? 'On' : 'Off'}</span>
                    <Switch id="settings-notifications" checked={notifications} onCheckedChange={changeNotifications} disabled={savingPreference === 'notifications'} />
                  </div>
                </FormField>
              </FormRow>
              <p className="text-[11px] text-muted-foreground">
                Language and display preferences never change your saved records. Area values remain stored in acres and are converted for display.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" /> Profile details</CardTitle>
              <CardDescription>Name, phone and account identity are managed on your profile page.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm"><Link to="/profile">Open profile</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Change password</CardTitle>
              <CardDescription>Use at least 8 characters. You will stay signed in on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(event) => void submitPassword(event)} className="max-w-md space-y-3">
                {passwordError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {passwordError}
                  </div>
                ) : null}
                <FormField label="New password" htmlFor="settings-new-password" required>
                  <Input
                    id="settings-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwords.password}
                    onChange={(event) => setPasswords((current) => ({ ...current, password: event.target.value }))}
                  />
                </FormField>
                <FormField label="Confirm new password" htmlFor="settings-confirm-password" required>
                  <Input
                    id="settings-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwords.confirmPassword}
                    onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))}
                  />
                </FormField>
                <Button type="submit" size="sm" disabled={savingPassword}>
                  {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  {savingPassword ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Account session</CardTitle>
              <CardDescription>Signed in as {user?.email ?? profile?.email ?? '—'}.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmSignOut(true)}>Sign out</Button>
              <p className="text-[11px] text-muted-foreground">
                Signing out clears cached data on this device. Offline changes already queued will remain until they sync.
              </p>
            </CardContent>
          </Card>

          <Notice tone="info" title="Email confirmation and recovery">
            Email confirmation and password recovery use the Supabase Auth email flow configured for this deployment.
            If emails do not arrive, check the project's SMTP settings and spam folder.
          </Notice>
        </TabsContent>

        <TabsContent value="offline" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {online ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />}
                  Offline changes
                </CardTitle>
                <CardDescription>
                  Expenses, income, crop activities and tasks can be saved offline. They sync automatically when the connection returns.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void sync()} disabled={syncing || !online}>
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Connection</p>
                  <p className={`mt-1 text-sm font-semibold ${online ? 'text-emerald-700' : 'text-amber-700'}`}>{online ? 'Online' : 'Offline'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Queued changes</p>
                  <p className="mt-1 text-sm font-semibold">{pending}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Conflicts</p>
                  <p className={`mt-1 text-sm font-semibold ${conflicts.length ? 'text-amber-700' : 'text-emerald-700'}`}>{conflicts.length}</p>
                </div>
              </div>

              {outboxQuery.isLoading ? (
                <LoadingBlock rows={2} />
              ) : outbox.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Saved</TableHead>
                        <TableHead>Record</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outbox.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="whitespace-nowrap text-xs">{formatFetchedAt(item.createdAt)}</TableCell>
                          <TableCell className="text-xs">{TABLE_LABELS[item.table] ?? item.table}</TableCell>
                          <TableCell className="text-xs capitalize">{item.operation}</TableCell>
                          <TableCell className="max-w-[280px] text-xs">
                            {item.conflict ? (
                              <>
                                <Badge variant="warning" className="gap-1 font-normal"><AlertTriangle className="h-3 w-3" /> Conflict</Badge>
                                <p className="mt-1 text-[10px] text-amber-800">{item.lastError ?? 'This record changed on another device.'}</p>
                              </>
                            ) : item.attempts > 0 ? (
                              <>
                                <Badge variant="secondary" className="font-normal">Retrying</Badge>
                                {item.lastError ? <p className="mt-1 text-[10px] text-muted-foreground">{item.lastError}</p> : null}
                              </>
                            ) : (
                              <Badge variant="info" className="font-normal">Queued</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.conflict ? (
                              <div className="flex justify-end gap-1">
                                <Button variant="outline" size="sm" className="h-7 text-[11px]" disabled={resolving === item.id} onClick={() => void resolveServer(item)}>
                                  Keep server
                                </Button>
                                <Button size="sm" className="h-7 text-[11px]" disabled={resolving === item.id} onClick={() => void resolveMine(item)}>
                                  {resolving === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                  Use mine
                                </Button>
                              </div>
                            ) : (
                              <span className="block text-right text-[10px] text-muted-foreground">Automatic</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Everything is synced"
                  description="There are no queued changes on this device."
                />
              )}

              <p className="mt-3 text-[11px] text-muted-foreground">
                Conflicts happen when the same record is edited on two devices. FarmDesk never silently overwrites the newer server row;
                you choose which version to keep.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> External data sources</CardTitle>
              <CardDescription>
                Every external dataset used by FarmDesk, its update frequency and when it was last verified. Estimates are labelled in the UI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sourcesQuery.isLoading ? (
                <LoadingBlock rows={3} />
              ) : sourcesQuery.error ? (
                <ErrorState message={(sourcesQuery.error as Error).message} onRetry={() => void sourcesQuery.refetch()} />
              ) : (sourcesQuery.data ?? []).length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider / dataset</TableHead>
                        <TableHead className="hidden md:table-cell">Coverage</TableHead>
                        <TableHead className="hidden sm:table-cell">Updated</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead className="text-right">Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(sourcesQuery.data ?? []).map((source) => (
                        <TableRow key={source.id}>
                          <TableCell className="text-xs">
                            <p className="font-medium">{source.provider}</p>
                            <p className="text-[11px] text-muted-foreground">{source.dataset}</p>
                            {source.data_quality ? <p className="mt-0.5 text-[10px] text-muted-foreground">{source.data_quality}</p> : null}
                          </TableCell>
                          <TableCell className="hidden text-xs md:table-cell">{source.geographic_coverage ?? '—'}</TableCell>
                          <TableCell className="hidden text-xs sm:table-cell">{source.update_frequency ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{source.last_verified ? formatDate(source.last_verified) : 'Not recorded'}</TableCell>
                          <TableCell className="text-right">
                            {source.dataset_url ? (
                              <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open dataset page">
                                <a href={source.dataset_url} target="_blank" rel="noreferrer noopener"><ExternalLink className="h-3.5 w-3.5" /></a>
                              </Button>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={Database}
                  title="No source registry entries"
                  description="Run the database migrations to load the dataset registry."
                />
              )}
              <div className="mt-3">
                <VerificationBadge official verifiedOn={(sourcesQuery.data ?? []).reduce<string | null>((latest, source) => {
                  if (!source.last_verified) return latest;
                  if (!latest || source.last_verified > latest) return source.last_verified;
                  return latest;
                }, null)} />
              </div>
            </CardContent>
          </Card>

          <Notice tone="info" title="No fabricated fallbacks">
            If a provider is unavailable or a key is missing, FarmDesk shows the failure and any saved observations with their dates.
            It does not fill gaps with invented weather, climate or prices.
          </Notice>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out of FarmDesk?"
        description="Any unsynced offline changes stay queued on this device and sync the next time you sign in while online."
        confirmLabel="Sign out"
        onConfirm={async () => { await signOut(); }}
      />

      {pending > 0 && !online ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-amber-700">
          <WifiOff className="h-3.5 w-3.5" /> {pending} change{pending === 1 ? '' : 's'} waiting for a connection.
        </p>
      ) : (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Laptop className="h-3.5 w-3.5" /> Settings apply to your account, not just this device.
        </p>
      )}

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        <Trash2 className="mr-1 inline h-3 w-3" />
        Want to remove your farm data? Contact support with your registered email; account deletion is not automatic.
      </p>
    </div>
  );
}
