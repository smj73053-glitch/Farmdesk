import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { AuthError, requireUser, serviceClient } from '../_shared/auth.ts';
import { buildFarmContext } from './tools.ts';
import { rulesAnswer } from './rules.ts';
import { llmAnswer } from './provider.ts';

const DISCLAIMER =
  'AI answers use the data available in your FarmDesk account and the cited sources at the time shown. They can be incomplete or wrong and never guarantee yield, profit or weather. No financial or destructive action is performed automatically. Check with a local agricultural expert before acting.';

const LIMIT_PER_HOUR = Math.max(1, Number(Deno.env.get('AI_RATE_LIMIT') ?? 30) || 30);

function clean(value: unknown, max: number): string {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const message = clean(body.message, 2000);
    if (!message) return jsonResponse(req, { error: 'Ask a question to continue.' }, 400);

    const requestedFarmId = body.farmId ? clean(body.farmId, 40) : null;
    const language = ['en', 'mr', 'hi'].includes(String(body.language)) ? String(body.language) : 'en';

    // Simple per-user hourly rate limit stored server-side.
    const now = new Date();
    const { data: limit } = await admin.from('ai_rate_limits').select('*').eq('user_id', user.id).maybeSingle();
    const windowStart = limit?.window_start ? new Date(limit.window_start) : null;
    const withinWindow = windowStart != null && now.getTime() - windowStart.getTime() < 3600000;
    const used = withinWindow ? Number(limit?.request_count ?? 0) : 0;
    if (withinWindow && used >= LIMIT_PER_HOUR) {
      return jsonResponse(req, {
        error: `You have reached the FarmDesk AI limit of ${LIMIT_PER_HOUR} questions per hour. Please try again later.`,
        retryAfterMinutes: Math.ceil((3600000 - (now.getTime() - (windowStart?.getTime() ?? now.getTime()))) / 60000),
      }, 429);
    }
    await admin.from('ai_rate_limits').upsert({
      user_id: user.id,
      window_start: withinWindow ? windowStart!.toISOString() : now.toISOString(),
      request_count: used + 1,
    }, { onConflict: 'user_id' });

    // Resolve or create the conversation, always scoped to the signed-in user.
    let conversationId = body.conversationId ? clean(body.conversationId, 40) : null;
    if (conversationId) {
      const { data: existing } = await admin
        .from('ai_conversations')
        .select('id,user_id,farm_id')
        .eq('id', conversationId)
        .maybeSingle();
      if (!existing || existing.user_id !== user.id) {
        return jsonResponse(req, { error: 'Conversation not found.' }, 404);
      }
    } else {
      const { data: created, error } = await admin
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          farm_id: requestedFarmId,
          title: message.slice(0, 60),
        })
        .select('id')
        .single();
      if (error) return jsonResponse(req, { error: `Could not start the conversation: ${error.message}` }, 500);
      conversationId = created.id;
    }

    const { data: historyRows } = await admin
      .from('ai_messages')
      .select('role,content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);
    const history = (historyRows ?? []).filter((h) => h.role === 'user' || h.role === 'assistant') as Array<{ role: 'user' | 'assistant'; content: string }>;

    const { data: userMessage, error: insertUserError } = await admin
      .from('ai_messages')
      .insert({ conversation_id: conversationId, role: 'user', content: message })
      .select('id,created_at')
      .single();
    if (insertUserError) return jsonResponse(req, { error: `Could not save the question: ${insertUserError.message}` }, 500);

    const ctx = await buildFarmContext(admin, user.id, requestedFarmId);

    let content: string;
    let engine: 'llm' | 'rules' = 'rules';
    let model: string | null = null;
    const llm = await llmAnswer(ctx, message, language, history);
    if (llm) {
      content = llm.content;
      engine = 'llm';
      model = llm.model;
    } else {
      content = rulesAnswer(ctx, message, language);
      engine = 'rules';
      model = null;
    }

    const metadata = {
      engine,
      model,
      language,
      missing: ctx.missing,
      disclaimer: DISCLAIMER,
      readOnly: true,
    };

    const { data: assistantMessage, error: insertAssistantError } = await admin
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content,
        sources: ctx.sources,
        metadata,
      })
      .select('id,created_at')
      .single();
    if (insertAssistantError) {
      return jsonResponse(req, { error: `The answer was generated but could not be saved: ${insertAssistantError.message}` }, 500);
    }

    await admin.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

    return jsonResponse(req, {
      conversationId,
      message: {
        id: assistantMessage.id,
        role: 'assistant',
        content,
        sources: ctx.sources,
        metadata,
        created_at: assistantMessage.created_at,
      },
      userMessageId: userMessage.id,
      engine,
      model,
      sources: ctx.sources,
      missing: ctx.missing,
      disclaimer: DISCLAIMER,
      remainingThisHour: Math.max(0, LIMIT_PER_HOUR - (used + 1)),
    });
  } catch (error) {
    if (error instanceof AuthError) return jsonResponse(req, { error: error.message }, error.status);
    const message = error instanceof Error ? error.message : 'The assistant is unavailable';
    return jsonResponse(req, { error: message }, 500);
  }
});
