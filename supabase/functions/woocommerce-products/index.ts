import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ALLOWED_ORIGIN = "https://youssefhellal05.github.io";
const API_ROOT = "/wp-json/wc/v3";

function json(body: unknown, status = 200) {
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
  if (words[0] < 0x2000 || words[0] > 0x3fff) return false;
  if (words[0] === 0x2001 && words[1] <= 0x01ff) return false;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return false;
  if (words[0] === 0x2002) return false;
  if (words[0] === 0x3fff && (words[1] & 0xfff0) === 0) return false;
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
      let body = current.slice(headerEnd + 4);
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
        let payload = new Uint8Array(0);
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

async function db(path: string, init: RequestInit = {}): Promise<any> {
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", "Bearer " + SERVICE_KEY);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(12000),
    redirect: "error"
  });
  const body = await response.text();
  if (!response.ok) {
    console.error("WooCommerce function database operation failed", response.status, path.split("?")[0]);
    throw new Error("IzzyDrop could not load or save the product connection data.");
  }
  if (!body) return null;
  try { return JSON.parse(body); } catch { throw new Error("IzzyDrop returned an invalid database response."); }
}

async function authUser(jwt: string): Promise<{ id: string } | null> {
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + jwt },
    signal: AbortSignal.timeout(12000),
    redirect: "error"
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.id === "string" ? user : null;
}

function normalizeStoreUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 500) throw new Error("Connect a WooCommerce store first.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== "443") || /^[0-9.]+$/.test(url.hostname) ||
      url.hostname.includes(":") || url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local")) {
    throw new Error("The connected WooCommerce store URL is invalid or not public HTTPS.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

async function wooRequest(store: URL, key: string, secret: string, path: string, method = "GET", payload?: unknown): Promise<any> {
  const base = store.origin + store.pathname + API_ROOT;
  const url = base + "/" + path.replace(/^\/+/, "");
  const headers: Record<string, string> = {
    Authorization: "Basic " + btoa(key + ":" + secret),
    Accept: "application/json"
  };
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(20000), redirect: "error" };
  if (payload !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(payload);
  }
  let response: SecureHttpResponse;
  try { response = await secureHttpsRequest(new URL(url), init, 20000); }
  catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("WooCommerce did not respond in time. Try again.");
    throw new Error("Could not reach WooCommerce securely. Check the store URL and hosting firewall.");
  }
  const raw = await response.text();
  let data: any = null;
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { throw new Error("WooCommerce returned an invalid API response."); }
  }
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220) : "";
    if (response.status === 401 || response.status === 403) {
      throw new Error("WooCommerce rejected the API credentials or their permissions.");
    }
    if (response.status === 404) throw new Error("A mapped WooCommerce product no longer exists. Reconnect or remove the stale mapping before retrying.");
    throw new Error("WooCommerce API error (HTTP " + response.status + ")." + (message ? " " + message : ""));
  }
  return data;
}

async function saveParentMapping(row: Record<string, unknown>) {
  await db("woocommerce_product_mappings?on_conflict=store_credential_id,store_url,supplier_product_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  });
}

async function saveVariantMapping(row: Record<string, unknown>) {
  await db("woocommerce_variant_mappings?on_conflict=store_credential_id,store_url,supplier_variant_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  });
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeDescription(value: string): string {
  return value
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
}

function stableSku(prefix: string, id: string): string {
  return prefix + "-" + id.replace(/-/g, "").slice(0, 16).toUpperCase();
}

function variantOptions(variant: Record<string, any>): Record<string, string> {
  const raw = variant.option_values;
  const result: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      const name = key.trim().slice(0, 28);
      const option = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
      if (name && option) result[name] = option.slice(0, 200);
    }
  }
  if (!Object.keys(result).length) {
    const label = safeText(variant.variant_name) || safeText(variant.sku);
    if (label) result.Variant = label.slice(0, 200);
  }
  return result;
}

async function safeImageSource(raw: unknown): Promise<string | null> {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
        url.hostname.endsWith(".local") || url.hostname.endsWith(".localhost") ||
        url.hostname === "localhost" || /^[0-9.]+$/.test(url.hostname) || url.hostname.includes(":")) return null;
    await assertPublicHostname(url.hostname);
    return url.href;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response(JSON.stringify({ error: "Origin not allowed." }), {
      status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  }});
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "WooCommerce publishing is not configured." }, 500);

  const token = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in before publishing products." }, 401);
  const user = await authUser(token);
  if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }
  if (body.action !== "publish" && body.action !== "sync") return json({ error: "Unsupported WooCommerce action." }, 400);
  const productId = typeof body.product_id === "string" ? body.product_id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    return json({ error: "Choose a valid IzzyDrop product." }, 400);
  }

  try {
    const dropshippers = asArray<{ id: string }>(await db("dropshippers?select=id&profile_id=eq." + encodeURIComponent(user.id) + "&limit=1"));
    const dropshipperId = dropshippers[0]?.id;
    if (!dropshipperId) return json({ error: "Only dropshipper accounts can publish products." }, 403);

    const credentialRows = asArray<Record<string, any>>(await db(
      "woocommerce_store_credentials?select=id,dropshipper_id,store_url,consumer_key,consumer_secret,currency&dropshipper_id=eq." +
      encodeURIComponent(dropshipperId) + "&limit=2"
    ));
    if (!credentialRows.length) return json({ error: "Connect WooCommerce first in Store Connections." }, 409);
    if (credentialRows.length > 1) return json({ error: "More than one WooCommerce store is connected. Keep one store connected before publishing." }, 409);
    const credential = credentialRows[0];
    const store = normalizeStoreUrl(credential.store_url);

    const links = asArray<Record<string, any>>(await db(
      "dropshipper_product_links?select=id,dropshipper_id,supplier_product_id,retail_price,pricing_mode,status,sourced_variant_id&dropshipper_id=eq." +
      encodeURIComponent(dropshipperId) + "&supplier_product_id=eq." + encodeURIComponent(productId) + "&limit=1"
    ));
    const link = links[0];
    if (!link || link.status !== "active") return json({ error: "Add this active product to My Products before publishing it." }, 409);

    const products = asArray<Record<string, any>>(await db(
      "supplier_products?select=id,supplier_id,name,name_en,name_ar,description,description_en,description_ar,sku,currency,suggested_retail_price,status,admin_blocked&id=eq." +
      encodeURIComponent(productId) + "&limit=1"
    ));
    const product = products[0];
    if (!product || product.status !== "active" || product.admin_blocked === true) {
      return json({ error: "This product is not currently available for publishing." }, 409);
    }
    const suppliers = asArray<Record<string, any>>(await db(
      "suppliers?select=id,status&id=eq." + encodeURIComponent(String(product.supplier_id || "")) + "&limit=1"
    ));
    if (!suppliers[0] || suppliers[0].status !== "approved") {
      return json({ error: "This supplier is not currently approved to sell on IzzyDrop." }, 409);
    }

    const productCurrency = safeText(product.currency).toUpperCase() || "EGP";
    const storeCurrency = safeText(credential.currency).toUpperCase();
    if (storeCurrency && storeCurrency !== productCurrency) {
      return json({ error: "Currency mismatch: this IzzyDrop product is priced in " + productCurrency +
        " but your WooCommerce store uses " + storeCurrency + ". Change the store currency or use a matching product before publishing." }, 409);
    }

    const rawVariants: Array<Record<string, any>> = asArray<Record<string, any>>(await db(
      "product_variants?select=id,variant_name,sku,stock_quantity,option_values,is_enabled,variant_image_url,suggested_retail_price,barcode,weight_grams,created_at&product_id=eq." +
      encodeURIComponent(productId) + "&is_enabled=eq.true&order=created_at.asc"
    ));
    if (!rawVariants.length) return json({ error: "This product has no enabled variants." }, 409);

    let variants: Array<Record<string, any>> = rawVariants.map((v: Record<string, any>) => ({
      ...v,
      stock_quantity: Math.max(0, Math.floor(Number(v.stock_quantity) || 0))
    }));
    if (link.sourced_variant_id) {
      const chosen = variants.find((v) => String(v.id) === String(link.sourced_variant_id));
      if (chosen) variants = [chosen];
      else return json({ error: "The selected sourced variant is no longer enabled." }, 409);
    }

    const images = asArray<Record<string, any>>(await db(
      "product_images?select=url,position&product_id=eq." + encodeURIComponent(productId) + "&order=position.asc"
    ));
    const imageSources: string[] = [];
    for (const image of images) {
      if (imageSources.length >= 8) break;
      const src = await safeImageSource(image.url);
      if (src && !imageSources.includes(src)) imageSources.push(src);
    }

    const currentProduct = {
      ...product,
      display_name: safeText(product.name_en) || safeText(product.name) || safeText(product.name_ar) || "IzzyDrop product",
      display_description: safeText(product.description_en) || safeText(product.description) || safeText(product.description_ar)
    };
    const customPrice = link.pricing_mode === "custom" && link.retail_price !== null && link.retail_price !== undefined
      ? Number(link.retail_price) : null;
    const pricedVariants: Array<Record<string, any>> = variants.map((variant: Record<string, any>) => {
      const suggested = variant.suggested_retail_price ?? product.suggested_retail_price ?? 0;
      const price = customPrice !== null ? customPrice : Number(suggested);
      const stock = Math.max(0, Math.floor(Number(variant.stock_quantity) || 0));
      if (!Number.isFinite(price) || price < 0) throw new Error("A valid non-negative selling price is required for every enabled variant.");
      return { ...variant, publish_price: Number(price.toFixed(2)), publish_stock: stock };
    });

    const productMapRows = asArray<Record<string, any>>(await db(
      "woocommerce_product_mappings?select=id,woo_product_id,product_type&store_credential_id=eq." +
      encodeURIComponent(credential.id) + "&store_url=eq." + encodeURIComponent(credential.store_url) +
      "&supplier_product_id=eq." + encodeURIComponent(productId) + "&limit=1"
    ));
    const existingProductMap = productMapRows[0] || null;
    // Keep an already-published variable product variable even if a variant is temporarily disabled.
    const isVariable = pricedVariants.length > 1 || existingProductMap?.product_type === "variable";
    const productType = isVariable ? "variable" : "simple";
    if (existingProductMap && existingProductMap.product_type !== productType) {
      return json({ error: "This product's variant structure changed after publishing. For safety, remove the old product in WooCommerce and ask IzzyDrop support to reset its mapping before publishing again." }, 409);
    }

    const variationOptions = new Map<string, Record<string, string>>();
    const attributeNames = new Set<string>();
    if (isVariable) {
      for (const variant of pricedVariants) {
        const options = variantOptions(variant);
        if (!Object.keys(options).length) return json({ error: "Give each enabled variant a unique option name before publishing this variable product." }, 409);
        for (const [name] of Object.entries(options)) attributeNames.add(name);
        variationOptions.set(String(variant.id), options);
      }
      const names = Array.from(attributeNames);
      if (names.length > 3) return json({ error: "WooCommerce publishing currently supports up to three variant option attributes per product." }, 409);
      const seenCombinations = new Set<string>();
      for (const variant of pricedVariants) {
        const options = variationOptions.get(String(variant.id)) || {};
        for (const name of names) {
          if (!options[name]) {
            return json({ error: "Every enabled variant must define the same option attributes before publishing." }, 409);
          }
        }
        const signature = names.map((name) => String(options[name]).trim().toLowerCase()).join("\\u0000");
        if (seenCombinations.has(signature)) {
          return json({ error: "Two enabled variants have the same option combination. Correct the variant options before publishing to WooCommerce." }, 409);
        }
        seenCombinations.add(signature);
      }
    }

    const parentSku = stableSku("IZZY-P", productId);
    const parentPayload: Record<string, any> = {
      name: currentProduct.display_name,
      type: productType,
      status: "publish",
      sku: parentSku,
      description: safeDescription(currentProduct.display_description),
      catalog_visibility: "visible",
      meta_data: [
        { key: "_izzydrop_supplier_product_id", value: productId },
        { key: "_izzydrop_dropshipper_id", value: dropshipperId },
        { key: "_izzydrop_source", value: "IzzyDrop" },
        { key: "_izzydrop_supplier_sku", value: safeText(product.sku) }
      ]
    };
    if (imageSources.length) {
      parentPayload.images = imageSources.map((src) => ({ src }));
    }
    if (isVariable) {
      const names = Array.from(attributeNames);
      parentPayload.attributes = names.map((name) => ({
        name, visible: true, variation: true,
        options: Array.from(new Set(pricedVariants.map((v) => variationOptions.get(String(v.id))?.[name]).filter(Boolean)))
      }));
      parentPayload.manage_stock = false;
      parentPayload.stock_status = pricedVariants.some((v) => v.publish_stock > 0) ? "instock" : "outofstock";
    } else {
      const only = pricedVariants[0];
      parentPayload.regular_price = only.publish_price.toFixed(2);
      parentPayload.manage_stock = true;
      parentPayload.stock_quantity = only.publish_stock;
      parentPayload.stock_status = only.publish_stock > 0 ? "instock" : "outofstock";
      const weight = Number(only.weight_grams);
      if (Number.isFinite(weight) && weight > 0) parentPayload.weight = (weight / 1000).toString();
    }

    let wooProductId = existingProductMap ? Number(existingProductMap.woo_product_id) : NaN;
    let parentCreated = false;
    if (Number.isFinite(wooProductId) && wooProductId > 0) {
      await wooRequest(store, credential.consumer_key, credential.consumer_secret, "products/" + wooProductId, "PUT", parentPayload);
    } else {
      const recovered = asArray<Record<string, any>>(await wooRequest(store, credential.consumer_key, credential.consumer_secret,
        "products?sku=" + encodeURIComponent(parentSku) + "&per_page=1"));
      if (recovered[0]?.id) {
        wooProductId = Number(recovered[0].id);
        await wooRequest(store, credential.consumer_key, credential.consumer_secret, "products/" + wooProductId, "PUT", parentPayload);
      } else {
        const created = await wooRequest(store, credential.consumer_key, credential.consumer_secret, "products", "POST", parentPayload);
        wooProductId = Number(created?.id);
        parentCreated = true;
        if (!Number.isFinite(wooProductId) || wooProductId <= 0) throw new Error("WooCommerce did not return a product ID after publishing.");
      }
    }

    await saveParentMapping({
      store_credential_id: credential.id,
      store_url: credential.store_url,
      dropshipper_id: dropshipperId,
      supplier_product_id: productId,
      woo_product_id: wooProductId,
      product_type: productType,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const mappedVariants = asArray<Record<string, any>>(await db(
      "woocommerce_variant_mappings?select=id,supplier_variant_id,woo_product_id,woo_item_id,is_variation&store_credential_id=eq." +
      encodeURIComponent(credential.id) + "&store_url=eq." + encodeURIComponent(credential.store_url) +
      "&supplier_product_id=eq." + encodeURIComponent(productId)
    ));
    const mappingByVariant = new Map(mappedVariants.map((m) => [String(m.supplier_variant_id), m]));
    let createdOrUpdated = 0;

    for (const variant of pricedVariants) {
      const variantId = String(variant.id);
      const mapped = mappingByVariant.get(variantId);
      const sku = isVariable ? stableSku("IZZY-V", variantId) : parentSku;
      const stock = variant.publish_stock;
      const price = variant.publish_price;
      const options = variationOptions.get(variantId) || {};
      const weight = Number(variant.weight_grams);
      const weightField = Number.isFinite(weight) && weight > 0 ? { weight: (weight / 1000).toString() } : {};
      const meta = [
        { key: "_izzydrop_supplier_variant_id", value: variantId },
        { key: "_izzydrop_supplier_sku", value: safeText(variant.sku) },
        { key: "_izzydrop_barcode", value: safeText(variant.barcode) }
      ];
      const variantPayload: Record<string, any> = {
        regular_price: price.toFixed(2),
        sku,
        manage_stock: true,
        stock_quantity: stock,
        stock_status: stock > 0 ? "instock" : "outofstock",
        ...weightField,
        meta_data: meta
      };
      const variantImage = isVariable ? await safeImageSource(variant.variant_image_url) : null;
      if (variantImage) variantPayload.image = { src: variantImage };
      let wooItemId: number;
      if (!isVariable) {
        wooItemId = wooProductId;
      } else {
        variantPayload.attributes = Object.entries(options).map(([name, option]) => ({ name, option }));
        if (mapped && mapped.is_variation) {
          wooItemId = Number(mapped.woo_item_id);
          await wooRequest(store, credential.consumer_key, credential.consumer_secret,
            "products/" + wooProductId + "/variations/" + wooItemId, "PUT", variantPayload);
        } else {
          const recovered = asArray<Record<string, any>>(await wooRequest(store, credential.consumer_key, credential.consumer_secret,
            "products/" + wooProductId + "/variations?sku=" + encodeURIComponent(sku) + "&per_page=1"));
          if (recovered[0]?.id) {
            wooItemId = Number(recovered[0].id);
            await wooRequest(store, credential.consumer_key, credential.consumer_secret,
              "products/" + wooProductId + "/variations/" + wooItemId, "PUT", variantPayload);
          } else {
            const created = await wooRequest(store, credential.consumer_key, credential.consumer_secret,
              "products/" + wooProductId + "/variations", "POST", {
                ...variantPayload,
                ...(variantImage ? { image: { src: variantImage } } : {})
              });
            wooItemId = Number(created?.id);
            if (!Number.isFinite(wooItemId) || wooItemId <= 0) throw new Error("WooCommerce did not return a variation ID.");
          }
        }
      }
      await saveVariantMapping({
        store_credential_id: credential.id,
        store_url: credential.store_url,
        dropshipper_id: dropshipperId,
        supplier_product_id: productId,
        supplier_variant_id: variantId,
        woo_product_id: wooProductId,
        woo_item_id: wooItemId,
        is_variation: isVariable,
        sku,
        last_synced_price: price,
        last_synced_stock: stock,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      createdOrUpdated++;
    }

    if (isVariable) {
      const activeIds = new Set(pricedVariants.map((v) => String(v.id)));
      for (const oldMapping of mappedVariants) {
        const oldId = String(oldMapping.supplier_variant_id);
        if (activeIds.has(oldId) || !oldMapping.is_variation) continue;
        const oldItemId = Number(oldMapping.woo_item_id);
        if (!Number.isFinite(oldItemId) || oldItemId <= 0) continue;
        await wooRequest(store, credential.consumer_key, credential.consumer_secret,
          "products/" + wooProductId + "/variations/" + oldItemId, "PUT", {
            manage_stock: true, stock_quantity: 0, stock_status: "outofstock"
          });
        await db("woocommerce_variant_mappings?supplier_variant_id=eq." + encodeURIComponent(oldId) +
          "&store_credential_id=eq." + encodeURIComponent(credential.id) +
          "&store_url=eq." + encodeURIComponent(credential.store_url), {
          method: "PATCH",
          body: JSON.stringify({ last_synced_stock: 0, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        });
      }
    }

    return json({
      ok: true,
      product_id: productId,
      woo_product_id: wooProductId,
      product_type: productType,
      operation: parentCreated ? "created" : "updated",
      variants_synced: createdOrUpdated,
      message: (parentCreated ? "Published to" : "Updated in") +
        " WooCommerce and synced current variant prices and sellable stock. " +
        createdOrUpdated + " variant" + (createdOrUpdated === 1 ? "" : "s") + " synced."
    });
  } catch (error) {
    console.error("WooCommerce publish/sync failed", error instanceof Error ? error.name : "unknown");
    return json({ error: error instanceof Error ? error.message : "WooCommerce publishing failed. Please retry." }, 400);
  }
});
