# FarmDesk

**Your Farm. Your Data. Smarter Decisions.**

FarmDesk is a mobile-first agricultural intelligence PWA for Indian farmers, with a focus on Maharashtra. It combines real farm records with live weather, historical climate, official mandi prices and an explainable crop-suitability engine.

> FarmDesk is planning support. It does not guarantee yield, price, weather or profit. Verify important decisions with your local agriculture officer, KVK or official advisory.

## Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS, shadcn/ui, Lucide, Recharts, React Router 7, TanStack Query, react-i18next
- **Backend:** Supabase Postgres, Auth, Storage, Edge Functions (Deno)
- **Validation:** Zod
- **Offline:** IndexedDB outbox (`idb`) with idempotent replay and conflict detection
- **Exports:** PapaParse (CSV), jsPDF + autotable (PDF)
- **PWA:** `vite-plugin-pwa`

## Local setup

```bash
npm install
cp .env.example .env          # fill local Supabase URL + anon key
npx supabase start            # Docker required
npx supabase migration up --local
npx supabase functions serve --env-file supabase/functions/.env
npm run dev
```

Local endpoints:

- App: `http://localhost:5173`
- Supabase API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Database: `127.0.0.1:54322`

### Environment variables

Root `.env` (client-safe only):

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=...
VITE_APP_ENV=development
```

`supabase/functions/.env` (server-side secrets):

```env
DATA_GOV_API_KEY=...      # data.gov.in API key
# Optional AI provider (OpenAI-compatible)
# AI_API_KEY=...
# AI_BASE_URL=https://api.openai.com/v1
# AI_MODEL=gpt-4o-mini
# AI_PROVIDER=openai-compatible
```

Never expose a Supabase service-role key or third-party secret through `VITE_*`.

## Data sources

| Data | Source | Behaviour |
| --- | --- | --- |
| Current weather + 7-day forecast | Open-Meteo | Edge function `weather`; cached 30 min; labelled provider/time; honest failure |
| Historical monthly climate | NASA POWER | Edge function `climate`; cached 24 h; 0.5°×0.625° grid caveat |
| Mandi prices | data.gov.in / AGMARKNET resource `9ef84268-d588-465a-a308-a864a43d0070` | Edge function `market`; daily snapshots; official CSV import fallback |
| IMD warnings | mausam.imd.gov.in | Official links only; no undocumented API is called or invented |
| AI | OpenAI-compatible provider or FarmDesk Rules Engine | Read-only tools; no key → labelled deterministic rules engine |

Every displayed external value carries a source and retrieval time. Estimates are labelled as estimates.

## What works

- Email/password auth, confirmation, password reset, persistent session
- Farm onboarding with confirmed coordinates and geocoding
- Multiple farms and fields; primary farm switcher
- Dashboard with real farm, finance, weather and task aggregates
- Weather: current conditions, hourly, 7-day, rainfall chart, climate comparison, forecast alerts
- Crop Intelligence: weighted, explainable scores from real farm inputs, NASA POWER climate and saved/imported mandi prices; season override
- Market: live search, min/max/modal prices, market comparison, real price history, official CSV import
- Crop lifecycle: crop records, stage timeline, activities, suggested tasks, harvest completion
- Expenses and income: CRUD, filters, pagination, charts, receipt storage, CSV/PDF export, offline writes
- Soil records and lab-report upload
- AI assistant with citations, engine label and expert-check disclaimer
- Reports: multi-section PDF/CSV exports
- Schemes and knowledge articles with official sources and verification dates
- Settings: language, units, default farm, notifications, password, offline conflicts, data sources
- PWA install + offline expense/activity entry with queued sync

See `DEVELOPMENT_STATUS.md` and `TASKS.md` for the live, honest status.

## Offline behaviour

Expenses, income, crop activities and tasks can be written while offline:

1. The write is stored in an IndexedDB outbox with a client-generated `client_mutation_id`.
2. When online, the outbox replays. Inserts are idempotent through a unique index.
3. Updates compare `updated_at`; if the server row changed, the item is marked as a conflict instead of overwriting.
4. Conflicts are reviewed in **Settings** where the user can keep the server version or apply their own.

Crops, soil records and account settings still require a connection.

## Project structure

```
src/
  components/   UI primitives, layout, shared states, domain dialogs
  context/      Auth + workspace
  hooks/        React Query hooks and offline writes
  i18n/         en / mr / hi resources
  lib/          Supabase, units, CSV, PDF, validation, offline queue/sync
  pages/        Route-level pages
  services/     Database and data-provider services
  types/        Domain + generated database types
supabase/
  functions/    weather, climate, market, market-import, ai-assistant
  migrations/   00001–00005
```

## Scripts

```bash
npm run dev               # Vite dev server
npm run build             # type-check + production build (PWA service worker)
npm run preview           # preview the production build
npm test                  # Vitest unit tests (30 tests)
npm run test:watch        # Vitest in watch mode
npm run test:rls          # cross-tenant RLS isolation (needs service-role key)
npm run test:integrations # live Edge Function verification (needs service-role key)
```

The RLS and integration scripts create temporary users and delete them afterwards.
Pass the service-role key explicitly; never put it in `.env` or client code:

```bash
SUPABASE_SERVICE_ROLE_KEY=<key> npm run test:rls
SUPABASE_SERVICE_ROLE_KEY=<key> npm run test:integrations
```

Get the key from `npx supabase status`. Edge Functions must be running
(`npx supabase functions serve --env-file supabase/functions/.env`) for the
integration check.

Expected results on the current local stack:

- `npx tsc --noEmit` — clean
- `npm test` — 30 passed
- `npm run test:rls` — 11 passed
- `npm run test:integrations` — 10 passed, 1 degraded (data.gov.in HTTP 429), 0 failed
- `npm run build` — clean; PWA precaches 18 entries
- `npm run preview` — `/`, manifest, `sw.js`, `registerSW.js`, icons and favicons return HTTP 200

A full manual journey is documented in `docs/SMOKE_TEST.md`.

## Known limitations

- The data.gov.in public sample key is rate-limited (HTTP 429). The UI says so and offers saved snapshots + official CSV import instead of inventing data.
- IMD publishes no stable public JSON API; FarmDesk links to official bulletins and labels its own forecast alerts clearly.
- Without `AI_API_KEY`, the AI assistant is a deterministic rules engine over the same read-only tools.
- The manual browser smoke test is pending; automated coverage is logic, RLS and live integrations.
- The main JS bundle is ~2.2 MB minified (633 kB gzipped). It is precached so the offline shell works; route-level code splitting is a future optimisation.

## Documentation

- `ARCHITECTURE.md` — decisions, data flow, security
- `API_INTEGRATIONS.md` — endpoints, fields, caching, failure behaviour
- `DEVELOPMENT_STATUS.md` — verified state, bugs, next task
- `TASKS.md` — phase checklist
- `docs/SMOKE_TEST.md` — end-to-end manual smoke test
