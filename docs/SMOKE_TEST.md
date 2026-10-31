# FarmDesk — End-to-End Smoke Test

This checklist covers the full user journey against the **real local stack**. It is a
manual checklist because Playwright is not installed in this repository. Every step
must use real data from the local database and the live Edge Functions unless a step
explicitly says "offline".

Do not mark a step passed if the UI shows an error, a placeholder, or invented data.
Record the observation, screenshot or console message instead.

## 1. Prerequisites

```bash
cd /home/sarth/farmdesk

# Database + auth + storage
npx supabase status                 # all services healthy

# Edge Functions (keep this running in a second terminal)
npx supabase functions serve --env-file supabase/functions/.env

# App
npm run dev                         # http://localhost:5173
```

Optional automated checks before the manual pass:

```bash
npm test                            # unit tests (Vitest)
SUPABASE_SERVICE_ROLE_KEY=<key> npm run test:rls
SUPABASE_SERVICE_ROLE_KEY=<key> npm run test:integrations
npm run build
```

- `npm test`: 30 tests, 4 files, expected all pass.
- `test:rls`: 11 cross-tenant checks, expected all pass.
- `test:integrations`: expected `10 passed, 1 degraded, 0 failed`; the degraded item is
  the data.gov.in live feed when it returns HTTP 429. Weather, climate + cache,
  market snapshot, CSV import idempotency and the AI rules engine must pass.
- Get the service-role key from `npx supabase status`.

Create a **fresh email** for the smoke test (for example
`smoke+<timestamp>@farmdesk.local`) so the journey is not influenced by older data.

## 2. Account and onboarding

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open `/` signed out | Landing page renders, no console errors, no fake statistics |
| 2 | Switch language to मराठी and हिंदी from the landing/auth UI | Navigation and headings change; English is the fallback for any missing key |
| 3 | Open `/signup`, submit an empty form | Field-level validation messages; no request sent |
| 4 | Sign up with a fresh email, password and full name | Account created; confirmation state or signed-in state is explicit |
| 5 | If email confirmation is enabled, confirm the email | Signed-in session or a clear "confirm your email" message |
| 6 | Open `/dashboard` while onboarding is incomplete | Redirected to `/onboarding` |
| 7 | Complete onboarding: name, state, district, coordinates, area + unit | Farm saved with the unit you chose; coordinates shown back to you |
| 8 | Reload the app | Session persists; no re-onboarding |

## 3. Farm and money records

| # | Step | Expected result |
| --- | --- | --- |
| 9 | Add a second farm from `/farms` | Both farms listed; primary farm can be switched |
| 10 | Add a field to a farm | Field listed under that farm only |
| 11 | Add an expense (category, amount, date) | Row appears immediately and survives reload |
| 12 | Attach a receipt image to the expense | File uploads to the private `receipts` bucket and opens again |
| 13 | Add income with quantity × price helper | Total amount equals quantity × price (rounded as displayed) |
| 14 | Filter expenses by category and date, then page through | Counts and totals match the filtered rows |
| 15 | Export expenses as CSV and PDF | Files download and contain the same rows shown on screen |
| 16 | Open `/reports`, choose a date range covering the records | P&L, monthly cash flow and category chart use only those records |

## 4. Crops, tasks and soil

| # | Step | Expected result |
| --- | --- | --- |
| 17 | Add a crop from `/crops` with variety, area, sowing date | Crop detail opens with a stage timeline derived from the sowing date |
| 18 | Add an activity (irrigation, weeding, etc.) | Activity appears in the timeline; reload keeps it |
| 19 | Advance a stage | Stage updates and the suggested tasks reflect the new stage |
| 20 | Complete the harvest | Harvest state is recorded; crop-linked finance totals appear |
| 21 | Link an expense and income record to the crop | Crop detail totals include them; unlinked money stays out |
| 22 | Export the crop record as CSV/PDF | Export includes the crop, stages, activities and linked finance |
| 23 | Open `/soil`, add a soil record with pH and lab report | Record saves; report uploads and can be viewed/downloaded |
| 24 | Edit and delete the soil record | Edit persists; delete removes the record and its uploaded report |

## 5. Live data and recommendations

| # | Step | Expected result |
| --- | --- | --- |
| 25 | Open `/weather` | Current conditions and 7-day forecast show provider `Open-Meteo` and a retrieval time |
| 26 | Check rainfall chart and alerts | Chart matches the daily API values; alerts are labelled FarmDesk-computed |
| 27 | Open the climate section | NASA POWER monthly/seasonal data with year range and grid-size caveat |
| 28 | Open `/crop-intelligence` | Recommendations ranked from farm soil/pH/water, climate and market inputs |
| 29 | Expand a recommendation | Weighted factor scores, reasons, confidence and missing-input notice are visible |
| 30 | Confirm market data is not the dominant factor | Agronomy/climate/water weights exceed market + economics; note shown |
| 31 | Open `/market` | Live rows or a saved snapshot with source, date and stale/live label |
| 32 | If data.gov.in returns HTTP 429 | A clear rate-limit message appears; saved snapshots and CSV import remain usable |
| 33 | Import an official AGMARKNET CSV | Valid rows import; invalid rows show row-level errors; re-import is idempotent |
| 34 | Search and filter by commodity/district/market | Only matching observations are shown; no invented history |

## 6. AI, schemes and knowledge

| # | Step | Expected result |
| --- | --- | --- |
| 35 | Open `/ai` and ask about onion prices | Answer cites the saved source and date; engine badge says `FarmDesk Rules Engine` when no LLM key is set |
| 36 | Ask a question the data cannot answer | Assistant states what is missing instead of inventing a value |
| 37 | Check the disclaimer | Expert-check disclaimer and read-only notice are visible |
| 38 | Send many requests quickly | Rate-limit message appears (20 requests/hour/user) |
| 39 | Create a new conversation, reload, delete it | Conversation persists and deletion works |
| 40 | Open `/schemes` | Central/state tabs, official application links, eligibility, documents and last-verified dates |
| 41 | Open `/knowledge` and an article | Article renders headings/lists and cites its source; no placeholder text |
| 42 | Open `/settings` | Language, area unit, default farm and notifications save and persist after reload |
| 43 | Change the password, sign out, sign in with the new password | New password works; old password fails |
| 44 | Open `/profile` and edit name/phone/language | Changes persist and are reflected in the app shell |

## 7. Offline and PWA

| # | Step | Expected result |
| --- | --- | --- |
| 45 | DevTools → Network → Offline | App shell still loads from the service worker after a production build (`npm run build && npm run preview`) |
| 46 | Add an expense while offline | Row is saved locally and a queued/pending indicator is shown |
| 47 | Add a crop activity while offline | Activity is queued without a `user_id` ownership error |
| 48 | Go back online | Queue replays automatically; rows appear on the server exactly once |
| 49 | While offline, edit a row that another session changed on the server | Conflict is surfaced in Settings instead of silently overwriting |
| 50 | Resolve the conflict (keep server / apply mine) | Chosen version wins; queue clears |
| 51 | Install the PWA from the browser | Manifest name, theme colour and 192/512 icons are correct; app opens standalone |
| 52 | Check `/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.png` on the preview server | All return 200 |

## 8. Access control and failure behaviour

| # | Step | Expected result |
| --- | --- | --- |
| 53 | Sign in as a second user and open the first user's farm/crop/expense URLs | No data is returned; no cross-tenant leakage |
| 54 | Stop the `functions serve` process and open Weather | Honest failure message with retry; no stale value presented as current |
| 55 | Stop the network and reload Market | Saved snapshots or a clear offline/error state; no estimated prices |

## 9. Sign-off

Record for each run:

- Date, build commit (or `git status` if no repo), browser and viewport
- Pass/fail for every numbered step
- Any console errors, failed network requests or screenshots
- For failures: expected vs actual, and whether it is a code defect, provider outage
  (data.gov.in/IMD/AI key), or environment problem (Docker/Supabase)

### Current verified baseline (2026-10-31)

- `npx tsc --noEmit`: clean
- `npm test`: 30 passed
- `npm run test:rls`: 11 passed
- `npm run test:integrations`: 10 passed, 1 degraded (data.gov.in 429), 0 failed
- `npm run build`: clean; PWA precaches 18 entries including the main bundle
- `npm run preview`: `/`, `manifest.webmanifest`, `sw.js`, `registerSW.js`, icons and favicons all HTTP 200
- Manual browser walkthrough: **pending** — record results here when completed.
