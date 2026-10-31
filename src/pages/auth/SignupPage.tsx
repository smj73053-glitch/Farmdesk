import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { signupSchema, firstError } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LANGUAGE_OPTIONS } from '@/lib/constants';
import type { Language } from '@/types/models';

export function SignupPage() {
  const { t, i18n } = useTranslation();
  const { signUp, session } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [language, setLanguage] = React.useState<Language>((i18n.language?.split('-')[0] as Language) || 'en');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(false);

  React.useEffect(() => {
    if (session && !submitting) navigate('/onboarding', { replace: true });
  }, [navigate, session, submitting]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const parsed = signupSchema.safeParse({ fullName, email, password, confirmPassword, language });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSubmitting(true);
    try {
      await i18n.changeLanguage(parsed.data.language);
      const result = await signUp(parsed.data.email, parsed.data.password, parsed.data.fullName, parsed.data.language);
      if (result.needsConfirmation) {
        setNeedsConfirmation(true);
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (needsConfirmation) {
    return (
      <AuthLayout title="Check your email" subtitle="Confirm your address to activate the FarmDesk account.">
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Account created</AlertTitle>
          <AlertDescription>
            We sent a confirmation link to <strong>{email}</strong>. Open it, then sign in to finish setting up your farm.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-5 w-full" size="lg">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.signupTitle')}
      subtitle={t('auth.signupSubtitle')}
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            {t('auth.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? (
          <Alert className="border-red-200 bg-red-50 text-red-950">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="fullName">{t('onboarding.fullName')}</Label>
          <Input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Sunita Patil"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="language">Preferred language</Label>
          <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.native} · {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">You can change this later in Settings.</p>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {submitting ? 'Creating account…' : t('auth.signup')}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to use FarmDesk as planning support. It does not replace advice from your KVK, agriculture officer or official advisories.
        </p>
      </form>
    </AuthLayout>
  );
}
