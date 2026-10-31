# FarmDesk — Architecture

## Overview

FarmDesk is a mobile-first React/TypeScript PWA backed by Supabase (PostgreSQL, Auth,
Storage, Edge Functions). It combines real agricultural data sources with a deterministic
crop-suitability engine and a grounded AI assistant.

```
Browser (React + Vite + TanStack Query + PWA)
   │
   ├── Supabase Auth (JWT, session persistence)
   ├── PostgREST (all private CRUD, protected by RLS)
   ├── Supabase Storage (receipts, field photos, soil reports)
   └── Supabase Edge Functions
         ├── weather     → Open-Meteo (forecast + geocoding)
         ├── climate     → NASA POWER (historical monthly)
         ├── market      → data.gov.in / AGMARKNET-compatible imports
         └── ai-assistant→ provider abstraction + grounded tools
```

## Key decisions

| Concern | Decision |
| --- | --- |
| Private data isolation | PostgreSQL RLS on every table. Ownership is either direct `user_id` or reached through `farms.user_id`. |
| External API keys | Only in Edge Function secrets (`supabase/functions/.env` locally, project secrets in production). Never `VITE_*`. |
| Weather | Open-Meteo is called through an Edge Function so the client never depends on third-party CORS and responses can be cached in `weather_cache`. |
| Climate | NASA POWER monthly point API through an Edge Function, cached 24h. |
| Market | data.gov.in "Current Daily Price" resource (AGMARKNET feed) through an Edge Function; daily snapshots persisted in `market_prices` so price history can be built. CSV import supports official AGMARKNET exports. |
| AI | Edge Function implements a read-only tool layer. LLM is optional and pluggable (OpenAI-compatible). Without a model key, a deterministic Rules Engine answers from the same tools and is labelled as such. |
| Offline | IndexedDB outbox (`idb`) for expenses, income, activities and tasks. UUIDs generated client-side, idempotent upserts, base-version conflict detection. |
| Units | Canonical internal area = hectares. Display in acres/hectares/guntha. |
| Language | i18next with en/mr/hi resource files; user preference persisted in `profiles` + `user_preferences`. |
| Money | INR, numeric(14,2) in Postgres, `Intl.NumberFormat('en-IN')`. |

## Data flow

1. User signs up → `handle_new_user` trigger creates `profiles` + `user_preferences`.
2. Onboarding creates a `farms` row (geocoded via Open-Meteo geocoding, user confirms).
3. Dashboard queries farms/crops/expenses/income from Postgres, forecast from `weather`
   function, market snapshot from `market`, recommendations computed client/server-side
   from the crop reference table + climate + market data.
4. Every external response carries `fetchedAt`, `source`, `observationDate`, and an
   availability status. Stale cache responses are labelled stale and never shown as live.
5. AI calls `ai-assistant` with a farm id. The function verifies the JWT, checks rate
   limits, gathers tool results with RLS bypassed **but scoped to the verified user id**,
   then either calls the LLM with the tool payload or produces a deterministic answer.

## Database domains

- Identity: `profiles`, `user_preferences`
- Farm: `farms`, `farm_fields`, `soil_records`, `farm_documents`
- Crops: `crops` (reference), `crop_varieties` (reference), `farm_crops`, `crop_activities`
- Finance: `expenses`, `income_records`
- Market: `market_prices`, `market_imports`
- Weather/climate: `weather_cache`, `climate_cache`, `weather_alerts`, `weather_records`
- Intelligence: `crop_recommendations`, `ai_conversations`, `ai_messages`, `ai_rate_limits`
- Work: `farm_tasks`, `notifications`
- Reference: `source_registry`, `schemes`, `knowledge_articles`

## Recommendation engine

Weighted, explainable scoring over six dimensions:

| Dimension | Default weight |
| --- | --- |
| Climate fit | 25% |
| Soil fit | 20% |
| Water fit | 20% |
| Agronomic/season fit | 15% |
| Market attractiveness | 12% |
| Risk & economics | 8% |

Missing inputs reduce confidence rather than producing fake scores. All weights,
component scores and the reasons behind them are returned and displayed. Market price is
capped in influence; a high price cannot carry an otherwise unsuitable crop.

Every projected revenue/profit is a **range** computed from reference yield and cost
ranges, explicitly labelled as an estimate — never a guarantee.

## Security

- `service_role` key exists only inside Edge Functions.
- Edge Functions verify the caller JWT and scope all queries by the verified user id.
- RLS tests create two users and assert zero cross-tenant reads/writes.
- Storage buckets are private with per-user path policies.
- AI tools are read-only; no function can mutate financial records.
- Rate limits: 20 AI requests/hour/user (DB-backed).
