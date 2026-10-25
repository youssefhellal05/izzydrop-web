const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('app.html');
const js = read('app.js');
const connectFn = read('supabase/functions/woocommerce-connect/index.ts');
const productsFn = read('supabase/functions/woocommerce-products/index.ts');
const migration = read('supabase/migrations/20261025_woocommerce_store_credentials.sql');

assert.match(html, /id="woocommerce-credentials" hidden/);
assert.match(html, /id="woocommerce-key"/);
assert.match(html, /id="woocommerce-secret"/);
assert.match(html, /id="disconnect-woocommerce"/);
assert.match(html, /app\.js\?v=20261025-woocommercepublish1/);
assert.match(js, /const storeConnectionForm=\$\('#store-connection-form'\);/);
assert.ok(js.indexOf("const storeConnectionForm=$('#store-connection-form');") < js.indexOf('updatePlatformFields();'),
  'storeConnectionForm must be initialized before updatePlatformFields runs');
assert.match(js, /\/functions\/v1\/woocommerce-connect/);
assert.match(js, /action:'status'/);
assert.match(js, /action:'disconnect'/);
assert.match(js, /wooIsConnected/);
assert.match(js, /\/functions\/v1\/woocommerce-products/);
assert.match(js, /class="[^"]*woocommerce-publish-linked/);
assert.match(js, /publishWooCommerceProduct\(b\)/);
assert.match(js, /wooKey\.value='';wooSecret\.value='';/);

assert.match(connectFn, /if \(origin && origin !== ALLOWED_ORIGIN\)/);
assert.match(connectFn, /redirect: "error"/);
assert.match(connectFn, /Authorization: "Bearer " \+ jwt/);
assert.match(connectFn, /consumer_secret: secret/);
assert.match(connectFn, /on_conflict=dropshipper_id/);
assert.match(connectFn, /currencyValue/);
assert.match(connectFn, /body.action === "status"/);
assert.match(connectFn, /body.action === "disconnect"/);

assert.match(productsFn, /if \(origin && origin !== ALLOWED_ORIGIN\)/);
assert.match(productsFn, /Authorization: "Basic " \+ btoa\(key \+ ":" \+ secret\)/);
assert.match(productsFn, /headers\.set\("Authorization", "Bearer " \+ SERVICE_KEY\)/);
assert.match(productsFn, /redirect: "error"/);
assert.match(productsFn, /assertPublicHostname\(store\.hostname\)/);
assert.match(productsFn, /dropshipper_product_links/);
assert.match(productsFn, /product_variants\?select=id,variant_name/);
assert.match(productsFn, /woocommerce_product_mappings/);
assert.match(productsFn, /woocommerce_variant_mappings/);
assert.match(productsFn, /stock_quantity: stock/);
assert.match(productsFn, /regular_price: price\.toFixed\(2\)/);
assert.match(productsFn, /productCurrency/);
assert.match(productsFn, /seenCombinations/);
assert.match(productsFn, /Two enabled variants have the same option combination/);
assert.match(productsFn, /suppliers\?select=id,status/);
assert.match(productsFn, /status !== "approved"/);
assert.match(productsFn, /only dropshipper accounts can publish products/i);

assert.match(migration, /enable row level security/ig);
assert.match(migration, /revoke all on public\.woocommerce_store_credentials from anon, authenticated/i);
assert.match(migration, /revoke all on public\.woocommerce_product_mappings from anon, authenticated/i);
assert.match(migration, /revoke all on public\.woocommerce_variant_mappings from anon, authenticated/i);
assert.ok(migration.includes('dropshipper_id uuid not null references public.dropshippers(id) on delete cascade unique'), 'WooCommerce credentials must allow a single store per dropshipper');
assert.match(migration, /unique \(store_credential_id, store_url, supplier_product_id\)/i);
assert.match(migration, /unique \(store_credential_id, store_url, supplier_variant_id\)/i);

console.log('PASS: WooCommerce connection, server-only credentials/mappings, product publishing, stock/price sync, origin/auth/redirect safeguards, supplier eligibility, and My Products UI wiring.');
