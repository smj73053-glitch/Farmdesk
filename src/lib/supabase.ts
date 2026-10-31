import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // The app renders a configuration screen instead of failing silently.
  console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      headers: { 'x-application-name': 'farmdesk' },
    },
  }
);

export const functionsUrl = `${(supabaseUrl || 'http://127.0.0.1:54321').replace(/\/$/, '')}/functions/v1`;

/** Upload a file to a private per-user folder and return its storage path. */
export async function uploadUserFile(
  bucket: 'receipts' | 'field-photos' | 'soil-reports',
  userId: string,
  file: File,
  prefix = ''
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${prefix}${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function signedFileUrl(
  bucket: 'receipts' | 'field-photos' | 'soil-reports',
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
