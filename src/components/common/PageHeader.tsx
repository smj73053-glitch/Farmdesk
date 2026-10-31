import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon: Icon, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-start md:justify-between', className)}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground md:text-base">{subtitle}</p> : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
