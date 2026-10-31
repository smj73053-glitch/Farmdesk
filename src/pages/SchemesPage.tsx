import * as React from 'react';
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Landmark,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSchemes } from '@/hooks/useFarmOps';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/common/states';
import { VerificationBadge } from '@/components/common/DataSourceBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Scheme } from '@/types/models';

function schemeTitle(scheme: Scheme, language: string): string {
  if (language === 'mr' && scheme.name_mr) return scheme.name_mr;
  if (language === 'hi' && scheme.name_hi) return scheme.name_hi;
  return scheme.name;
}

export function SchemesPage() {
  const { t, i18n } = useTranslation();
  const schemesQuery = useSchemes();
  const [search, setSearch] = React.useState('');
  const [level, setLevel] = React.useState<'all' | 'central' | 'state'>('all');

  const schemes = schemesQuery.data ?? [];
  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return schemes.filter((scheme) => {
      if (level !== 'all' && scheme.level !== level) return false;
      if (!term) return true;
      return [scheme.name, scheme.name_mr, scheme.name_hi, scheme.summary, scheme.benefits, scheme.state]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
    });
  }, [schemes, level, search]);

  const centraCount = schemes.filter((scheme) => scheme.level === 'central').length;
  const stateCount = schemes.filter((scheme) => scheme.level === 'state').length;

  return (
    <div>
      <PageHeader
        title={t('nav.schemes')}
        subtitle="Government agricultural schemes with their official application pages. Always confirm current eligibility with the issuing office."
        icon={Landmark}
        meta={
          <>
            <Badge variant="outline" className="gap-1 font-normal"><ShieldCheck className="h-3 w-3" /> Official links</Badge>
            <span>{schemes.length} active scheme{schemes.length === 1 ? '' : 's'} in the reference list</span>
          </>
        }
      />

      <Notice tone="warning" title="Verify before applying">
        Scheme rules, deadlines and benefit amounts change. FarmDesk lists the official source and the date it was last verified,
        but the issuing department's page is the final authority. FarmDesk does not submit applications or guarantee approval.
      </Notice>

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={level} onValueChange={(value) => setLevel(value as typeof level)}>
            <TabsList>
              <TabsTrigger value="all">All ({schemes.length})</TabsTrigger>
              <TabsTrigger value="central">Central ({centraCount})</TabsTrigger>
              <TabsTrigger value="state">State ({stateCount})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search scheme name or benefit" className="h-9 pl-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      {schemesQuery.isLoading ? (
        <div className="mt-4"><LoadingBlock rows={4} /></div>
      ) : schemesQuery.error ? (
        <ErrorState className="mt-4" message={(schemesQuery.error as Error).message} onRetry={() => void schemesQuery.refetch()} />
      ) : filtered.length ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {filtered.map((scheme) => (
            <SchemeCard key={scheme.id} scheme={scheme} language={i18n.language} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={Landmark}
          title={schemes.length ? 'No schemes match this filter' : 'No schemes available'}
          description={
            schemes.length
              ? 'Try a different search term or switch between central and state schemes.'
              : 'The scheme reference list could not be loaded. Run the database migrations and refresh.'
          }
          action={search ? <Button variant="outline" size="sm" onClick={() => { setSearch(''); setLevel('all'); }}>Clear filters</Button> : undefined}
        />
      )}

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        FarmDesk is not affiliated with any government department. Listings are reference information with links to official pages.
      </p>
    </div>
  );
}

function SchemeCard({ scheme, language }: { scheme: Scheme; language: string }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={scheme.level === 'central' ? 'info' : 'success'} className="gap-1 font-normal capitalize">
            <Building2 className="h-3 w-3" /> {scheme.level}
          </Badge>
          {scheme.state ? <Badge variant="outline" className="font-normal">{scheme.state}</Badge> : null}
        </div>
        <CardTitle className="text-base leading-snug">{schemeTitle(scheme, language)}</CardTitle>
        <CardDescription>{scheme.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        {scheme.benefits ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What it offers</p>
            <p className="mt-0.5 text-xs leading-relaxed">{scheme.benefits}</p>
          </div>
        ) : null}

        {scheme.eligibility?.length ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Eligibility</p>
            <ul className="mt-1 space-y-0.5">
              {scheme.eligibility.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {scheme.required_documents?.length ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Documents usually needed</p>
            <ul className="mt-1 space-y-0.5">
              {scheme.required_documents.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs leading-relaxed">
                  <FileCheck2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" /> {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto space-y-2 pt-1">
          <VerificationBadge verifiedOn={scheme.last_verified} official />
          <p className="text-[10px] text-muted-foreground">Official source: {scheme.official_source}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={scheme.application_url} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="h-3.5 w-3.5" /> Open official application page
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
