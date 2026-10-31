import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Globe2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sprout,
  Tractor,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { LANGUAGE_OPTIONS } from '@/lib/constants';
import { formatArea } from '@/lib/units';
import { profileSchema, firstError } from '@/lib/validation';
import { formatDate, getInitials } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FormField, FormRow } from '@/components/common/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Language } from '@/types/models';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, profile, preferences, saveProfile } = useAuth();
  const { farms } = useWorkspace();

  const [form, setForm] = React.useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    preferred_language: (profile?.preferred_language as Language) ?? 'en',
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm({
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      preferred_language: (profile?.preferred_language as Language) ?? 'en',
    });
  }, [profile]);

  const totalAcres = farms.reduce((sum, farm) => sum + (farm.total_area != null ? Number(farm.total_area) : 0), 0);
  const primaryFarm = farms.find((farm) => farm.is_primary) ?? farms[0] ?? null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone ?? null,
        preferred_language: parsed.data.preferred_language,
      });
      await i18n.changeLanguage(parsed.data.preferred_language);
      toast.success('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('nav.profile')}
        subtitle="Your account details and a summary of the farms connected to FarmDesk."
        icon={UserRound}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {getInitials(profile?.full_name ?? user?.email ?? 'Farmer')}
            </span>
            <h2 className="mt-3 text-lg font-semibold">{profile?.full_name ?? 'Add your name'}</h2>
            <p className="text-xs text-muted-foreground">{user?.email ?? profile?.email ?? 'Email unavailable'}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <Badge variant={profile?.onboarding_completed ? 'success' : 'warning'} className="gap-1 font-normal">
                {profile?.onboarding_completed ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {profile?.onboarding_completed ? 'Onboarding complete' : 'Onboarding pending'}
              </Badge>
              <Badge variant="outline" className="font-normal">{LANGUAGE_OPTIONS.find((option) => option.value === profile?.preferred_language)?.label ?? 'English'}</Badge>
            </div>
            <dl className="mt-5 w-full space-y-2 text-left text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> Phone</dt>
                <dd className="font-medium">{profile?.phone ?? 'Not added'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Joined</dt>
                <dd className="font-medium">{profile?.created_at ? formatDate(profile.created_at) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><Globe2 className="h-3.5 w-3.5" /> Area unit</dt>
                <dd className="font-medium capitalize">{preferences?.area_unit ?? 'acres'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Account</dt>
                <dd className="font-medium">{user ? 'Signed in' : 'Not signed in'}</dd>
              </div>
            </dl>
            {!profile?.onboarding_completed ? (
              <Button asChild size="sm" className="mt-4 w-full"><Link to="/onboarding">Finish onboarding</Link></Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Edit profile</CardTitle>
            <CardDescription>Your name and phone appear on exported reports and help identify your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              ) : null}
              <FormRow>
                <FormField label="Full name" htmlFor="profile-name" required>
                  <Input
                    id="profile-name"
                    value={form.full_name}
                    onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                    placeholder="e.g. Sunil Patil"
                    autoComplete="name"
                  />
                </FormField>
                <FormField label="Mobile number" htmlFor="profile-phone" hint="Indian mobile">
                  <Input
                    id="profile-phone"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="e.g. 98765 43210"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Preferred language" htmlFor="profile-language">
                  <Select
                    value={form.preferred_language}
                    onValueChange={(value) => setForm((current) => ({ ...current, preferred_language: value as Language }))}
                  >
                    <SelectTrigger id="profile-language"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label} · {option.native}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Email address" htmlFor="profile-email" hint="Managed by your sign-in">
                  <Input id="profile-email" value={user?.email ?? profile?.email ?? ''} readOnly disabled />
                </FormField>
              </FormRow>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Farms" value={farms.length} icon={Tractor} tone="green" hint={primaryFarm ? `Primary: ${primaryFarm.name}` : 'No farm added yet'} />
        <StatCard label="Total area" value={formatArea(totalAcres, 'acres')} icon={MapPin} tone="soil" hint="Sum of your recorded farm areas" />
        <StatCard label="Language" value={LANGUAGE_OPTIONS.find((option) => option.value === profile?.preferred_language)?.native ?? 'English'} icon={Globe2} tone="sky" hint="Used for the interface where translations exist" />
        <StatCard label="Email" value={user?.email ? 'Verified sign-in' : '—'} icon={Mail} tone="neutral" hint={user?.email ?? 'Email unavailable'} />
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Sprout className="h-4 w-4" /> Your farms</CardTitle>
          <CardDescription>Every farm is private to your account and protected by row-level security.</CardDescription>
        </CardHeader>
        <CardContent>
          {farms.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {farms.map((farm) => (
                <li key={farm.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{farm.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[farm.village, farm.taluka, farm.district, farm.state].filter(Boolean).join(', ') || 'Location not set'}
                      </p>
                    </div>
                    {farm.is_primary ? <Badge variant="success" className="font-normal">Primary</Badge> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatArea(farm.total_area, farm.area_unit)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Button asChild size="sm"><Link to="/farms">Add your first farm</Link></Button>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Your farm data is visible only to your signed-in account. FarmDesk staff do not access individual farm records for marketing.
      </p>
    </div>
  );
}
