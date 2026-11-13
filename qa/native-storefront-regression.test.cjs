const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const migration = read('supabase/migrations/20261026_native_dropshipper_storefronts.sql');
const hardeningMigration = read('supabase/migrations/20261026144000_harden_native_storefront_privileges.sql');

test('native storefront tables are RLS-protected and owner-managed', () => {
  for (const table of ['dropshipper_stores', 'dropshipper_store_products', 'dropshipper_store_product_variants']) {
    assert.match(migration, new RegExp('alter table public\\.' + table + ' enable row level security', 'i'));
    assert.match(migration, new RegExp('revoke all on public\\.' + table + ' from anon', 'i'));
  }
  assert.match(migration, /store owner manages own storefront/i);
  assert.match(migration, /store owner manages own store products/i);
  assert.match(migration, /store owner manages own store product variants/i);
  assert.match(migration, /grant execute on function public\.public_dropshipper_store_by_slug\(text\) to anon, authenticated/i);
});

test('public storefront RPC exposes presentation data, not supplier identity or supplier costs', () => {
  const start = migration.indexOf('create or replace function public.public_dropshipper_store_by_slug');
  assert.notEqual(start, -1);
  const publicFunction = migration.slice(start);
  assert.doesNotMatch(publicFunction, /'supplier_name'\s*,/i);
  assert.doesNotMatch(publicFunction, /'supplier_id'\s*,/i);
  assert.doesNotMatch(publicFunction, /'supplier_cost'\s*,/i);
  assert.doesNotMatch(publicFunction, /'cost_price'\s*,/i);
  assert.doesNotMatch(publicFunction, /v\.sku/i, 'Public variant labels must not fall back to supplier SKUs');
  assert.match(publicFunction, /p\.status = 'active'/i);
  assert.match(publicFunction, /p\.admin_blocked = false/i);
  assert.match(publicFunction, /s\.status = 'approved'/i);
  assert.match(publicFunction, /ds\.published = true/i);
  assert.match(publicFunction, /selected_variant\.enabled = true/i);
  assert.match(publicFunction, /dsp\.content_reviewed_at is not null/i);
  assert.match(publicFunction, /'description', coalesce\(dsp\.description_override, ''\)/i);
  assert.match(publicFunction, /'in_stock', \(v\.stock_quantity > 0\)/i);
  assert.doesNotMatch(publicFunction, /'stock_quantity',/i);
});

test('store manager supports profile, photos, descriptions, and per-variant prices', () => {
  const html = read('store-manager.html');
  const js = read('store-manager.js');
  for (const id of ['store-profile-form', 'store-name', 'store-slug', 'store-published', 'store-catalog-results', 'store-listings', 'store-edit-modal', 'edit-upload-photos', 'store-content-review']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  for (const table of ['dropshipper_stores', 'dropshipper_store_products', 'dropshipper_store_product_variants']) assert.ok(js.includes(table));
  for (const feature of ['title_override', 'description_override', 'selected_image_urls', 'custom_image_urls', 'retail_price', 'enabled']) assert.ok(js.includes(feature));
});

test('public customer page never requests or renders supplier identity or supplier cost fields', () => {
  const html = read('storefront.html');
  const js = read('storefront.js');
  const css = read('storefront.css');
  assert.ok(html.includes('storefront.js'));
  assert.ok(css.includes('.storefront-product-card'));
  for (const privateField of ['supplier_name', 'supplier_id', 'supplier_cost', 'cost_price']) {
    assert.doesNotMatch(js, new RegExp(privateField, 'i'));
  }
  assert.match(js, /public_dropshipper_store_by_slug/);
  assert.match(js, /Online ordering is coming soon/);
});

test('native storefront navigation preserves existing external integrations', () => {
  assert.match(read('config.js'), /store-manager-nav\.js/);
  const app = read('app.js');
  assert.match(app, /function openWebSetup/);
  assert.match(app, /woocommerce-publish-linked/);
  assert.match(app, /storefront_integrations/);
  assert.match(read('store-manager.js'), /My Products/);
});

test('uploads are scoped to the signed-in user and validate image type and size', () => {
  assert.match(migration, /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/i);
  const js = read('store-manager.js');
  assert.match(js, /f\.size>5242880/);
  assert.match(js, /jpeg\|png\|webp\|avif/);
  assert.match(js, /storage\/v1\/object\/storefront-images/);
});

test('storefront hardening removes non-CRUD authenticated table privileges', () => {
  assert.match(hardeningMigration, /revoke all privileges on table[\s\S]*from public, anon, authenticated/i);
  assert.match(hardeningMigration, /grant select, insert, update, delete on table[\s\S]*to authenticated/i);
  assert.match(hardeningMigration, /idx_dropshipper_store_products_product_link_id/);
  assert.match(hardeningMigration, /idx_dropshipper_store_product_variants_variant_id/);
  assert.doesNotMatch(hardeningMigration, /grant all privileges[^;]*to authenticated/i);
});

test('per-store design settings have owner-only writes and published-store public reads', () => {
  const migration = read('supabase/migrations/20261108181000_create_dropshipper_store_designs.sql');
  assert.match(migration, /create table if not exists public\.dropshipper_store_designs/i);
  assert.match(migration, /alter table public\.dropshipper_store_designs enable row level security/i);
  assert.match(migration, /dropshippers manage their own store design/i);
  assert.match(migration, /public can read published store design/i);
  assert.match(migration, /grant select on public\.dropshipper_store_designs to anon/i);
});

test('a dropshipper can own multiple isolated stores with reversible shutdown', () => {
  const migration = read('supabase/migrations/20261108182000_enable_multiple_dropshipper_stores.sql');
  assert.match(migration, /drop constraint if exists dropshipper_stores_dropshipper_id_key/i);
  assert.match(migration, /add column if not exists closed_at timestamptz/i);
  assert.match(migration, /closed_at is null or published is false/i);
  assert.match(migration, /ds\.closed_at is null/i);
  const manager = read('store-manager.js');
  const design = read('store-design.js');
  assert.ok(manager.includes("encodeURIComponent(storeId || '')"));
  assert.ok(design.includes("encodeURIComponent(storeId)"));
  assert.ok(read('my-stores.html').includes('my-stores.js'));
  assert.ok(read('store-create.html').includes('store-create.js'));
  assert.ok(read('store-dashboard.html').includes('store-dashboard.js'));
  assert.match(read('app.html'), /id="dropshipper-my-stores-link" href="my-stores.html"/);
  assert.match(read('app.html'), /sidebar-single-store\.js\?v=20261113-single-store-nav1/);
  const sidebar = read('sidebar-single-store.js');
  const dashboardCss = read('styles.css');
  assert.match(dashboardCss, /\.dropshipper-side nav a\.dropshipper-mobile-nav-item\s*\{/);
  assert.match(dashboardCss, /\.dropshipper-side nav a\.dropshipper-mobile-nav-item svg\s*\{/);
  assert.doesNotMatch(dashboardCss, /a#dropshipper-my-store-link/);
  assert.match(read('app.html'), /styles\.css\?v=20261113-my-stores-link-style1/);
  assert.doesNotThrow(() => new Function(sidebar), 'sidebar normalizer must remain valid JavaScript');
  assert.match(sidebar, /new MutationObserver\(normalizeStoreNavigation\)/);
  assert.match(sidebar, /item !== canonical && item\.isConnected/);
  assert.match(read('app.js'), /myStore\.href=ar\(\)\?'my-stores\.html\?lang=ar':'my-stores\.html'/);
  assert.match(read('store-dashboard.js'), /closed_at:new Date\(\)\.toISOString\(\)/);
  assert.match(read('store-dashboard.js'), /closed_at:null/);
});

test('public storefront branding and banner layout stay cohesive on mobile', () => {
  const storefront = read('storefront.js');
  const css = read('storefront.css');
  const html = read('storefront.html');
  assert.match(storefront, /storefront-brand-lockup/);
  assert.match(storefront, /storefront-brand-name/);
  assert.match(storefront, /storefront-store-hero-title/);
  assert.match(css, /\.storefront-brand-lockup\s*\{/);
  assert.match(css, /\.storefront-brand-name\s*\{/);
  assert.match(css, /\.storefront-store-hero-title\s*\{/);
  assert.match(css, /background-position:50% 42%/);
  assert.match(css, /background-position:50% 40%/);
  assert.match(css, /\.store-template-editorial \.storefront-brand-lockup\{flex-direction:column/);
  assert.match(html, /storefront\.css\?v=20261113-language1/);
  assert.match(html, /storefront\.js\?v=20261113-language1/);
});


test('public storefront stays seller-branded without platform promotion', () => {
  const html = read('storefront.html');
  const js = read('storefront.js');
  const css = read('storefront.css');
  assert.doesNotMatch(html, /Explore marketplace|storefront-market-link/);
  assert.doesNotMatch(html, /IzzyDrop|favicon\.svg|Independent seller storefront|INDEPENDENT STORE/);
  assert.doesNotMatch(html, /public-store-footer/);
  assert.match(css, /\.public-store-header--independent\{justify-content:flex-end\}/);
  assert.match(js, /document\.title=storeName;/);
  assert.match(js, /descriptionMeta\.content=/);
  assert.match(js, /storeFavicon\.href=logo/);
  assert.match(js, /themeMeta\.content=palette\.background_color/);
  assert.doesNotMatch(css, /public-store-footer/);
  assert.doesNotMatch(js, /IzzyDrop|INDEPENDENT STORE|independent seller|Explore IzzyDrop/);
  assert.doesNotMatch(js, /Explore this store’s collection|Shop the collection/);
  assert.match(html, /storefront\.css\?v=20261113-language1/);
  assert.match(html, /storefront\.js\?v=20261113-language1/);
});

test('public storefront has a working visitor language switch and natural copy', () => {
  const html = read('storefront.html');
  const js = read('storefront.js');
  const css = read('storefront.css');
  assert.match(html, /id="storefront-language"/);
  assert.match(html, /option value="en">English/);
  assert.match(html, /option value="ar">العربية/);
  assert.doesNotMatch(html, /Explore marketplace|storefront-market-link/);
  assert.match(html, /izzy_storefront_language/);
  assert.match(js, /setLanguage\(selector\.value, true\)/);
  assert.match(js, /url\.searchParams\.set\('lang', language\)/);
  assert.match(js, /document\.documentElement\.dir = language === 'ar' \? 'rtl' : 'ltr'/);
  assert.match(js, /Find your next favorite/);
  assert.match(js, /productCountLabel\(products\.length\)/);
  assert.match(js, /منتجات/);
  assert.doesNotMatch(js, /Explore this store’s collection|Shop the collection/);
  assert.match(js, /اكتشف ما يناسبك/);
  assert.match(js, /تصفّح المنتجات واختر ما يعجبك/);
  assert.match(css, /\.storefront-language-switch select/);
  assert.match(css, /html\[dir="rtl"\] \.storefront-product-content/);
  assert.match(html, /storefront\.css\?v=20261113-language1/);
  assert.match(html, /storefront\.js\?v=20261113-language1/);
});
