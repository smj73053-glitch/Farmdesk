import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Sprout className="h-7 w-7" />
      </span>
      <div className="text-center">
        <p className="text-lg font-bold">FarmDesk</p>
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { session, loading, configured } = useAuth();
  const location = useLocation();

  if (loading) return <Splash />;

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold">Supabase is not configured</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set <code className="rounded bg-muted px-1">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-muted px-1">VITE_SUPABASE_ANON_KEY</code> in your environment, then restart the app.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export function NotFoundPage() {
  const { session } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <span className="text-5xl font-black text-primary/20">404</span>
      <h1 className="text-2xl font-bold">This page does not exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be outdated. Return to {session ? 'your dashboard' : 'the FarmDesk home page'} to continue.
      </p>
      <Button asChild>
        <a href={session ? '/dashboard' : '/'}>{session ? 'Go to dashboard' : 'Go to home page'}</a>
      </Button>
    </div>
  );
}
