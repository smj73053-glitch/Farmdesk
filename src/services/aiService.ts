import { supabase, functionsUrl } from '@/lib/supabase';
import { AppError, throwIfError } from '@/lib/errors';
import type { AiChatMessage, AiSource, Language } from '@/types/models';

export interface AiConversation {
  id: string;
  user_id: string;
  farm_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiSendResult {
  conversationId: string;
  message: AiChatMessage;
  userMessageId: string;
  engine: 'llm' | 'rules';
  model: string | null;
  sources: AiSource[];
  missing: string[];
  disclaimer: string;
  remainingThisHour: number;
}

export const aiService = {
  async listConversations(limit = 30): Promise<AiConversation[]> {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);
    throwIfError(error, 'Could not load conversations');
    return (data ?? []) as AiConversation[];
  },

  async listMessages(conversationId: string): Promise<AiChatMessage[]> {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    throwIfError(error, 'Could not load messages');
    return (data ?? []) as AiChatMessage[];
  },

  async deleteConversation(id: string): Promise<void> {
    const { error } = await supabase.from('ai_conversations').delete().eq('id', id);
    throwIfError(error, 'Could not delete conversation');
  },

  async send(input: {
    message: string;
    conversationId?: string | null;
    farmId?: string | null;
    language?: Language;
  }): Promise<AiSendResult> {
    const { data: session } = await supabase.auth.getSession();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(`${functionsUrl}/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.session?.access_token
            ? { Authorization: `Bearer ${session.session.access_token}` }
            : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const payload = json as { error?: string; message?: string; retryAfterMinutes?: number } | null;
        const message = payload?.error ?? payload?.message ?? `The assistant returned ${res.status}`;
        throw new AppError(
          payload?.retryAfterMinutes
            ? `${message} Try again in about ${payload.retryAfterMinutes} minutes.`
            : message,
          `AI_${res.status}`
        );
      }
      return json as AiSendResult;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError('The assistant took too long to reply. Please try a shorter question.', 'AI_TIMEOUT');
      }
      throw new AppError(
        error instanceof Error ? error.message : 'The assistant is unavailable right now.',
        'AI_UNAVAILABLE',
        error
      );
    } finally {
      clearTimeout(timer);
    }
  },
};
