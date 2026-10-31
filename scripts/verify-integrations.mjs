#!/usr/bin/env node
/**
 * Live verification of the FarmDesk Edge Functions against the local stack.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run test:integrations
 *
 * External providers can be rate-limited or offline. A provider failure is
 * reported as DEGRADED and does not hide successful local behaviour. The script
 * never fabricates a pass: every value printed comes from the response.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2];
    }
  } catch {
    // Optional.
  }
  return env;
}

const env = loadEnv();
const url = (process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!anonKey || !serviceKey) {
  console.error('Set VITE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const functionsUrl = `${url}/functions/v1`;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const password = `Verify-${stamp}!`;
const email = `verify-${stamp}@farmdesk.local`;
let userId = null;
let pass = 0;
let degraded = 0;
let failed = 0;

function record(state, name, detail) {
  if (state === 'PASS') pass += 1;
  else if (state === 'DEGRADED') degraded += 1;
  else failed += 1;
  console.log(`${state.padEnd(8)} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(name, path, token, body) {
  const started = Date.now();
  const response = await fetch(`${functionsUrl}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { name, status: response.status, ms: Date.now() - started, json };
}

async function main() {
  console.log(`Verifying Edge Functions at ${functionsUrl}\n`);

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Integration Verify' },
  });
  if (created.error) throw new Error(created.error.message);
  userId = created.data.user.id;

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(signedIn.error.message);
  const token = signedIn.data.session?.access_token;
  if (!token) throw new Error('No access token after sign-in.');
  record('PASS', 'test user sign-in', email);

  // --- Weather (Open-Meteo) ------------------------------------------------
  const weather = await call('weather', 'weather', token, { latitude: 18.5204, longitude: 73.8567 });
  if (weather.status === 200 && weather.json?.available && Array.isArray(weather.json.daily) && weather.json.daily.length >= 1) {
    const first = weather.json.daily[0];
    record('PASS', 'weather', `${weather.json.daily.length} daily rows · source ${weather.json.source} · ${first.date} max ${first.tempMax}°C · ${weather.ms}ms`);
    if (weather.json.cached) record('PASS', 'weather cache', 'served from the saved observation table');
  } else {
    record('FAIL', 'weather', `HTTP ${weather.status}: ${JSON.stringify(weather.json).slice(0, 240)}`);
  }

  // --- Climate (NASA POWER) ------------------------------------------------
  const climate = await call('climate', 'climate', token, { latitude: 18.5204, longitude: 73.8567, years: 5 });
  if (climate.status === 200 && climate.json?.available && Array.isArray(climate.json.months) && climate.json.months.length > 0) {
    const annualRain = climate.json.months.reduce((sum, month) => sum + Number(month.rainfall ?? 0), 0) / 5;
    record(
      'PASS',
      'climate',
      `${climate.json.months.length} monthly rows · source ${climate.json.source} · ${climate.json.gridResolution ?? 'grid n/a'} · ~${Math.round(annualRain)} mm/year · ${climate.ms}ms`
    );
    const plausible = climate.json.months.every((month) => {
      const rain = Number(month.rainfall);
      return Number.isFinite(rain) && rain >= 0 && rain <= 3000;
    }) && annualRain >= 100 && annualRain <= 8000;
    record(plausible ? 'PASS' : 'FAIL', 'climate rainfall ranges', plausible ? 'monthly totals and annual rainfall are physically plausible' : 'rainfall outside plausible bounds');

    const cached = await call('climate', 'climate', token, { latitude: 18.5204, longitude: 73.8567, years: 5 });
    record(
      cached.status === 200 && cached.json?.cached === true && cached.json.months?.length === climate.json.months.length ? 'PASS' : 'FAIL',
      'climate cache round-trip',
      cached.json?.cached ? 'second request served from the saved cache' : `second request was not cached (HTTP ${cached.status})`
    );
  } else {
    record('FAIL', 'climate', `HTTP ${climate.status}: ${JSON.stringify(climate.json).slice(0, 240)}`);
  }

  // --- Market (data.gov.in / saved snapshots) ------------------------------
  const market = await call('market', 'market', token, { commodity: 'Onion', limit: 5 });
  if (market.status === 200 && market.json?.available) {
    record('PASS', 'market', `${market.json.records?.length ?? 0} rows · ${market.json.cached ? 'saved snapshot' : 'live feed'} · ${market.json.observationDate ?? 'date n/a'} · ${market.ms}ms`);
    if (market.json.reason) record('DEGRADED', 'market live feed', market.json.reason);
  } else if (market.status === 200 && market.json?.available === false) {
    record('DEGRADED', 'market', market.json.reason ?? 'No observations available; failure reported honestly.');
  } else {
    record('FAIL', 'market', `HTTP ${market.status}: ${JSON.stringify(market.json).slice(0, 240)}`);
  }

  // --- Market CSV import (idempotent, official observation) ----------------
  const importBody = {
    fileName: `verify-${stamp}.csv`,
    records: [
      {
        commodity: 'Onion',
        state: 'Maharashtra',
        district: 'Pune',
        market_name: 'Pune APMC',
        variety: 'FAQ',
        arrival_date: '2026-10-30',
        min_price: 1800,
        max_price: 2600,
        modal_price: 2200,
        source_url: null,
      },
    ],
  };
  const imported = await call('market-import', 'market-import', token, importBody);
  const importedAgain = await call('market-import', 'market-import', token, importBody);
  if (imported.status === 200 && typeof imported.json?.inserted === 'number' && importedAgain.status === 200) {
    const idempotent = importedAgain.json.inserted === 0 || importedAgain.json.skipped >= 1;
    record(idempotent ? 'PASS' : 'FAIL', 'market CSV import', `first insert ${imported.json.inserted}, repeat insert ${importedAgain.json.inserted} / skipped ${importedAgain.json.skipped} (obs_key idempotency)`);
  } else {
    record('FAIL', 'market CSV import', `HTTP ${imported.status}/${importedAgain.status}: ${JSON.stringify(importedAgain.json).slice(0, 240)}`);
  }

  // --- AI assistant (rules engine unless AI_API_KEY is configured) ---------
  const ai = await call('ai-assistant', 'ai-assistant', token, {
    message: 'What does the current mandi data say about onion prices, and what should I check before selling?',
    language: 'en',
  });
  if (ai.status === 200 && ai.json?.message?.content) {
    const engine = ai.json.engine === 'llm' ? `LLM ${ai.json.model ?? ''}` : 'FarmDesk Rules Engine';
    record('PASS', 'ai-assistant', `${engine} · ${ai.json.sources?.length ?? 0} source(s) · ${ai.json.missing?.length ?? 0} missing input(s) · ${ai.ms}ms`);
    record(ai.json.disclaimer ? 'PASS' : 'FAIL', 'ai-assistant disclaimer', ai.json.disclaimer ? ai.json.disclaimer.slice(0, 100) + '…' : 'missing');
    const content = String(ai.json.message.content);
    const cites = /source|data|retrieved|observation/i.test(content);
    record(cites ? 'PASS' : 'DEGRADED', 'ai-assistant citations', cites ? 'answer references data provenance' : 'answer did not mention provenance explicitly; source list is still attached');
  } else if (ai.status === 429) {
    record('DEGRADED', 'ai-assistant', ai.json.error ?? 'rate limited');
  } else {
    record('FAIL', 'ai-assistant', `HTTP ${ai.status}: ${JSON.stringify(ai.json).slice(0, 240)}`);
  }

  console.log(`\n${pass} passed, ${degraded} degraded, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error('\nVerification aborted:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  // Remove the exact verification observation so the shared market table is
  // not polluted by test runs. The audit row is removed with the user.
  await admin
    .from('market_prices')
    .delete()
    .eq('obs_key', 'onion|maharashtra|pune|pune apmc|faq|2026-10-30')
    .then(() => undefined, () => undefined);
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}
