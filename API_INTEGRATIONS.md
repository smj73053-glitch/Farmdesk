# FarmDesk API Integrations

All third-party calls are proxied through Supabase Edge Functions except Open-Meteo
geocoding (CORS-enabled, no key). Every response stores a retrieval timestamp.

## 1. Open-Meteo — Forecast & Current Weather

- Provider: Open-Meteo (open source, free for non-commercial use)
- Base: `https://api.open-meteo.com/v1/forecast`
- Auth: none
- Edge function: `weather`
- Cache: `weather_cache` for 30 minutes (forecast), keyed by rounded lat/lon
- Fields: current temperature/apparent temperature/humidity/precipitation/weather code/
  wind/pressure; hourly temperature, humidity, rain probability, rain, weather code, wind;
  daily max/min, rainfall sum, rain probability, wind, sunrise/sunset, UV, ET₀
- Timezone: `Asia/Kolkata`, requested explicitly
- Failure: function returns `available: false`, `reason`, and never fabricates values.
- Docs: https://open-meteo.com/en/docs

**Historical comparison** on the weather page uses the NOAA/Open-Meteo archive API only
for the comparison period displayed; climate trends use NASA POWER below.

## 2. Open-Meteo Geocoding — Location search

- Base: `https://geocoding-api.open-meteo.com/v1/search`
- Auth: none. Used by onboarding to find a village/town and confirm coordinates.
- We never use device geolocation as the farm location; the user must confirm.

## 3. NASA POWER — Historical Climate

- Provider: NASA Langley Research Center (public)
- Base: `https://power.larc.nasa.gov/api/temporal/monthly/point`
- Parameters: `PRECTOTCORR`, `T2M`, `T2M_MAX`, `T2M_MIN`, `RH2M`, `ALLSKY_SFC_SW_DWN`
- Community: `AG`, format JSON
- Edge function: `climate`; cache table `climate_cache` 24 hours
- Cache key: `(latitude, longitude, start_year, end_year, source)`; the full monthly
  payload is stored so cached responses keep `months`, `annual`, normals and seasons.
- NASA POWER `PRECTOTCORR` is a **mean daily rate (mm/day)**. The function multiplies by
  the number of days in each month before summing annual rainfall.
- Coverage: 1981–present, 0.5°×0.625° grid; the UI shows the grid resolution caveat.
- Docs: https://power.larc.nasa.gov/docs/services/api/
- Verified by `npm run test:integrations`: publish → read-back cache round-trip.

## 4. data.gov.in — Daily Mandi Prices (AGMARKNET feed)

- Provider: Government of India, Open Government Data Platform
- Resource: `9ef84268-d588-465a-a308-a864a43d0070`
  ("Current Daily Price of Various Commodities from Various Markets (Mandi)")
- Base: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- Auth: API key (`DATA_GOV_API_KEY`, server-side only). The sample/public key is used
  for the local demo only and is documented in `.env.example`.
- Edge function: `market`
- Filters: `filters[state.keyword]`, `filters[district.keyword]`,
  `filters[commodity.keyword]`; pagination via `limit` / `offset`.
- Caching: in-memory per-instance 10 minutes + daily snapshot rows in `market_prices`.
- Minimum, maximum and modal prices are stored and displayed as distinct values.
- Freshness: `arrival_date` (observation) vs `fetched_at` (retrieval) are shown separately.
- If unavailable: "Data unavailable" with retry, plus CSV import from an official
  AGMARKNET export.
- Current local limitation: the public sample key returns HTTP 429 ("Rate limit
  exceeded"). The function reports `available: false`/`reason` honestly and falls back
  to saved snapshots; CSV import remains fully functional.
- History: built from FarmDesk daily snapshots and imported official CSV files. No
  synthetic history is generated.
- Docs: https://data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi

## 5. India Meteorological Department (IMD)

IMD does not publish a stable public JSON API. FarmDesk therefore:
- does not scrape or invent an endpoint;
- links to official IMD/Mausam bulletins and district warnings in the Weather module;
- derives FarmDesk alerts only from the real Open-Meteo forecast with explicit,
  documented thresholds, and labels them "FarmDesk forecast alert", not "IMD warning".

Official links: https://mausam.imd.gov.in/ and https://mausam.imd.gov.in/responsive/all_india_forcast_bulletin.php

## 6. AI provider (optional)

- Abstraction in `supabase/functions/ai-assistant/provider.ts`
- Environment: `AI_API_KEY`, `AI_BASE_URL` (default `https://api.openai.com/v1`),
  `AI_MODEL` (default `gpt-4o-mini`), `AI_PROVIDER` (`openai-compatible`)
- If `AI_API_KEY` is absent the function uses the deterministic FarmDesk Rules Engine
  over the same tool results and labels the response accordingly. No fabricated AI output.
- Tools are read-only and scoped to the verified user.
- Rate limit: 20 requests/hour/user stored in `ai_rate_limits`.

## 7. Agricultural reference data (bundled, versioned)

These are curated reference tables, not live feeds:
- Crop agronomic requirements (`crops`, `crop_varieties`) compiled from ICAR/state
  extension guidance; values are ranges and displayed with a "reference" badge.
- Government schemes (`schemes`) with official application URLs and `last_verified` dates.
- Mandi coordinates for distance estimates (approximate; labelled).
- Knowledge articles with sources and verification dates.

Nothing in these tables is presented as a live observation.

## Source registry

Every provider is recorded in `source_registry` with dataset, update frequency,
geographic coverage, quality notes and retrieval date. The UI exposes this registry on
the Weather and Settings pages.
