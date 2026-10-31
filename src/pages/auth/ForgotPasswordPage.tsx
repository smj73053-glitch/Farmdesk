import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { forgotPasswordSchema, firstError } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordReset(parsed.data.email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We will email you a secure link to set a new password."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check the spam folder too.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? (
            <Alert className="border-red-200 bg-red-50 text-red-950">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
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
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
