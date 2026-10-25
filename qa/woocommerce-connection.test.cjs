const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync(require('node:path').join(__dirname, '../app.html'), 'utf8');
const js = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const fn = fs.readFileSync(require('node:path').join(__dirname, '../supabase/functions/woocommerce-connect/index.ts'), 'utf8');
const migration = fs.readFileSync(require('node:path').join(__dirname, '../supabase/migrations/20261025_woocommerce_store_credentials.sql'), 'utf8');

assert.match(html, /id="woocommerce-credentials" hidden/);
assert.match(html, /id="woocommerce-key"/);
assert.match(html, /id="woocommerce-secret"/);
assert.match(js, /const storeConnectionForm=\$\('#store-connection-form'\);/);
assert.ok(js.indexOf("const storeConnectionForm=$('#store-connection-form');") < js.indexOf('updatePlatformFields();'), 'storeConnectionForm must be initialized before updatePlatformFields runs');
assert.match(js, /\/functions\/v1\/woocommerce-connect/);
assert.match(js, /wooKey\.value='';wooSecret\.value='';/);
assert.match(fn, /if \(origin && origin !== ALLOWED_ORIGIN\)/);
assert.match(fn, /redirect: "error"/);
assert.match(fn, /Authorization: "Bearer " \+ jwt/);
assert.match(fn, /consumer_secret: secret/);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on public\.woocommerce_store_credentials from anon, authenticated/i);
console.log('PASS: WooCommerce form, initialization order, authenticated endpoint wiring, origin/redirect safeguards, and server-only credential table checks.');
