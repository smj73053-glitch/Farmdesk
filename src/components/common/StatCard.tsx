import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'green' | 'amber' | 'sky' | 'soil' | 'neutral' | 'red';

const toneStyles: Record<Tone, { icon: string; value: string }> = {
  green: { icon: 'bg-emerald-50 text-emerald-700', value: 'text-foreground' },
  amber: { icon: 'bg-amber-50 text-amber-700', value: 'text-foreground' },
  sky: { icon: 'bg-sky-50 text-sky-700', value: 'text-foreground' },
  soil: { icon: 'bg-orange-50 text-orange-800', value: 'text-foreground' },
  neutral: { icon: 'bg-muted text-muted-foreground', value: 'text-foreground' },
  red: { icon: 'bg-red-50 text-red-700', value: 'text-foreground' },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  change?: { value: number; label?: string; goodWhenUp?: boolean };
  footer?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'green', change, footer, className }: StatCardProps) {
  const positive = change ? change.value >= 0 : false;
  const good = change ? (change.goodWhenUp ?? true) === positive : false;
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex items-start gap-3 p-4 md:p-5">
        {Icon ? (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneStyles[tone].icon)}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className={cn('text-xl font-bold leading-tight md:text-2xl', toneStyles[tone].value)}>{value}</span>
            {change ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  good ? 'text-emerald-700' : 'text-red-600'
                )}
                title={change.label}
              >
                {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change.value).toFixed(1)}%
              </span>
            ) : null}
          </div>
          {hint ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{hint}</p> : null}
          {footer ? <div className="mt-2">{footer}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
