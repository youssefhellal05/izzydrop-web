import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const baseHeaders = {
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin"
};

function json(
  body: unknown,
  status = 200,
  origin = "",
  extraHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...baseHeaders,
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

async function rpc(name: string, args: Record<string, unknown>) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const d = data as Record<string, unknown> | null;
    throw new Error(String(d?.message || d?.error || data || "Request failed"));
  }
  return data;
}

function originFromUrl(value: string) {
  try { return new URL(value).origin; } catch { return ""; }
}

async function clientFingerprint(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const network =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    forwarded.split(",")[0]?.trim() ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "";
  const bytes = new TextEncoder().encode(network + "|" + userAgent);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Storefront service is not configured" }, 500);

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "Invalid storefront token" }, 400);

  let context: any;
  try {
    context = await rpc("storefront_get_context", { _token: token });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Integration unavailable" }, 400);
  }

  if (!context?.integration_id || !context?.enabled) return json({ error: "This IzzyDrop web integration is not active" }, 404);

  const allowedOrigin = originFromUrl(String(context.website_url || ""));
  const requestOrigin = req.headers.get("Origin") || "";

  if (!allowedOrigin) return json({ error: "Website URL is not configured correctly" }, 400);
  if (requestOrigin && requestOrigin !== allowedOrigin) return json({ error: "This integration is registered to a different website" }, 403);
  if (req.method !== "GET" && !requestOrigin) return json({ error: "Website origin is required" }, 403);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...baseHeaders, "Access-Control-Allow-Origin": allowedOrigin } });
  }

  if (req.method === "GET") {
    let shipping: any = { service_area: "Cairo", available: false, delivery_fee: null, currency: "EGP" };
    try {
      shipping = await rpc("marketplace_shipping_quote", {});
    } catch {}

    return json({
      product_id: context.product_id,
      slug: context.slug,
      name: context.name,
      name_en: context.name_en,
      name_ar: context.name_ar,
      description: context.description,
      description_en: context.description_en,
      description_ar: context.description_ar,
      currency: context.currency,
      retail_price: context.retail_price,
      supplier_name: context.supplier_name,
      image_url: context.image_url,
      variants: context.variants || [],
      shipping
    }, 200, allowedOrigin);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, allowedOrigin);

  try {
    const clientHash = await clientFingerprint(req);
    const limit: any = await rpc("storefront_check_rate_limit", {
      _token: token,
      _client_hash: clientHash
    });
    if (limit?.allowed !== true) {
      const retryAfter = Math.max(1, Number(limit?.retry_after_seconds || 60));
      return json(
        { error: "Too many checkout attempts. Please wait and try again." },
        429,
        allowedOrigin,
        { "Retry-After": String(retryAfter) }
      );
    }
  } catch {
    return json({ error: "Checkout is temporarily unavailable. Please try again shortly." }, 503, allowedOrigin);
  }

  try {
    const body = await req.json();
    if (String(body?.website || "").trim()) return json({ ok: true }, 200, allowedOrigin);

    const result = await rpc("storefront_create_order", {
      _token: token,
      _variant_id: body?.variant_id,
      _quantity: Number(body?.quantity || 1),
      _customer_name: String(body?.customer_name || ""),
      _customer_phone: String(body?.customer_phone || ""),
      _customer_email: body?.customer_email ? String(body.customer_email) : null,
      _shipping_address: {
        address1: String(body?.address1 || ""),
        city: String(body?.city || ""),
        governorate: String(body?.governorate || "")
      },
      _idempotency_key: String(body?.idempotency_key || "")
    });

    return json({ ok: true, ...result }, 200, allowedOrigin);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not place order" }, 400, allowedOrigin);
  }
});