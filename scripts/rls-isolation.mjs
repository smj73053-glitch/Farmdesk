#!/usr/bin/env node
/**
 * Live row-level security isolation check against the local Supabase stack.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run test:rls
 *
 * The URL and anon key are read from .env. The service role key must never be
 * shipped to the browser; pass it as an environment variable for this script.
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
    // .env is optional when the values are supplied by the environment.
  }
  return env;
}

const env = loadEnv();
const url = process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!anonKey) {
  console.error('Missing anon key. Set VITE_SUPABASE_ANON_KEY in .env or SUPABASE_ANON_KEY.');
  process.exit(2);
}
if (!serviceKey) {
  console.error('Missing service role key. Run: SUPABASE_SERVICE_ROLE_KEY=<key> npm run test:rls');
  console.error('Get it with: npx supabase status');
  process.exit(2);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const password = `RlsTest-${stamp}!`;
const users = [];

let failures = 0;
function check(name, passed, detail = '') {
  if (passed) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function createUser(label) {
  const email = `rls-${label}-${stamp}@farmdesk.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${label}` },
  });
  if (error) throw new Error(`Could not create ${label}: ${error.message}`);
  users.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in ${email}: ${error.message}`);
  return client;
}

async function main() {
  console.log(`RLS isolation check against ${url}\n`);

  const alice = await createUser('alice');
  const bob = await createUser('bob');
  const aliceClient = await signIn(alice.email);
  const bobClient = await signIn(bob.email);

  // Profile bootstrap is handled by the signup trigger.
  const { data: aliceProfile } = await aliceClient.from('profiles').select('id, full_name').eq('id', alice.id).maybeSingle();
  check('signup trigger creates the profile', Boolean(aliceProfile));

  const farmName = `RLS farm ${stamp}`;
  const { data: farm, error: farmError } = await aliceClient
    .from('farms')
    .insert({ user_id: alice.id, name: farmName, state: 'Maharashtra', district: 'Pune', total_area: 1, area_unit: 'acres' })
    .select('*')
    .single();
  if (farmError) throw new Error(`Alice could not create a farm: ${farmError.message}`);
  check('owner can insert a farm', Boolean(farm?.id));

  const { data: aliceSeesOwn } = await aliceClient.from('farms').select('id').eq('id', farm.id);
  check('owner can read their own farm', (aliceSeesOwn ?? []).length === 1);

  const { data: bobSeesAlice, error: bobSelectError } = await bobClient.from('farms').select('id').eq('id', farm.id);
  check('other user cannot read the farm', !bobSelectError && (bobSeesAlice ?? []).length === 0, bobSelectError?.message);

  const { error: bobInsertError } = await bobClient
    .from('farms')
    .insert({ user_id: alice.id, name: `${farmName} forged`, total_area: 1, area_unit: 'acres' });
  check('other user cannot insert a row owned by someone else', Boolean(bobInsertError), bobInsertError?.message);

  const { data: bobUpdate } = await bobClient.from('farms').update({ name: 'Hijacked' }).eq('id', farm.id).select('id');
  check('other user cannot update the farm', (bobUpdate ?? []).length === 0);

  const { data: afterUpdate } = await aliceClient.from('farms').select('name').eq('id', farm.id).single();
  check('farm name is unchanged after the attempted update', afterUpdate?.name === farmName);

  const { data: expense, error: expenseError } = await aliceClient
    .from('expenses')
    .insert({ user_id: alice.id, farm_id: farm.id, category: 'seeds', amount: 1500, expense_date: new Date().toISOString().slice(0, 10) })
    .select('*')
    .single();
  if (expenseError) throw new Error(`Alice could not add an expense: ${expenseError.message}`);

  const { data: bobSeesExpenses } = await bobClient.from('expenses').select('id').eq('id', expense.id);
  check('other user cannot read the expense', (bobSeesExpenses ?? []).length === 0);

  const { error: bobDeleteError } = await bobClient.from('expenses').delete().eq('id', expense.id);
  const { data: expenseStillThere } = await aliceClient.from('expenses').select('id').eq('id', expense.id);
  check(
    'other user cannot delete the expense',
    (expenseStillThere ?? []).length === 1,
    bobDeleteError?.message
  );

  const { data: bobFarms } = await bobClient.from('farms').select('id').eq('user_id', alice.id);
  check('filtering by another user id returns nothing', (bobFarms ?? []).length === 0);

  // Anon role must not see private tables at all.
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: anonFarms, error: anonError } = await anon.from('farms').select('id').limit(1);
  check('signed-out client cannot read farms', Boolean(anonError) || (anonFarms ?? []).length === 0, anonError?.message);

  console.log(`\n${failures === 0 ? 'All RLS checks passed.' : `${failures} RLS check(s) failed.`}`);
  if (failures > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error('\nRLS check aborted:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  for (const id of users) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}
