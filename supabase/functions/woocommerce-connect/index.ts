import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ALLOWED_ORIGIN = "https://youssefhellal05.github.io";

function json(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Headers": "authorization, content-type, apikey",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin"
    }
  });
}

function normalizeStoreUrl(raw: unknown): URL {
  if (typeof raw !== "string" || raw.length > 500) throw new Error("Enter your store's HTTPS URL.");
  const url = new URL(raw.trim());
  if (url.protocol !== "https:") throw new Error("Your WooCommerce store must use HTTPS.");
  if (url.username || url.password || url.search || url.hash) throw new Error("Enter only the store URL, without credentials, query strings, or fragments.");
  if (url.port && url.port !== "443") throw new Error("Custom ports are not supported.");
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local") || /^[0-9.]+$/.test(url.hostname) || url.hostname.includes(":")) {
    throw new Error("Private and local network addresses are not supported.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

async function getJson(url: string, key: string, secret: string) {
  const auth = btoa(key + ":" + secret);
  const response = await fetch(url, {
    headers: { Authorization: "Basic " + auth, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    redirect: "error"
  });
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("WooCommerce rejected these API credentials. Check that the consumer key and secret are correct and have Read/Write access.");
    throw new Error("WooCommerce connection check failed (HTTP " + response.status + "). Confirm WooCommerce REST API is enabled.");
  }
  try { return JSON.parse(text); } catch { throw new Error("The store returned an invalid API response."); }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin && origin !== ALLOWED_ORIGIN) return new Response(JSON.stringify({ error: "Origin not allowed." }), {
    status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin"
  }});
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Connection service is not configured" }, 500, origin);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) return json({ error: "Sign in to connect a store." }, 401, origin);

  const userResponse = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + jwt }
  });
  if (!userResponse.ok) return json({ error: "Your session is invalid or expired. Sign in again." }, 401, origin);
  const user = await userResponse.json();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400, origin); }
  let store: URL;
  try { store = normalizeStoreUrl(body.store_url); } catch (e) { return json({ error: e instanceof Error ? e.message : "Invalid store URL." }, 400, origin); }

  const key = typeof body.consumer_key === "string" ? body.consumer_key.trim() : "";
  const secret = typeof body.consumer_secret === "string" ? body.consumer_secret.trim() : "";
  if (!/^ck_[A-Za-z0-9]{20,}$/.test(key) || !/^cs_[A-Za-z0-9]{20,}$/.test(secret)) {
    return json({ error: "Enter a WooCommerce consumer key (ck_…) and consumer secret (cs_…). Create them under WooCommerce → Settings → Advanced → REST API." }, 400, origin);
  }

  const profileResponse = await fetch(SUPABASE_URL + "/rest/v1/dropshippers?select=id&profile_id=eq." + encodeURIComponent(user.id) + "&limit=1", {
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY }
  });
  if (!profileResponse.ok) return json({ error: "Could not verify your IzzyDrop account." }, 500, origin);
  const profiles = await profileResponse.json();
  if (!profiles?.[0]?.id) return json({ error: "Only dropshipper accounts can connect a WooCommerce store." }, 403, origin);

  let system: Record<string, unknown>;
  try {
    system = await getJson(store.origin + store.pathname + "/wp-json/wc/v3/system_status", key, secret);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not verify WooCommerce credentials." }, 400, origin);
  }

  const environment = system.environment && typeof system.environment === "object"
    ? system.environment as Record<string, unknown> : {};
  const settings = system.settings && typeof system.settings === "object"
    ? system.settings as Record<string, unknown> : {};
  const storeName = typeof environment.site_url === "string" ? environment.site_url : store.hostname;
  const currency = typeof settings.woocommerce_currency === "string" ? settings.woocommerce_currency : null;

  const saved = await fetch(SUPABASE_URL + "/rest/v1/woocommerce_store_credentials?on_conflict=dropshipper_id,store_url", {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      dropshipper_id: profiles[0].id,
      store_url: store.origin + store.pathname,
      consumer_key: key,
      consumer_secret: secret,
      store_name: storeName,
      currency,
      updated_at: new Date().toISOString()
    })
  });
  if (!saved.ok) return json({ error: "The store was verified, but IzzyDrop could not save the connection. Please try again." }, 500, origin);
  return json({ ok: true, platform: "woocommerce", store_url: store.origin + store.pathname, store_name: storeName, message: "WooCommerce store connected. Product publishing is the next step." }, 200, origin);
});
