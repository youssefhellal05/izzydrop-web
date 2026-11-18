const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const verificationSql = read('supabase/migrations/20261118120000_pre_release_verification_admin.sql');
const checkoutSql = read('supabase/migrations/20261118130000_native_storefront_checkout.sql');
const adminSql = read('supabase/migrations/20261118140000_admin_order_inventory_controls.sql');
const gateway = read('supabase/functions/native-storefront-gateway/index.ts');

test('signup collects a phone number and sends it to Supabase signup metadata', () => {
  const html = read('login.html');
  const js = read('login.js');
  assert.match(html, /id="signup-phone"[^>]*required/);
  assert.match(js, /phone:\$\('#signup-phone'\)\.value\.trim\(\)/);
  assert.match(js, /phone:String\(phone\)\.trim\(\)/);
});

test('supplier verification is flexible but requires identity and registered-business evidence', () => {
  assert.match(verificationSql, /supplier_submit_verification_v2/);
  assert.match(verificationSql, /_identity_document_path/);
  assert.match(verificationSql, /_legal_name/);
  assert.match(verificationSql, /_business_address/);
  assert.match(verificationSql, /_business_phone/);
  assert.match(verificationSql, /_registration_status='registered'/);
  assert.match(verificationSql, /_registration_document_path/);
  assert.match(verificationSql, /_tax_registration_number/);
  assert.match(verificationSql, /admin approval note explaining the registration exception/);
});

test('dropshipper identity approval requires residential data, phone and payout destination', () => {
  assert.match(verificationSql, /dropshipper_submit_identity_verification_v2/);
  assert.match(verificationSql, /_residential_address/);
  assert.match(verificationSql, /_residential_maps_url/);
  assert.match(verificationSql, /A contact phone number is required/);
  assert.match(verificationSql, /Complete the dropshipper payout details before approving identity/);
});

test('unverified dropshippers cannot create product links or publish native stores', () => {
  for (const token of [
    'trg_require_dropshipper_identity_for_product_link',
    'trg_require_dropshipper_identity_for_store_publish',
    'trg_require_dropshipper_identity_for_store_product',
    'trg_require_dropshipper_identity_for_store_variant'
  ]) assert.ok(verificationSql.includes(token), 'missing DB enforcement: '+token);
  const manager = read('store-manager.js');
  assert.match(manager, /Complete identity verification before linking marketplace products/);
  assert.match(manager, /Complete identity verification before making a listing public/);
  const dashboard = read('store-dashboard.js');
  assert.match(dashboard, /identity_verifications\?select=review_status/);
  assert.match(dashboard, /Complete identity verification and add your payout details before publishing your store/);
});

test('public native storefront catalogue exposes customer prices but not supplier cost data', () => {
  const start = checkoutSql.indexOf('create or replace function public.public_dropshipper_store_by_slug');
  assert.notEqual(start, -1);
  const body = checkoutSql.slice(start);
  assert.match(body, /'price',spv\.retail_price/);
  assert.doesNotMatch(body, /'cost_price'|'supplier_cost'|'supplier_name'|'supplier_business_name'/i);
  assert.match(body, /dv\.review_status='approved'/);
});

test('native COD checkout validates, rate-limits and creates customer-priced orders', () => {
  assert.match(gateway, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(gateway, /ALLOWED_ORIGIN/);
  assert.match(gateway, /storefront_check_rate_limit/);
  assert.match(gateway, /native_storefront_create_order/);
  assert.match(checkoutSql, /auth\.role\(\) <> 'service_role'/);
  assert.match(checkoutSql, /for update of v/);
  assert.match(checkoutSql, /stock_quantity=stock_quantity-_quantity/);
  assert.match(checkoutSql, /retail_price_at_purchase/);
  assert.match(checkoutSql, /'payment_method','cod'/);
  assert.match(checkoutSql, /native_storefront_order_requests/);
});

test('admin account, order, payout and inventory changes are role-gated and audited', () => {
  for (const fn of [
    'admin_list_operational_accounts',
    'admin_update_operational_profile',
    'admin_set_dropshipper_status',
    'admin_update_payout_destination'
  ]) assert.ok(verificationSql.includes('function public.'+fn), 'missing function '+fn);
  for (const fn of ['admin_update_order_shipping_details','admin_adjust_product_variant_stock']) {
    assert.ok(adminSql.includes('function public.'+fn), 'missing function '+fn);
  }
  for (const file of [verificationSql,adminSql]) {
    assert.match(file, /private\.has_role\(auth\.uid\(\),'admin'::public\.app_role\)/);
    assert.match(file, /insert into public\.audit_log/);
  }
  const ui = read('admin-accounts.js');
  const admin = read('admin.js');
  const payout = read('admin-payout-directory.js');
  assert.match(ui, /admin_list_operational_accounts/);
  assert.match(ui, /admin_update_operational_profile/);
  assert.match(ui, /admin_set_dropshipper_status/);
  assert.match(payout, /admin_update_payout_destination/);
  assert.match(admin, /admin_update_order_shipping_details/);
  assert.match(admin, /admin_adjust_product_variant_stock/);
});

test('email confirmation is required before verification submission and protected store actions', () => {
  assert.match(verificationSql, /Confirm your email address before submitting supplier verification/);
  assert.match(verificationSql, /Confirm your email address before submitting identity verification/);
  assert.match(verificationSql, /supplier must confirm their email address before verification approval/);
  assert.match(verificationSql, /dropshipper must confirm their email address before identity approval/);
  assert.match(verificationSql, /u\.email_confirmed_at is not null/);
});

test('admins can edit supplier and dropshipper verification records with audit logging', () => {
  const editSql = read('supabase/migrations/20261118150000_admin_verification_edit_controls.sql');
  const admin = read('admin.js');
  assert.match(editSql, /admin_update_supplier_verification_details/);
  assert.match(editSql, /admin_update_dropshipper_verification_details/);
  assert.match(editSql, /admin_supplier_verification_details_updated/);
  assert.match(editSql, /admin_dropshipper_verification_details_updated/);
  assert.match(admin, /admin-supplier-verification-edit/);
  assert.match(admin, /admin-dropshipper-verification-edit/);
  assert.match(admin, /admin_update_supplier_verification_details/);
  assert.match(admin, /admin_update_dropshipper_verification_details/);
});

test('private service credentials are not shipped in browser assets', () => {
  for (const file of ['login.js','storefront.js','admin.js','admin-accounts.js','verification-center.js']) {
    const source = read(file);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role_secret|service_role_key\s*[:=]/i, file);
  }
});

test('native checkout UI includes customer delivery form and no supplier-facing fields', () => {
  const storefront = read('storefront.js');
  assert.match(storefront, /storefront-checkout-form/);
  assert.match(storefront, /checkout-address/);
  assert.match(storefront, /checkout-map/);
  assert.match(storefront, /native-storefront-gateway/);
  assert.doesNotMatch(storefront, /supplier_cost|supplier_name|business_phone/);
});
