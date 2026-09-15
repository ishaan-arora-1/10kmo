// CORS for functions the website calls from the browser. Auth uses bearer tokens,
// not cookies, so allowing an origin never exposes another user's session.

const configuredOrigins = (Deno.env.get("WEB_APP_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

export function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (configuredOrigins.includes(origin)) return origin;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
  return null;
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = allowedOrigin(request);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "origin");
    headers.set(
      "access-control-allow-headers",
      "authorization, apikey, content-type, x-client-info",
    );
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-max-age", "86400");
  }
  return headers;
}

export function withCors(
  handler: (request: Request) => Response | Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    const response = await handler(request);
    const headers = new Headers(response.headers);
    corsHeaders(request).forEach((value, key) => headers.set(key, value));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
