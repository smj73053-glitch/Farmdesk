import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ExternalLink, ShieldCheck } from 'lucide-react';
import { useKnowledgeArticle, useKnowledgeArticles } from '@/hooks/useFarmOps';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/utils';
import {
  KnowledgeCategoryIcon,
  knowledgeBody,
  knowledgeCategoryLabel,
  knowledgeSummary,
  knowledgeTitle,
} from '@/pages/KnowledgePage';

const URL_PATTERN = /^https?:\/\//i;

function ArticleBody({ body }: { body: string }) {
  const lines = body.split(/\r?\n/);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {lines.map((raw, index) => {
        const line = raw.trim();
        if (!line) return null;
        const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
        if (numbered) {
          return (
            <div key={index} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {numbered[1]}
              </span>
              <p className="min-w-0 flex-1">{numbered[2]}</p>
            </div>
          );
        }
        const bullet = line.match(/^[-•*]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <p className="min-w-0 flex-1">{bullet[1]}</p>
            </div>
          );
        }
        if (line.startsWith('#')) {
          return <h2 key={index} className="pt-2 text-base font-semibold">{line.replace(/^#+\s*/, '')}</h2>;
        }
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

export function KnowledgeArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const articleQuery = useKnowledgeArticle(slug);
  const articlesQuery = useKnowledgeArticles();
  const article = articleQuery.data ?? null;

  const related = React.useMemo(() => {
    if (!article) return [];
    return (articlesQuery.data ?? [])
      .filter((item) => item.slug !== article.slug && item.category === article.category)
      .slice(0, 3);
  }, [article, articlesQuery.data]);

  if (articleQuery.isLoading) {
    return <LoadingBlock rows={6} />;
  }

  if (articleQuery.error) {
    return <ErrorState title="Could not load this article" message={(articleQuery.error as Error).message} onRetry={() => void articleQuery.refetch()} />;
  }

  if (!article) {
    return (
      <div>
        <PageHeader title="Article not found" subtitle="This knowledge article may have been removed." icon={BookOpen} />
        <EmptyState
          icon={BookOpen}
          title="Article not found"
          description="It may have been renamed or is no longer published."
          action={<Button asChild><Link to="/knowledge"><ArrowLeft className="h-4 w-4" /> All knowledge articles</Link></Button>}
        />
      </div>
    );
  }

  const body = knowledgeBody(article, i18n.language);

  return (
    <div>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/knowledge"><ArrowLeft className="h-3.5 w-3.5" /> Knowledge</Link>
        </Button>
      </div>

      <PageHeader
        title={knowledgeTitle(article, i18n.language)}
        subtitle={knowledgeSummary(article, i18n.language) ?? undefined}
        icon={BookOpen}
        meta={
          <>
            <Badge variant="outline" className="gap-1 font-normal">
              <KnowledgeCategoryIcon category={article.category} className="h-3 w-3" />
              {knowledgeCategoryLabel(article.category)}
            </Badge>
            {article.last_verified ? (
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Verified {formatDate(article.last_verified)}</span>
            ) : (
              <span>Verification date not recorded</span>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardContent className="p-5 md:p-7">
            {body ? <ArticleBody body={body} /> : <p className="text-sm text-muted-foreground">This article has no body text yet.</p>}
            <Separator className="my-5" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex items-start gap-1.5 font-medium text-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> Source
              </p>
              <p>{article.source ?? 'Source not recorded for this article.'}</p>
              {article.last_verified ? <p>Last verified {formatDate(article.last_verified)}</p> : null}
            </div>
            <p className="mt-4 rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              This is general guidance. Crop, soil, weather and local conditions vary. Confirm pesticide doses on the product label
              and important decisions with your KVK or agriculture officer.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Keep reading</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {related.length ? related.map((item) => (
                <Link key={item.id} to={`/knowledge/${item.slug}`} className="block rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
                  <p className="text-xs font-medium leading-snug">{knowledgeTitle(item, i18n.language)}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{knowledgeSummary(item, i18n.language) ?? 'Read more'}</p>
                </Link>
              )) : (
                <p className="text-xs text-muted-foreground">No related articles in this topic yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-semibold">Apply this to your farm</p>
              <Button asChild variant="outline" size="sm" className="w-full justify-between text-xs">
                <Link to="/crops">Open crop lifecycle <ArrowRight className="h-3 w-3" /></Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-between text-xs">
                <Link to="/weather">Check your forecast <ArrowRight className="h-3 w-3" /></Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-between text-xs">
                <Link to="/ai">Ask the assistant <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>

          {article.source && URL_PATTERN.test(article.source) ? (
            <Button asChild variant="ghost" size="sm" className="w-full text-xs">
              <a href={article.source} target="_blank" rel="noreferrer noopener">
                Official source <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">{t('app.name')} knowledge articles are reference summaries, not official publications.</p>
    </div>
  );
}
