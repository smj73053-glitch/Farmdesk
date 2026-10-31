# FarmDesk — Task Tracker

Statuses: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

Last updated: 2026-10-31

## Recovery & foundation

- [x] Inspect existing project, database and routes
- [x] Recover state after interruption
- [x] Confirm migrations `00001`–`00005` applied
- [x] Confirm local Supabase is running
- [x] Document architecture and API integrations
- [x] Create `DEVELOPMENT_STATUS.md`, `TASKS.md`, `README.md`
- [x] Fix offline insert `user_id` bug for `crop_activities`
- [x] Widen CSV export row type
- [x] Remove unsupported `Array.prototype.at` usage
- [x] Fix `SettingsPage` `formatFetchedAt` import
- [x] Fix `climate` Edge Function cache key (`start_year` / `end_year`)
- [x] Remove stale malformed `climate_cache` summary row

## Phase 1 — Account, farm, dashboard

- [x] Email/password signup + login + email confirmation flow
- [x] Password reset request and password change
- [x] Profile bootstrap trigger + preferences
- [x] Farm onboarding with geocoding and coordinates
- [x] Dashboard with real aggregates
- [x] Responsive app shell, farm switcher, notifications
- [x] Farm management: multiple farms, fields, primary farm
- [x] Landing page

## Phase 2 — Crops, finance, tasks, reports

- [x] Crop reference data (30 crops / 29 varieties)
- [x] Crop Intelligence scoring engine with explanations
- [x] Expenses CRUD + filters + pagination + charts
- [x] Expense receipt upload (private storage)
- [x] Income CRUD + filters + pagination + charts
- [x] Quantity × price helper for income
- [x] CSV + PDF export on expenses and income
- [x] Offline queue for expenses and income (insert/update/delete)
- [x] Tasks service + dashboard display
- [x] Crop lifecycle list + detail
- [x] Activity log with offline writes
- [x] Harvest completion + stage timeline
- [x] Financial Reports page (P&L, monthly cash flow, category split, crop returns)
- [x] Reports combined ledger CSV + multi-section PDF
- [x] Crop register CSV/PDF export
- [x] Crop detail CSV/PDF export (stages, activities, linked finance)

## Phase 3 — Live data

- [x] Weather Edge Function → Open-Meteo, cache, honest failure
- [x] Weather page: current, hourly, 7-day, rainfall chart, provider/time
- [x] Historical climate Edge Function → NASA POWER, monthly/seasonal
- [x] NASA POWER `PRECTOTCORR` mm/day → monthly total conversion
- [x] Climate page section with observation range and source caveat
- [x] Market Edge Function → data.gov.in resource `9ef84268-d588-465a-a308-a864a43d0070`
- [x] Market page: search, filters, min/max/modal, market comparison, stale notice
- [x] Official AGMARKNET CSV import with validation + audit
- [x] Price history from real snapshots/imports only
- [x] Weather alert generation from real forecast + thresholds
- [x] Alert persistence and dismissal
- [x] Source registry display (Weather + Settings)
- [x] Re-verify all three live integrations after restart (weather PASS, climate PASS, market PASS with live feed degraded)
- [x] Document data.gov.in 429 limitation in UI and docs
- [x] Climate cache round-trip verified after cache-key fix

## Soil, AI, reference, account

- [x] Soil records CRUD
- [x] Soil report upload/view (private bucket, delete removes report)
- [x] Soil pH guidance and CSV/PDF export
- [x] AI Assistant conversations + messages (create, list, delete)
- [x] AI citations, engine label, missing-input disclosure, disclaimer
- [x] AI rate-limit messaging
- [x] Government schemes browser with official links, eligibility, documents
- [x] Knowledge articles list + detail
- [x] Settings: profile language, area unit, default farm, notifications
- [x] Settings: password change
- [x] Settings: offline queue + conflict resolution
- [x] Settings: data source registry
- [x] Settings: sign-out confirmation
- [x] Profile page

## PWA, i18n, quality

- [x] Generate favicon + 192/512 + apple-touch icons
- [x] Verify installable manifest and offline shell (build, preview pending manual check)
- [x] Expand Marathi translation for all used keys
- [x] Expand Hindi translation for all used keys
- [x] Locale key parity check (en / mr / hi all report no missing keys)
- [x] Add Vitest setup + unit tests (units, recommendation, csv, finance summary)
- [x] Add RLS isolation test (two users, cross-tenant denial)
- [x] Add smoke-test checklist (`docs/SMOKE_TEST.md`); Playwright not installed
- [x] Run `npx tsc --noEmit` clean
- [x] Run `npm test` (30 passed)
- [x] Run `npm run test:rls` (11 passed)
- [x] Run `npm run test:integrations` (10 passed, 1 degraded, 0 failed)
- [x] Run `npm run build` clean; PWA precaches 18 entries
- [x] Update README / status docs with final results

## Remaining manual verification

- [~] Browser walkthrough of `docs/SMOKE_TEST.md` (auth → farm → expense → crop → weather → market → AI → offline → PWA → i18n)
- [x] Confirm PWA manifest/icons/service worker over `npm run preview` (all HTTP 200)
- [~] Test Marathi/Hindi text rendering with real stored preferences

## Blocked / external

- [!] data.gov.in public sample key returns HTTP 429 — integration degrades honestly; saved snapshots and CSV import work.
- [!] IMD has no stable public JSON API — official links only; no invented endpoint.
- [!] `AI_API_KEY` absent — rules engine fallback is active and labelled.
- [!] Live market feed cannot be re-tested until a non-throttled data.gov.in key is available.
