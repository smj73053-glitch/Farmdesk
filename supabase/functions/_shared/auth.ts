import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.118.0';

export interface AuthContext {
  user: User;
  token: string;
  admin: SupabaseClient;
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Verify the caller's JWT. Edge Functions must never trust a user id from the body. */
export async function requireUser(req: Request): Promise<AuthContext> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new AuthError('Sign in to use this service.', 401);

  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) throw new AuthError('Your session is invalid or has expired.', 401);

  return { user: data.user, token, admin: serviceClient() };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function numberInRange(value: unknown, name: string, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return n;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], name: string, fallback?: T): T {
  if (value == null || value === '') {
    if (fallback) return fallback;
    throw new Error(`${name} is required`);
  }
  const s = String(value);
  if (!allowed.includes(s as T)) throw new Error(`${name} is not valid`);
  return s as T;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
  retries = 1
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after') ?? 0);
        await new Promise((r) => setTimeout(r, Math.min(3000, Math.max(400, retryAfter * 1000))));
        lastError = new Error(`Upstream returned ${res.status}`);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Upstream request failed');
}

export function isoDate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function safeNumber(value: unknown): number | null {
  if (value == null || value === '' || value === '-') return null;
  const n = Number(String(value).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
