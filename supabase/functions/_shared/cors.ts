const defaultOrigin = '*';

function getAllowedOrigin(req: Request): string {
  const configured = Deno.env.get('ALLOWED_ORIGIN');
  if (configured) return configured;
  const origin = req.headers.get('origin');
  // Local dev origins are allowed by default. Production should set ALLOWED_ORIGIN.
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return defaultOrigin;
}

export function corsHeaders(req: Request): HeadersInit {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function jsonResponse(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  return null;
}
