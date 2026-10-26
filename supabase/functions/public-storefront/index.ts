import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function inFilter(values: string[]) {
  return "in.(" + values.join(",") + ")";
}

async function selectRows(table: string, filters: Record<string, string>) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Storefront service is not configured");
  const params = new URLSearchParams(filters);
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + params.toString(), {
    method: "GET",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    // Keep database error details out of the public response.
    console.error("public-storefront select failed", table, response.status);
    throw new Error("Storefront data unavailable");
  }
  const data: unknown = await response.json();
  return Array.isArray(data) ? data as Record<string, unknown>[] : [];
}

function safeImageUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048) return null;
    return url.href;
  } catch {
    return null;
  }
}

function uniqueImages(values: unknown[]) {
  return [...new Set(values.map(safeImageUrl).filter((value): value is string => Boolean(value)))].slice(0, 12);
}

function stringValue(value: unknown, maxLength = 3000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function variantOptions(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 8)) {
    const name = stringValue(key, 60);
    const option = stringValue(raw, 100);
    if (name && option) output[name] = option;
  }
  return output;
}

function variantDisplayLabel(options: Record<string, string>, rawName: unknown) {
  const items = Object.entries(options);
  if (items.length) return items.map(([key, value]) => key + ": " + value).join(" · ").slice(0, 240);
  return stringValue(rawName, 240) || "Standard";
}

function effectivePrice(
  variant: Record<string, unknown>,
  product: Record<string, unknown>,
  link: Record<string, unknown>,
  setting?: Record<string, unknown>
) {
  if (setting?.retail_price != null && Number.isFinite(Number(setting.retail_price))) return Number(setting.retail_price);
  if (link.pricing_mode === "custom" && link.retail_price != null && Number.isFinite(Number(link.retail_price))) {
    return Number(link.retail_price);
  }
  const suggested = variant.suggested_retail_price ?? product.suggested_retail_price;
  const price = Number(suggested ?? 0);
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Storefront service is not configured" }, 500);

  const requestUrl = new URL(request.url);
  const slug = stringValue(requestUrl.searchParams.get("slug"), 48).toLowerCase();
  if (slug.length < 3 || slug.length > 48 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return json({ error: "Invalid store link" }, 400);
  }

  try {
    const stores = await selectRows("dropshipper_stores", {
      select: "dropshipper_id,store_name,slug,description,is_published",
      slug: "eq." + slug,
      is_published: "eq.true",
      limit: "1"
    });
    const store = stores[0];
    if (!store || store.is_published !== true) {
      return json({ error: "This store is not available or has not been published" }, 404);
    }

    const dropshipperId = String(store.dropshipper_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(dropshipperId)) return json({ error: "This store is not available" }, 404);
    const activeDropshippers = await selectRows("dropshippers", {
      select: "id",
      id: "eq." + dropshipperId,
      status: "eq.active",
      limit: "1"
    });
    if (!activeDropshippers.length) return json({ error: "This store is not available" }, 404);

    const links = await selectRows("dropshipper_product_links", {
      select: "id,supplier_product_id,retail_price,pricing_mode,custom_title,custom_description,custom_image_urls",
      dropshipper_id: "eq." + dropshipperId,
      status: "eq.active",
      order: "created_at.desc"
    });

    const linkRows = links.filter(link =>
      /^[0-9a-f-]{36}$/i.test(String(link.id || "")) &&
      /^[0-9a-f-]{36}$/i.test(String(link.supplier_product_id || ""))
    );
    const productIds = [...new Set(linkRows.map(link => String(link.supplier_product_id)))];
    let products: Record<string, unknown>[] = [];
    let suppliers: Record<string, unknown>[] = [];
    let variants: Record<string, unknown>[] = [];
    let images: Record<string, unknown>[] = [];
    let settings: Record<string, unknown>[] = [];

    if (productIds.length) {
      products = await selectRows("supplier_products", {
        select: "id,supplier_id,name,name_en,name_ar,description,description_en,description_ar,currency,suggested_retail_price,status,admin_blocked",
        id: inFilter(productIds),
        status: "eq.active",
        admin_blocked: "eq.false"
      });
      const supplierIds = [...new Set(products.map(product => String(product.supplier_id || "")).filter(id => /^[0-9a-f-]{36}$/i.test(id)))];
      if (supplierIds.length) {
        suppliers = await selectRows("suppliers", {
          select: "id,status",
          id: inFilter(supplierIds),
          status: "eq.approved"
        });
      }
      const approvedSuppliers = new Set(suppliers.map(supplier => String(supplier.id)));
      products = products.filter(product => approvedSuppliers.has(String(product.supplier_id)));
    }

    const availableProductIds = products.map(product => String(product.id)).filter(id => /^[0-9a-f-]{36}$/i.test(id));
    const linkIds = linkRows.map(link => String(link.id));
    if (availableProductIds.length) {
      [variants, images] = await Promise.all([
        selectRows("product_variants", {
          select: "id,product_id,variant_name,option_values,stock_quantity,is_enabled,variant_image_url,suggested_retail_price",
          product_id: inFilter(availableProductIds),
          is_enabled: "eq.true",
          order: "created_at.asc"
        }),
        selectRows("product_images", {
          select: "product_id,url,position",
          product_id: inFilter(availableProductIds),
          order: "position.asc"
        })
      ]);
    }
    if (linkIds.length && availableProductIds.length) {
      settings = await selectRows("dropshipper_store_product_variants", {
        select: "link_id,variant_id,enabled,retail_price",
        link_id: inFilter(linkIds)
      });
    }

    const productById = new Map(products.map(product => [String(product.id), product]));
    const imageMap = new Map<string, string[]>();
    for (const row of images) {
      const productId = String(row.product_id || "");
      if (!imageMap.has(productId)) imageMap.set(productId, []);
      imageMap.get(productId)!.push(String(row.url || ""));
    }
    const variantsByProduct = new Map<string, Record<string, unknown>[]>();
    for (const variant of variants) {
      const productId = String(variant.product_id || "");
      if (!variantsByProduct.has(productId)) variantsByProduct.set(productId, []);
      variantsByProduct.get(productId)!.push(variant);
    }

    const publicProducts: Record<string, unknown>[] = [];
    for (const link of linkRows) {
      const product = productById.get(String(link.supplier_product_id));
      if (!product) continue;
      const allVariants = variantsByProduct.get(String(product.id)) || [];
      const linkSettings = settings.filter(setting => String(setting.link_id) === String(link.id));
      const hasExplicitSettings = linkSettings.length > 0;
      const settingByVariant = new Map(linkSettings.map(setting => [String(setting.variant_id), setting]));
      const chosenVariants = allVariants.filter(variant => {
        const setting = settingByVariant.get(String(variant.id));
        return hasExplicitSettings ? Boolean(setting && setting.enabled === true) : true;
      });
      const sourceImages = uniqueImages([
        ...(imageMap.get(String(product.id)) || []),
        ...allVariants.map(variant => variant.variant_image_url)
      ]);
      const selectedCustomImages = Array.isArray(link.custom_image_urls) ? link.custom_image_urls as unknown[] : null;
      const imagesForStore = uniqueImages(selectedCustomImages && selectedCustomImages.length ? selectedCustomImages : sourceImages);
      const variantsForStore = chosenVariants.map(variant => {
        const options = variantOptions(variant.option_values);
        const imageCandidate = safeImageUrl(variant.variant_image_url);
        const imageUrl = imageCandidate && imagesForStore.includes(imageCandidate) ? imageCandidate : (imagesForStore[0] || null);
        const stock = Math.max(0, Number(variant.stock_quantity || 0));
        const price = effectivePrice(variant, product, link, settingByVariant.get(String(variant.id)));
        return {
          label: variantDisplayLabel(options, variant.variant_name),
          options,
          stock_quantity: Number.isFinite(stock) ? stock : 0,
          retail_price: price,
          image_url: imageUrl
        };
      });
      const numericPrices = variantsForStore.map(variant => Number(variant.retail_price)).filter(price => Number.isFinite(price));
      publicProducts.push({
        title: stringValue(link.custom_title, 160) ||
          stringValue(product.name_en, 160) ||
          stringValue(product.name, 160) ||
          stringValue(product.name_ar, 160) ||
          "Product",
        description: link.custom_description != null
          ? stringValue(link.custom_description, 3000)
          : (stringValue(product.description_en, 3000) || stringValue(product.description, 3000) || stringValue(product.description_ar, 3000)),
        currency: /^[A-Z]{3}$/.test(String(product.currency || "")) ? String(product.currency) : "EGP",
        images: imagesForStore,
        variants: variantsForStore,
        price_min: numericPrices.length ? Math.min(...numericPrices) : 0,
        price_max: numericPrices.length ? Math.max(...numericPrices) : 0
      });
    }

    return json({
      store_name: stringValue(store.store_name, 80) || "IzzyDrop Store",
      slug: String(store.slug),
      description: stringValue(store.description, 500),
      products: publicProducts
    }, 200);
  } catch (error) {
    console.error("public-storefront request failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "This store is temporarily unavailable. Please try again later." }, 500);
  }
});