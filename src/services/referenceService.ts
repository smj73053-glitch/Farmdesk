import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/errors';
import type { KnowledgeArticle, Scheme, SourceRegistryEntry } from '@/types/models';

export const referenceService = {
  async listSchemes(): Promise<Scheme[]> {
    const { data, error } = await supabase
      .from('schemes')
      .select('*')
      .eq('is_active', true)
      .order('level', { ascending: true })
      .order('name', { ascending: true });
    throwIfError(error, 'Could not load government schemes');
    return (data ?? []) as Scheme[];
  },

  async listKnowledge(): Promise<KnowledgeArticle[]> {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('title_en', { ascending: true });
    throwIfError(error, 'Could not load knowledge articles');
    return (data ?? []) as KnowledgeArticle[];
  },

  async getKnowledge(slug: string): Promise<KnowledgeArticle | null> {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    throwIfError(error, 'Could not load this article');
    return (data as KnowledgeArticle) ?? null;
  },

  async listSources(): Promise<SourceRegistryEntry[]> {
    const { data, error } = await supabase
      .from('source_registry')
      .select('*')
      .order('provider', { ascending: true });
    throwIfError(error, 'Could not load data sources');
    return (data ?? []) as SourceRegistryEntry[];
  },
};
