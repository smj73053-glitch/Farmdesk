import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUp,
  Bot,
  CheckCircle2,
  Database,
  Loader2,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { aiService } from '@/services/aiService';
import { AI_DISCLAIMER } from '@/lib/constants';
import { formatFetchedAt } from '@/lib/weather';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { InlineSpinner, LoadingBlock, Notice } from '@/components/common/states';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AiChatMessage, Language } from '@/types/models';

const SUGGESTIONS = [
  'What does the weather forecast mean for my farm this week?',
  'What are the current mandi prices for my crops?',
  'Which crops suit my soil and climate right now?',
  'How much have I spent and earned on this farm?',
  'What field activities have I logged for my active crops?',
];

export function AiAssistantPage() {
  const { t } = useTranslation();
  const { farm, farmId } = useWorkspace();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [pendingQuestion, setPendingQuestion] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => aiService.listConversations(40),
    staleTime: 30 * 1000,
  });

  const messagesQuery = useQuery({
    queryKey: ['ai-messages', activeId],
    queryFn: () => aiService.listMessages(activeId!),
    enabled: Boolean(activeId),
    staleTime: 30 * 1000,
  });

  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];

  React.useEffect(() => {
    if (!activeId && conversations.length) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  React.useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pendingQuestion, sending]);

  const startNewChat = () => {
    setActiveId(null);
    setInput('');
    setError(null);
  };

  const send = async (question?: string) => {
    const text = (question ?? input).trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    setPendingQuestion(text);
    setInput('');
    try {
      const language = (profile?.preferred_language ?? 'en') as Language;
      const result = await aiService.send({
        message: text,
        conversationId: activeId,
        farmId: farmId ?? null,
        language,
      });
      setActiveId(result.conversationId);
      setPendingQuestion(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ai-messages', result.conversationId] }),
        queryClient.invalidateQueries({ queryKey: ['ai-conversations'] }),
      ]);
    } catch (err) {
      setPendingQuestion(null);
      setInput(text);
      setError(err instanceof Error ? err.message : 'The assistant is unavailable right now.');
    } finally {
      setSending(false);
    }
  };

  const removeConversation = async () => {
    if (!deletingId) return;
    try {
      await aiService.deleteConversation(deletingId);
      if (activeId === deletingId) setActiveId(null);
      await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      toast.success('Conversation deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this conversation.');
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void send();
  };

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant') ?? null;
  const engine = lastAssistant?.metadata?.engine ?? null;

  return (
    <div>
      <PageHeader
        title={t('nav.ai')}
        subtitle="Ask about your own farm records, weather, mandi prices and crop suitability. The assistant reads your data and cites what it used."
        icon={Sparkles}
        meta={
          <>
            <Badge variant="outline" className="gap-1 font-normal"><ShieldCheck className="h-3 w-3" /> Read-only</Badge>
            {engine ? (
              <Badge variant={engine === 'llm' ? 'info' : 'secondary'} className="font-normal">
                {engine === 'llm' ? 'AI model' : 'FarmDesk Rules Engine'}
              </Badge>
            ) : (
              <span>Answers are limited to the data in this account.</span>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="hidden h-[calc(100vh-14rem)] flex-col lg:flex">
          <div className="border-b p-3">
            <Button className="w-full" variant="outline" onClick={startNewChat}>
              <MessageSquarePlus className="h-4 w-4" /> New conversation
            </Button>
          </div>
          <div className="hide-scrollbar flex-1 overflow-y-auto p-2">
            {conversationsQuery.isLoading ? (
              <div className="p-2"><LoadingBlock rows={2} /></div>
            ) : conversations.length ? (
              <ul className="space-y-1">
                {conversations.map((conversation) => (
                  <li key={conversation.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => { setActiveId(conversation.id); setError(null); }}
                      className={cn(
                        'w-full rounded-lg px-2.5 py-2 pr-8 text-left text-xs transition-colors',
                        activeId === conversation.id
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <span className="line-clamp-2 font-medium">{conversation.title}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {formatFetchedAt(conversation.updated_at)}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Delete conversation"
                      onClick={() => setDeletingId(conversation.id)}
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-xs text-muted-foreground">No conversations yet. Ask your first question.</p>
            )}
          </div>
        </Card>

        <Card className="flex h-[calc(100vh-14rem)] min-h-[520px] flex-col">
          <div className="hide-scrollbar flex-1 overflow-y-auto p-4">
            {!activeId && !pendingQuestion && messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Ask FarmDesk about your farm</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  The assistant can read your farm records, linked expenses and income, logged activities, live weather,
                  historical climate and saved or imported mandi prices. It cannot change any record.
                </p>
                {farm ? <p className="mt-2 text-xs text-muted-foreground">Using data for <span className="font-medium text-foreground">{farm.name}</span>.</p> : null}
                <div className="mt-5 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="rounded-lg border p-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : messagesQuery.isLoading && activeId ? (
              <LoadingBlock rows={4} />
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {pendingQuestion ? (
                  <div className="flex justify-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                      {pendingQuestion}
                    </div>
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserRound className="h-3.5 w-3.5" />
                    </span>
                  </div>
                ) : null}
                {sending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <InlineSpinner label="Reading your farm data…" />
                  </div>
                ) : null}
                {error ? (
                  <Notice tone="warning" title="The assistant could not answer">
                    {error}
                  </Notice>
                ) : null}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder={sending ? 'Waiting for the assistant…' : 'Ask about weather, market prices, crops or your farm records…'}
                disabled={sending}
                className="min-h-[52px] resize-none text-sm"
              />
              <Button type="submit" size="icon" className="h-[52px] w-12 shrink-0" disabled={sending || !input.trim()} title="Send question">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </form>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {AI_DISCLAIMER} FarmDesk never performs financial or destructive actions from a chat.
            </p>
          </div>
        </Card>
      </div>

      {/* Mobile conversation control */}
      <div className="mt-3 flex items-center justify-between gap-2 lg:hidden">
        <Button variant="outline" size="sm" onClick={startNewChat}>
          <MessageSquarePlus className="h-3.5 w-3.5" /> New chat
        </Button>
        <span className="text-xs text-muted-foreground">{conversations.length} saved conversation{conversations.length === 1 ? '' : 's'}</span>
      </div>

      <ConfirmDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title="Delete this conversation?"
        description="The question and answer history will be removed from your account. This cannot be undone."
        confirmLabel="Delete conversation"
        destructive
        onConfirm={removeConversation}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: AiChatMessage }) {
  const isUser = message.role === 'user';
  const engine = message.metadata?.engine;
  const sources = message.sources ?? [];
  const missing = message.metadata?.missing ?? [];

  if (isUser) {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="h-3.5 w-3.5" />
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 max-w-[88%] space-y-2">
        <div className="whitespace-pre-line rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={engine === 'llm' ? 'info' : 'secondary'} className="gap-1 font-normal text-[10px]">
            {engine === 'llm' ? <Sparkles className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {engine === 'llm' ? 'AI model' : 'Rules engine'}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{formatFetchedAt(message.created_at)}</span>
          {message.metadata?.model ? <span className="text-[10px] text-muted-foreground">· {message.metadata.model}</span> : null}
        </div>
        {sources.length ? (
          <div className="space-y-1 rounded-lg border bg-muted/30 p-2">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Database className="h-3 w-3" /> Sources used
            </p>
            {sources.map((source, index) => (
              <div key={`${source.provider}-${source.dataset}-${index}`} className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{source.provider}</span>
                {' · '}{source.dataset}
                {source.observationDate ? ` · data for ${source.observationDate}` : ''}
                {' · '}retrieved {formatFetchedAt(source.retrievedAt)}
                {source.note ? <span className="block">{source.note}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
        {missing.length ? (
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Answer limited by missing data: {missing.join('; ')}.</span>
          </div>
        ) : null}
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {message.metadata?.disclaimer ?? AI_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
