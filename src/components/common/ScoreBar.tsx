import { cn } from '@/lib/utils';

export function scoreTone(score: number): { bar: string; text: string; label: string } {
  if (score >= 80) return { bar: 'bg-emerald-600', text: 'text-emerald-700', label: 'Strong match' };
  if (score >= 65) return { bar: 'bg-lime-600', text: 'text-lime-700', label: 'Good match' };
  if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Moderate match' };
  return { bar: 'bg-red-500', text: 'text-red-700', label: 'Weak match' };
}

export function ScoreBar({
  label,
  value,
  weight,
  description,
  className,
}: {
  label: string;
  value: number;
  weight?: string;
  description?: string;
  className?: string;
}) {
  const tone = scoreTone(value);
  const rounded = Math.round(value);
  return (
    <div className={cn('space-y-1', className)} title={description}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {weight ? <span className="text-[10px] uppercase tracking-wide">{weight}</span> : null}
          <span className={cn('font-semibold tabular-nums', tone.text)}>{rounded}/100</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', tone.bar)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
      {description ? <p className="text-[11px] leading-snug text-muted-foreground">{description}</p> : null}
    </div>
  );
}
