const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const appHtml = read('app.html');
const appJs = read('app.js');
const manager = read('store-manager.js');
const publicPage = read('store.html');
const publicJs = read('store.js');
const edge = read('supabase/functions/public-storefront/index.ts');
const migration = read('supabase/migrations/20261026170000_dropshipper_hosted_storefront_v1.sql');

assert.match(appHtml, /data-view="store"/, 'The dropshipper navigation exposes My Store');
assert.match(appHtml, /id="view-store"/, 'The dashboard has a separate My Store panel');
assert.match(appHtml, /store-manager\.js/, 'The manager is loaded by the dashboard');
assert.match(appJs, /store:\['My Store'/, 'The existing dashboard navigation recognises My Store');

for (const field of ['custom_title', 'custom_description', 'custom_image_urls']) {
  assert.match(migration, new RegExp(field), 'The linked-product override schema includes ' + field);
  assert.match(manager, new RegExp(field), 'The manager saves ' + field);
}
assert.match(migration, /create table if not exists public\.dropshipper_stores/i);
assert.match(migration, /create table if not exists public\.dropshipper_store_product_variants/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /private\.has_role\(auth\.uid\(\), 'admin'::app_role\)/i);
assert.match(migration, /Variant must belong to the product selected in My Products/);

assert.match(manager, /marketplace_variants_v3/, 'The manager loads the existing active-variant RPC');
assert.match(manager, /dropshipper_linked_catalog/, 'The manager starts from the existing My Products catalog');
assert.match(manager, /protocol!=='https:'/i, 'Custom image URLs are restricted to HTTPS');
assert.match(manager, /product listing and prices remain unchanged|Supplier listing and prices remain unchanged/i);
assert.match(manager, /Save product changes/);
assert.match(manager, /dropshipper_store_product_variants/);

assert.match(edge, /is_published: "eq\.true"/, 'The public endpoint only returns published stores');
assert.match(edge, /status: "eq\.active"/, 'The public endpoint checks an active dropshipper/product');
assert.match(edge, /admin_blocked: "eq\.false"/, 'The public endpoint excludes admin-blocked products');
assert.match(edge, /status: "eq\.approved"/, 'The public endpoint checks supplier approval');
assert.match(edge, /Access-Control-Allow-Methods": "GET, OPTIONS"/);
assert.match(edge, /request\.method !== "GET"/);
assert.match(edge, /custom_image_urls/);
assert.match(edge, /stock_quantity/);

const responseStart = edge.indexOf('publicProducts.push({');
const responseEnd = edge.indexOf('\n      });', responseStart);
assert.ok(responseStart >= 0 && responseEnd > responseStart, 'The public response product shape is present');
const publicProductShape = edge.slice(responseStart, responseEnd);
assert.doesNotMatch(publicProductShape, /supplier_name|supplier_id|supplier_cost|cost_price|sku|shopify|woocommerce/i,
  'Public product payload must not include supplier identities, costs, internal SKU, or store integrations');
assert.doesNotMatch(publicJs, /supplier_name|supplier_id|supplier_cost|cost_price|shopify|woocommerce/i,
  'The public browser bundle must not expose supplier/private integration data');
assert.doesNotMatch(edge, /SERVICE_KEY.*json|json\(.*SERVICE_KEY/i, 'Never serialize the service key into responses');

assert.match(publicPage, /store\.js/);
assert.match(publicPage, /store-public-main/);
assert.match(publicJs, /storefronts are planned for Phase 2|planned for Phase 2/i);
assert.match(publicJs, /store-public-variant-select/);
assert.match(publicJs, /stockEl\.classList\.toggle\('out',stock<=0\)/);
assert.doesNotMatch(publicJs, /storefront-gateway|storefront_create_order|create_dropshipper_order/i,
  'Phase 1 public store is browse-only; checkout/order creation is deferred');

assert.match(manager, /store\.html/);
assert.match(manager, /is_published/);
assert.match(manager, /is_published:published/);
console.log('Hosted storefront v1 source and privacy checks passed.');
