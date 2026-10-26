const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const migration = read('supabase/migrations/20261026_native_dropshipper_storefronts.sql');

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
  assert.match(publicFunction, /p\.status = 'active'/i);
  assert.match(publicFunction, /p\.admin_blocked = false/i);
  assert.match(publicFunction, /s\.status = 'approved'/i);
  assert.match(publicFunction, /ds\.published = true/i);
});

test('store manager supports profile, photos, descriptions, and per-variant prices', () => {
  const html = read('store-manager.html');
  const js = read('store-manager.js');
  for (const id of ['store-profile-form', 'store-name', 'store-slug', 'store-published', 'store-catalog-results', 'store-listings', 'store-edit-modal', 'edit-upload-photos']) {
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
  assert.match(read('app.html'), /store-manager\.html/);
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
  assert.match(js, /image\/\(jpeg\|png\|webp\|avif\)/);
  assert.match(js, /storage\/v1\/object\/storefront-images/);
});
