import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Bug,
  CalendarDays,
  Droplets,
  Landmark,
  Receipt,
  Search,
  Sprout,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useKnowledgeArticles } from '@/hooks/useFarmOps';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { KnowledgeArticle } from '@/types/models';

export const KNOWLEDGE_CATEGORIES = [
  { value: 'all', label: 'All topics', icon: BookOpen },
  { value: 'soil', label: 'Soil', icon: Landmark },
  { value: 'water', label: 'Water', icon: Droplets },
  { value: 'pest-disease', label: 'Pest & disease', icon: Bug },
  { value: 'market', label: 'Market', icon: TrendingUp },
  { value: 'finance', label: 'Finance', icon: Receipt },
  { value: 'crop-guide', label: 'Crop guide', icon: Sprout },
] as const;

export function knowledgeCategoryLabel(value: string): string {
  return KNOWLEDGE_CATEGORIES.find((category) => category.value === value)?.label ?? value.replace(/-/g, ' ');
}

export function KnowledgeCategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = KNOWLEDGE_CATEGORIES.find((item) => item.value === category)?.icon ?? BookOpen;
  return <Icon className={className} />;
}

export function knowledgeTitle(article: KnowledgeArticle, language: string): string {
  if (language === 'mr' && article.title_mr) return article.title_mr;
  if (language === 'hi' && article.title_hi) return article.title_hi;
  return article.title_en;
}

export function knowledgeSummary(article: KnowledgeArticle, language: string): string | null {
  if (language === 'mr' && article.summary_mr) return article.summary_mr;
  if (language === 'hi' && article.summary_hi) return article.summary_hi;
  return article.summary_en;
}

export function knowledgeBody(article: KnowledgeArticle, language: string): string | null {
  if (language === 'mr' && article.body_mr) return article.body_mr;
  if (language === 'hi' && article.body_hi) return article.body_hi;
  return article.body_en;
}

export function KnowledgePage() {
  const { t, i18n } = useTranslation();
  const articlesQuery = useKnowledgeArticles();
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('all');

  const articles = articlesQuery.data ?? [];
  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return articles.filter((article) => {
      if (category !== 'all' && article.category !== category) return false;
      if (!term) return true;
      return [
        knowledgeTitle(article, 'en'),
        article.title_mr,
        article.title_hi,
        article.summary_en,
        article.body_en,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
    });
  }, [articles, category, search]);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const article of articles) map[article.category] = (map[article.category] ?? 0) + 1;
    return map;
  }, [articles]);

  const latest = articles.reduce<string | null>((value, article) => {
    if (!article.last_verified) return value;
    if (!value || article.last_verified > value) return article.last_verified;
    return value;
  }, null);

  return (
    <div>
      <PageHeader
        title={t('nav.knowledge')}
        subtitle="Practical field guides built from ICAR, state extension and AGMARKNET guidance. Each article names its source and verification date."
        icon={BookOpen}
        meta={latest ? <span>Last verified {formatDate(latest)}</span> : undefined}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-3">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search articles, pests, irrigation, record keeping…"
              className="h-9 pl-8 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {KNOWLEDGE_CATEGORIES.map((item) => {
              const Icon = item.icon;
              const count = item.value === 'all' ? articles.length : (counts[item.value] ?? 0);
              return (
                <Button
                  key={item.value}
                  size="sm"
                  variant={category === item.value ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setCategory(item.value)}
                >
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                  <span className="ml-0.5 opacity-70">({count})</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {articlesQuery.isLoading ? (
        <div className="mt-4"><LoadingBlock rows={4} /></div>
      ) : articlesQuery.error ? (
        <ErrorState className="mt-4" message={(articlesQuery.error as Error).message} onRetry={() => void articlesQuery.refetch()} />
      ) : filtered.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((article) => (
            <Card key={article.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="gap-1 font-normal">
                    <KnowledgeCategoryIcon category={article.category} className="h-3 w-3" />
                    {knowledgeCategoryLabel(article.category)}
                  </Badge>
                  {article.last_verified ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" /> {formatDate(article.last_verified)}
                    </span>
                  ) : null}
                </div>
                <CardTitle className="mt-1 text-base leading-snug">
                  <Link to={`/knowledge/${article.slug}`} className="hover:text-primary hover:underline">
                    {knowledgeTitle(article, i18n.language)}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-3">
                  {knowledgeSummary(article, i18n.language) ?? 'Open the article for the field guidance.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-2">
                <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-xs">
                  <Link to={`/knowledge/${article.slug}`}>
                    Read article <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={BookOpen}
          title={articles.length ? 'No articles match this search' : 'No articles available'}
          description={articles.length ? 'Try another topic or clear the search.' : 'The knowledge reference could not be loaded. Run the migrations and refresh.'}
          action={search || category !== 'all' ? (
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setCategory('all'); }}>Clear filters</Button>
          ) : undefined}
        />
      )}

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Knowledge articles summarise published guidance. They do not replace a soil test, a laboratory diagnosis or your local agriculture officer's advice.
      </p>
    </div>
  );
}
