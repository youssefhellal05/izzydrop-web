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

function ipv4Number(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function ipv4InCidr(ip: string, base: number, prefix: number): boolean {
  const value = ipv4Number(ip);
  if (value === null) return true;
  const divisor = 2 ** (32 - prefix);
  return Math.floor(value / divisor) === Math.floor(base / divisor);
}

function isPublicIPv4(ip: string): boolean {
  const denied: Array<[number, number]> = [
    [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10],
    [0x7f000000, 8], [0xa9fe0000, 16], [0xac100000, 12],
    [0xc0000000, 24], [0xc0000200, 24], [0xc0586300, 24],
    [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24],
    [0xcb007100, 24], [0xe0000000, 4], [0xf0000000, 4]
  ];
  return ipv4Number(ip) !== null && !denied.some(([base, prefix]) => ipv4InCidr(ip, base, prefix));
}

function ipv6Words(ip: string): number[] | null {
  let value = ip.toLowerCase().split("%")[0];
  if (!value || value.includes(":::")) return null;
  if (value.includes(".")) {
    const cut = value.lastIndexOf(":");
    if (cut < 0) return null;
    const v4 = ipv4Number(value.slice(cut + 1));
    if (v4 === null) return null;
    const high = Math.floor(v4 / 65536).toString(16);
    const low = (v4 % 65536).toString(16);
    value = value.slice(0, cut + 1) + high + ":" + low;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (left.concat(right).some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  let words: number[];
  if (halves.length === 1) {
    if (left.length !== 8) return null;
    words = left.map((part) => parseInt(part, 16));
  } else {
    const fill = 8 - left.length - right.length;
    if (fill < 1) return null;
    words = left.map((part) => parseInt(part, 16))
      .concat(Array.from({ length: fill }, () => 0), right.map((part) => parseInt(part, 16)));
  }
  return words.length === 8 ? words : null;
}

function isPublicIPv6(ip: string): boolean {
  const words = ipv6Words(ip);
  if (!words) return false;
  // Only global-unicast 2000::/3 is accepted. Special-purpose and transition
  // ranges are rejected even though some fall inside that broad allocation.
  if (words[0] < 0x2000 || words[0] > 0x3fff) return false;
  if (words[0] === 0x2001 && words[1] <= 0x01ff) return false; // IETF special-purpose 2001::/23
  if (words[0] === 0x2001 && words[1] === 0x0db8) return false; // documentation
  if (words[0] === 0x2002) return false; // 6to4 transition
  if (words[0] === 0x3fff && (words[1] & 0xfff0) === 0) return false; // documentation 3fff::/20
  return true;
}

function isPublicAddress(ip: string): boolean {
  return ip.includes(":") ? isPublicIPv6(ip) : isPublicIPv4(ip);
}

async function resolvePublicAddresses(hostname: string): Promise<string[]> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.includes(":") || /^[0-9.]+$/.test(host) ||
      host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      host.endsWith(".test") || host.endsWith(".invalid")) {
    throw new Error("Private and local network addresses are not supported.");
  }
  const lookups = await Promise.allSettled([
    Deno.resolveDns(host, "A"),
    Deno.resolveDns(host, "AAAA")
  ]);
  const addresses: string[] = [];
  for (const lookup of lookups) {
    if (lookup.status === "fulfilled") addresses.push(...lookup.value);
  }
  const unique = Array.from(new Set(addresses));
  if (!unique.length) throw new Error("The store hostname could not be resolved publicly.");
  // Reject mixed public/private DNS responses instead of selecting only the safe-looking record.
  if (unique.some((ip) => !isPublicAddress(ip))) {
    throw new Error("The store hostname resolves to a private or reserved network address.");
  }
  return unique;
}

async function assertPublicHostname(hostname: string): Promise<void> {
  await resolvePublicAddresses(hostname);
}

type SecureHttpResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  text: () => Promise<string>;
};

function findBytes(data: Uint8Array, needle: number[], start = 0): number {
  outer: for (let i = start; i <= data.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (data[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function joinBytes(chunks: Uint8Array[], length: number): Uint8Array {
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function decodeChunkedBody(body: Uint8Array): Uint8Array {
  const output: Uint8Array[] = [];
  let outputLength = 0;
  let cursor = 0;
  const crlf = [13, 10];
  while (cursor < body.length) {
    const lineEnd = findBytes(body, crlf, cursor);
    if (lineEnd < 0) throw new Error("WooCommerce returned malformed HTTP framing.");
    const sizeLine = new TextDecoder().decode(body.slice(cursor, lineEnd)).split(";")[0].trim();
    if (!/^[0-9a-f]+$/i.test(sizeLine)) throw new Error("WooCommerce returned malformed HTTP framing.");
    const chunkSize = Number.parseInt(sizeLine, 16);
    cursor = lineEnd + 2;
    if (!Number.isSafeInteger(chunkSize) || chunkSize < 0 || chunkSize > 8 * 1024 * 1024) {
      throw new Error("WooCommerce response exceeded the allowed size.");
    }
    if (chunkSize === 0) return joinBytes(output, outputLength);
    if (cursor + chunkSize + 2 > body.length ||
        body[cursor + chunkSize] !== 13 || body[cursor + chunkSize + 1] !== 10) {
      throw new Error("WooCommerce returned incomplete HTTP framing.");
    }
    output.push(body.slice(cursor, cursor + chunkSize));
    outputLength += chunkSize;
    if (outputLength > 8 * 1024 * 1024) throw new Error("WooCommerce response exceeded the allowed size.");
    cursor += chunkSize + 2;
  }
  throw new Error("WooCommerce returned incomplete HTTP framing.");
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason instanceof Error ? signal.reason : new DOMException("Request timed out.", "TimeoutError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new DOMException("Request timed out.", "TimeoutError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error) => { signal.removeEventListener("abort", onAbort); reject(error); }
    );
  });
}

async function writeAll(conn: Deno.Conn, data: Uint8Array, signal: AbortSignal): Promise<void> {
  let offset = 0;
  while (offset < data.length) {
    const written = await abortable(conn.write(data.subarray(offset)), signal);
    if (written <= 0) throw new Error("Connection closed while sending request.");
    offset += written;
  }
}

async function readHttpResponse(conn: Deno.Conn, signal: AbortSignal): Promise<SecureHttpResponse> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const buffer = new Uint8Array(16384);
  const delimiter = [13, 10, 13, 10];
  let headerEnd = -1;
  while (headerEnd < 0) {
    const count = await abortable(conn.read(buffer), signal);
    if (count === null) throw new Error("WooCommerce closed the connection before returning HTTP headers.");
    const part = buffer.slice(0, count);
    chunks.push(part);
    total += count;
    if (total > 8 * 1024 * 1024) throw new Error("WooCommerce response exceeded the allowed size.");
    const current = joinBytes(chunks, total);
    headerEnd = findBytes(current, delimiter);
    if (headerEnd >= 0) {
      // Keep the already-read body bytes together with the header bytes.
      const headerText = new TextDecoder().decode(current.slice(0, headerEnd));
      const lines = headerText.split("\r\n");
      const statusMatch = lines.shift()?.match(/^HTTP\/1\.[01]\s+(\d{3})(?:\s|$)/);
      if (!statusMatch) throw new Error("WooCommerce returned an invalid HTTP status line.");
      const status = Number(statusMatch[1]);
      const headers = new Headers();
      for (const line of lines) {
        const separator = line.indexOf(":");
        if (separator <= 0) throw new Error("WooCommerce returned malformed HTTP headers.");
        headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
      }
      const whole = current;
      let body = whole.slice(headerEnd + 4);
      while (true) {
        const countBody = await abortable(conn.read(buffer), signal);
        if (countBody === null) break;
        const partBody = buffer.slice(0, countBody);
        if (total + countBody > 8 * 1024 * 1024) throw new Error("WooCommerce response exceeded the allowed size.");
        chunks.push(partBody);
        total += countBody;
        body = joinBytes(chunks, total).slice(headerEnd + 4);
      }
      if (headers.get("content-encoding") && headers.get("content-encoding")?.toLowerCase() !== "identity") {
        throw new Error("WooCommerce returned an unsupported compressed response.");
      }
      if (headers.get("transfer-encoding")?.toLowerCase().split(",").map((v) => v.trim()).includes("chunked")) {
        body = decodeChunkedBody(body);
      } else {
        const contentLength = headers.get("content-length");
        if (contentLength !== null) {
          if (!/^\d+$/.test(contentLength)) throw new Error("WooCommerce returned an invalid content length.");
          const expected = Number(contentLength);
          if (body.length < expected) throw new Error("WooCommerce returned an incomplete response body.");
          body = body.slice(0, expected);
        }
      }
      if (status === 204 || status === 304) body = new Uint8Array(0);
      if (body.length > 8 * 1024 * 1024) throw new Error("WooCommerce response exceeded the allowed size.");
      const bodyText = new TextDecoder().decode(body);
      return { ok: status >= 200 && status < 300, status, headers, text: async () => bodyText };
    }
  }
  throw new Error("WooCommerce returned malformed HTTP data.");
}

async function secureHttpsRequest(rawUrl: string | URL, init: RequestInit = {}, timeoutMs = 12000): Promise<SecureHttpResponse> {
  const url = new URL(rawUrl.toString());
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Only public HTTPS destinations on port 443 are supported.");
  }
  const addresses = await resolvePublicAddresses(url.hostname);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("WooCommerce request timed out.", "TimeoutError")), timeoutMs);
  let activeConn: Deno.Conn | undefined;
  let requestStarted = false;
  let lastError: unknown;
  try {
    for (const address of addresses) {
      try {
        const tcp = await abortable(Deno.connect({ hostname: address, port: 443, signal: controller.signal }), controller.signal);
        activeConn = tcp;
        const tls = await abortable(Deno.startTls(tcp, { hostname: url.hostname }), controller.signal);
        activeConn = tls;
        const method = (init.method || "GET").toUpperCase();
        let payload: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
        if (init.body !== undefined && init.body !== null) {
          if (typeof init.body === "string") payload = new TextEncoder().encode(init.body);
          else if (init.body instanceof Uint8Array) payload = init.body;
          else throw new Error("Unsupported request payload type.");
        }
        const headers = new Headers(init.headers || {});
        headers.delete("host");
        headers.delete("connection");
        headers.delete("transfer-encoding");
        headers.delete("content-length");
        headers.set("Host", url.host);
        headers.set("Connection", "close");
        headers.set("Accept-Encoding", "identity");
        if (init.body !== undefined && init.body !== null) headers.set("Content-Length", String(payload.length));
        const requestTarget = url.pathname + url.search || "/";
        const headerLines = [method + " " + requestTarget + " HTTP/1.1"];
        for (const [name, value] of headers.entries()) {
          if (/[\r\n]/.test(name + value)) throw new Error("Invalid HTTP header.");
          headerLines.push(name + ": " + value);
        }
        headerLines.push("", "");
        const requestHead = new TextEncoder().encode(headerLines.join("\r\n"));
        requestStarted = true;
        await writeAll(tls, requestHead, controller.signal);
        if (payload.length) await writeAll(tls, payload, controller.signal);
        return await readHttpResponse(tls, controller.signal);
      } catch (error) {
        activeConn?.close();
        activeConn = undefined;
        if (controller.signal.aborted) throw new DOMException("WooCommerce request timed out. Try again.", "TimeoutError");
        if (requestStarted) throw error;
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Could not connect to the public store address.");
  } finally {
    clearTimeout(timer);
    activeConn?.close();
  }
}

async function getJson(url: string, key: string, secret: string) {
  const auth = btoa(key + ":" + secret);
  const response = await secureHttpsRequest(new URL(url), {
    method: "GET",
    headers: { Authorization: "Basic " + auth, Accept: "application/json" }
  }, 12000);
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

  if (body.action === "status" || body.action === "disconnect") {
    const profileResponse = await fetch(SUPABASE_URL + "/rest/v1/dropshippers?select=id&profile_id=eq." + encodeURIComponent(user.id) + "&limit=1", {
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY },
      redirect: "error",
      signal: AbortSignal.timeout(12000)
    });
    if (!profileResponse.ok) return json({ error: "Could not verify your IzzyDrop account." }, 500, origin);
    const profiles = await profileResponse.json();
    const dropshipperId = profiles?.[0]?.id;
    if (!dropshipperId) return json({ error: "Only dropshipper accounts can manage WooCommerce stores." }, 403, origin);

    if (body.action === "status") {
      const response = await fetch(SUPABASE_URL + "/rest/v1/woocommerce_store_credentials?select=store_url,store_name,currency,connected_at&dropshipper_id=eq." + encodeURIComponent(dropshipperId) + "&limit=1", {
        headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY },
        redirect: "error",
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) return json({ error: "Could not load WooCommerce connection status." }, 500, origin);
      const rows = await response.json();
      const row = rows?.[0];
      return json(row ? {
        ok: true, connected: true, store_url: row.store_url,
        store_name: row.store_name, currency: row.currency, connected_at: row.connected_at
      } : { ok: true, connected: false }, 200, origin);
    }

    const removed = await fetch(SUPABASE_URL + "/rest/v1/woocommerce_store_credentials?dropshipper_id=eq." + encodeURIComponent(dropshipperId), {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, Prefer: "return=minimal" },
      redirect: "error",
      signal: AbortSignal.timeout(12000)
    });
    if (!removed.ok) return json({ error: "Could not disconnect WooCommerce. Please try again." }, 500, origin);
    return json({
      ok: true, connected: false,
      message: "WooCommerce disconnected. Products already published in your store remain there; IzzyDrop has removed its saved connection and mappings."
    }, 200, origin);
  }

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
    await assertPublicHostname(store.hostname);
    system = await getJson(store.origin + store.pathname + "/wp-json/wc/v3/system_status", key, secret);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not verify WooCommerce credentials." }, 400, origin);
  }

  const environment = system.environment && typeof system.environment === "object"
    ? system.environment as Record<string, unknown> : {};
  const settings = system.settings && typeof system.settings === "object"
    ? system.settings as Record<string, unknown> : {};
  const storeName = typeof environment.site_url === "string" ? environment.site_url : store.hostname;
  const currencyValue = settings.woocommerce_currency && typeof settings.woocommerce_currency === "object"
    ? (settings.woocommerce_currency as Record<string, unknown>).value : settings.woocommerce_currency;
  const currency = typeof currencyValue === "string" ? currencyValue.toUpperCase() : null;

  const saved = await fetch(SUPABASE_URL + "/rest/v1/woocommerce_store_credentials?on_conflict=dropshipper_id", {
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
  return json({ ok: true, platform: "woocommerce", store_url: store.origin + store.pathname, store_name: storeName, message: "WooCommerce store connected and verified. You can now publish products and sync current variant prices and stock." }, 200, origin);
});
