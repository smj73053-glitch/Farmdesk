import type { FarmContext } from './tools.ts';

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

function compactContext(ctx: FarmContext) {
  const expenseByCategory = new Map<string, number>();
  for (const e of ctx.expenses) {
    const key = String(e.category ?? 'other');
    expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + Number(e.amount ?? 0));
  }
  const incomeByCategory = new Map<string, number>();
  for (const i of ctx.income) {
    const key = String(i.category ?? 'other');
    incomeByCategory.set(key, (incomeByCategory.get(key) ?? 0) + Number(i.amount ?? 0));
  }
  return {
    generatedAt: ctx.generatedAt,
    farm: ctx.farm,
    allFarms: ctx.farms.map((f) => ({ id: f.id, name: f.name, total_area: f.total_area, area_unit: f.area_unit, is_primary: f.is_primary })),
    activeCrops: ctx.activeCrops.map((c) => ({
      name: (c.crop as Record<string, unknown> | null)?.name,
      stage: c.current_stage,
      sowing_date: c.sowing_date,
      expected_harvest_date: c.expected_harvest_date,
      area_planted: c.area_planted,
      area_unit: c.area_unit,
      status: c.status,
    })),
    expenses: {
      count: ctx.expenses.length,
      total: [...expenseByCategory.values()].reduce((s, v) => s + v, 0),
      byCategory: Object.fromEntries(expenseByCategory),
      latest: ctx.expenses.slice(0, 8),
      earliestDate: ctx.expenses.map((e) => e.expense_date).filter(Boolean).sort()[0] ?? null,
      latestDate: ctx.expenses.map((e) => e.expense_date).filter(Boolean).sort().at(-1) ?? null,
    },
    income: {
      count: ctx.income.length,
      total: [...incomeByCategory.values()].reduce((s, v) => s + v, 0),
      byCategory: Object.fromEntries(incomeByCategory),
      latest: ctx.income.slice(0, 8),
    },
    soilRecords: ctx.soilRecords.slice(0, 5),
    pendingTasks: ctx.tasks.slice(0, 12),
    market: {
      savedRows: ctx.marketRows.length,
      latest: ctx.marketRows.slice(0, 40),
    },
    weather: ctx.weather,
    climate: ctx.climate,
    missing: ctx.missing,
  };
}

const SYSTEM = `You are FarmDesk, a careful agricultural planning assistant for farmers in India (especially Maharashtra).

Rules you must follow:
1. Answer only from the supplied FARMDESK_CONTEXT and conversation. Never invent weather, prices, yields, schemes or farm records.
2. If data is missing, say exactly what is missing and how to add it. Do not fill gaps with guesses.
3. Cite sources inline with their names and observation/retrieval dates, e.g. "(Open-Meteo forecast, retrieved 2026-10-31)" or "(AGMARKNET snapshot, observation 2026-10-30)".
4. Clearly separate recorded facts, reference estimates and uncertainty. Never guarantee yield, profit or weather.
5. You are read-only. Do not claim to add, edit, delete, send or purchase anything.
6. Respect the requested language. Keep answers practical and concise, using short sections or bullets.
7. For crop advice, consider soil, water, season, climate and market together; do not let price dominate. Recommend checking with a local KVK/agriculture officer for important decisions.
8. If the user asks for something outside FarmDesk's data (e.g. a specific pesticide dose), give general safety guidance and tell them to confirm the label and local advisory rather than inventing a dose.`;

export async function llmAnswer(
  ctx: FarmContext,
  message: string,
  language: string,
  history: HistoryItem[]
): Promise<{ content: string; model: string } | null> {
  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) return null;
  const baseUrl = (Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';
  const langName = language === 'mr' ? 'Marathi' : language === 'hi' ? 'Hindi' : 'English';

  const messages = [
    { role: 'system', content: SYSTEM },
    {
      role: 'system',
      content: `Requested answer language: ${langName}.\n\nFARMDESK_CONTEXT (JSON):\n${JSON.stringify(compactContext(ctx))}`,
    },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content.slice(0, 4000) })),
    { role: 'user', content: message.slice(0, 4000) },
  ];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`AI provider returned ${res.status}: ${detail.slice(0, 200)}`);
      return null;
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return null;
    return { content: content.trim(), model };
  } catch (error) {
    console.warn('AI provider failed', error instanceof Error ? error.message : error);
    return null;
  }
}
