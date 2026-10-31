import { AlertTriangle, CheckCircle2, Clock3, Database, ExternalLink, FlaskConical, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatFetchedAt } from '@/lib/weather';
import { cn } from '@/lib/utils';

interface DataSourceBadgeProps {
  provider: string;
  fetchedAt?: string | null;
  sourceUrl?: string | null;
  stale?: boolean;
  cached?: boolean;
  observationDate?: string | null;
  estimate?: boolean;
  note?: string;
  className?: string;
}

/**
 * Honest labelling for every number that comes from an external provider or an
 * estimate. Never let cached or estimated data look like a live observation.
 */
export function DataSourceBadge({
  provider,
  fetchedAt,
  sourceUrl,
  stale,
  cached,
  observationDate,
  estimate,
  note,
  className,
}: DataSourceBadgeProps) {
  const title = [
    `Source: ${provider}`,
    fetchedAt ? `Fetched: ${formatFetchedAt(fetchedAt)}` : null,
    observationDate ? `Observation date: ${observationDate}` : null,
    stale ? 'Data may be stale.' : null,
    cached ? 'Served from cache.' : null,
    estimate ? 'Calculated estimate, not an observed value.' : null,
    note,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground', className)} title={title}>
      <Badge variant="outline" className="gap-1 font-normal">
        {estimate ? <FlaskConical className="h-3 w-3" /> : <Database className="h-3 w-3" />}
        {provider}
      </Badge>
      {cached ? <Badge variant="secondary" className="font-normal">Cached</Badge> : null}
      {stale ? (
        <Badge variant="warning" className="gap-1 font-normal">
          <Clock3 className="h-3 w-3" /> May be stale
        </Badge>
      ) : null}
      {estimate ? <Badge variant="info" className="font-normal">Estimate</Badge> : null}
      {fetchedAt ? <span>Updated {formatFetchedAt(fetchedAt)}</span> : null}
      {observationDate ? <span>· Data for {observationDate}</span> : null}
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
        >
          Source <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

const severityStyles: Record<string, string> = {
  low: 'border-sky-200 bg-sky-50 text-sky-900',
  medium: 'border-amber-200 bg-amber-50 text-amber-900',
  high: 'border-orange-200 bg-orange-50 text-orange-950',
  critical: 'border-red-200 bg-red-50 text-red-950',
};

export function SeverityBadge({ severity, label }: { severity: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize',
        severityStyles[severity] ?? severityStyles.low
      )}
    >
      {severity === 'critical' || severity === 'high' ? <AlertTriangle className="h-3 w-3" /> : <Info className="h-3 w-3" />}
      {label ?? severity}
    </span>
  );
}

export function VerificationBadge({ verifiedOn, official }: { verifiedOn?: string | null; official?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant={official ? 'success' : 'outline'} className="gap-1 font-normal">
        <CheckCircle2 className="h-3 w-3" />
        {official ? 'Official source' : 'Reference'}
      </Badge>
      {verifiedOn ? <span>Last verified {verifiedOn}</span> : <span>Verification date not recorded</span>}
    </div>
  );
}
