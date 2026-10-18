'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('login.html');
const login=read('login.js');
const supplier=read('supplier.js');
const onboarding=read('supplier-onboarding.js');
const admin=read('admin.js');
const sql=read('supabase/migrations/20261013_pilot_supplier_onboarding.sql');

test('frontend JavaScript parses',()=>{
  for(const file of ['login.js','supplier.js','supplier-onboarding.js','verification-center.js','admin.js','common.js']){
    assert.doesNotThrow(()=>new Function(read(file)),file);
  }
});
test('signup requires explicit unchecked acceptance tied to immutable version',()=>{
  assert.match(html,/<input id="signup-terms"[^>]*type="checkbox"[^>]*required>/);
  assert.doesNotMatch(html,/<input id="signup-terms"[^>]*checked/);
  assert.match(login,/!\$\('#signup-terms'\)\?\.checked/);
  assert.match(login,/termsVersion:PILOT_TERMS_VERSION/);
  assert.match(login,/pilot_terms_accepted:true,pilot_terms_version:termsVersion/);
});
test('agreements only logged on new auth-user INSERT with exact policy version',()=>{
  assert.match(sql,/AFTER INSERT ON auth\.users/);
  assert.match(sql,/NEW\.raw_user_meta_data->>'pilot_terms_accepted'='true'/);
  assert.match(sql,/v_version='2026-10-13-pilot-v1'/);
  assert.match(sql,/ON CONFLICT DO NOTHING/);
  assert.match(sql,/REVOKE ALL ON public\.account_agreement_acceptances FROM PUBLIC, anon, authenticated/);
});
test('all new public tables explicitly have RLS and no anonymous writes',()=>{
  for(const table of ['account_agreement_acceptances','supplier_verification_applications','supplier_onboarding_drafts']){
    assert.ok(sql.includes('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY'),table);
    const revoke = new RegExp('REVOKE ALL ON public\\.'+table+' FROM PUBLIC, ?anon, ?authenticated');
    assert.match(sql,revoke,table);
  }
  assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE) ON public\.supplier_verification_applications TO authenticated/);
});
test('legacy approvals stay allowed but new suppliers require verified documents and assent',()=>{
  assert.match(sql,/ADD COLUMN verification_required boolean NOT NULL DEFAULT false/);
  assert.match(sql,/ALTER COLUMN verification_required SET DEFAULT true/);
  assert.match(sql,/NEW\.verification_required:=true/);
  assert.match(sql,/IF _decision='approve' AND requires_review THEN/);
  assert.match(sql,/Supplier verification must be approved first/);
  assert.match(sql,/Supplier has no recorded acceptance/);
});
test('pending supplier drafts never touch public marketplace product permissions',()=>{
  assert.match(sql,/CREATE TABLE public\.supplier_onboarding_drafts/);
  assert.match(sql,/s\.status='pending'/);
  assert.doesNotMatch(sql,/CREATE POLICY [\s\S]*? ON public\.supplier_products/);
  assert.match(supplier,/izzy:supplier-pending/);
  assert.match(supplier,/izzy:supplier-ready/);
  assert.match(onboarding,/supplier_onboarding_drafts/);
  assert.match(onboarding,/Nothing has been published/);
});
test('verification center and payout/publishing guards are wired into production',()=>{
  const workflow=read('supabase/migrations/202610190001_verification_workflows.sql');
  const supplierHtml=read('supplier.html');
  const appHtml=read('app.html');
  const adminHtml=read('admin.html');
  assert.match(supplierHtml,/verification-center\.js/);
  assert.match(appHtml,/verification-center\.js/);
  assert.match(adminHtml,/data-view="identity"/);
  assert.match(workflow,/CREATE TABLE IF NOT EXISTS public\.dropshipper_identity_verifications/i);
  assert.match(workflow,/dropshipper-identity-documents/);
  assert.match(workflow,/CREATE TRIGGER guard_dropshipper_payout_identity/i);
  assert.match(workflow,/CREATE TRIGGER require_supplier_verification_before_publish/i);
  assert.match(workflow,/admin_review_dropshipper_identity/);
  assert.match(workflow,/status in \('pending','approved'\)/);
});
test('supplier evidence is confined to the private storage bucket',()=>{
  assert.match(sql,/file_size_limit=5242880/);
  assert.match(sql,/allowed_mime_types=ARRAY\[/);
  assert.match(sql,/FROM storage\.objects o/);
  assert.match(sql,/registration_document_path/);
  assert.match(sql,/tax_document_path/);
  assert.match(onboarding,/uploadPilotDocument/);
  assert.match(onboarding,/supplier-documents/);
  assert.match(admin,/object\/sign\/supplier-documents/);
});
test('admins review submissions and can request changes without approving seller',()=>{
  assert.match(admin,/supplier_verification_applications\?select/);
  assert.match(admin,/data-decision="request_changes"/);
  assert.match(admin,/admin_review_supplier_verification/);
  assert.match(sql,/_decision='request_changes'/);
  assert.match(sql,/Only pending suppliers may be reviewed/);
  assert.match(sql,/IF next_status='approved' THEN/);
});
