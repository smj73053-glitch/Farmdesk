import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function LoadingBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-32" />
        <Skeleton className="mt-3 h-3 w-40" />
      </CardContent>
    </Card>
  );
}

export function InlineSpinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}

export function ErrorState({
  title = 'Could not load this data',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn('border-red-200 bg-red-50/60', className)} role="alert">
      <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-950">{title}</p>
            {message ? <p className="mt-1 text-sm text-red-900/80">{message}</p> : null}
          </div>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OfflineState({ message = 'You are offline. Saved data is still available; new entries will sync when you reconnect.' }: { message?: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50/70">
      <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-950">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{message}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'success';
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  }[tone];
  const Icon = tone === 'success' ? CheckIcon : tone === 'warning' ? AlertCircle : InfoIcon;
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm', styles, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && 'mt-0.5')}>{children}</div>
      </div>
    </div>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}
