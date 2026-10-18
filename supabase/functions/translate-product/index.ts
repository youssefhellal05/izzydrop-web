import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!auth.startsWith("Bearer ") || !supabaseUrl || !anonKey) return json({ error: "Authentication required" }, 401);

    const userRes = await fetch(supabaseUrl + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: auth }
    });
    const user = await userRes.json();
    if (!userRes.ok || !user?.id) return json({ error: "Authentication required" }, 401);

    const commonHeaders = { apikey: anonKey, Authorization: auth };
    const [supplierRes, roleRes] = await Promise.all([
      fetch(supabaseUrl + "/rest/v1/suppliers?select=id&profile_id=eq." + encodeURIComponent(user.id) + "&limit=1", { headers: commonHeaders }),
      fetch(supabaseUrl + "/rest/v1/user_roles?select=role&user_id=eq." + encodeURIComponent(user.id), { headers: commonHeaders })
    ]);
    const suppliers = supplierRes.ok ? await supplierRes.json() : [];
    const roles = roleRes.ok ? await roleRes.json() : [];
    const allowed = Array.isArray(suppliers) && suppliers.length > 0 ||
      Array.isArray(roles) && roles.some((r: { role?: string }) => r.role === "admin");
    if (!allowed) return json({ error: "Supplier or admin access required" }, 403);

    const body = await req.json();
    const text = String(body?.text ?? "").trim();
    const from = body?.from === "ar" ? "ar" : body?.from === "en" ? "en" : null;
    const to = body?.to === "ar" ? "ar" : body?.to === "en" ? "en" : null;

    if (!text) throw new Error("Text is required");
    if (!from || !to || from === to) throw new Error("Use en or ar and choose a different target language");
    if (text.length > 3000) throw new Error("Translate up to 3000 characters at a time");

    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", `${from}|${to}`);

    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    const data = await res.json();
    const translated = String(data?.responseData?.translatedText ?? "").trim();
    const serviceStatus = Number(data?.responseStatus ?? res.status);

    if (!res.ok || serviceStatus >= 400 || !translated || /^MYMEMORY WARNING/i.test(translated)) {
      throw new Error(data?.responseDetails || "Translation service is unavailable right now");
    }

    return json({ translated_text: translated, from, to });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Translation failed" }, 400);
  }
});