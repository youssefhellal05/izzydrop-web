-- Executed AFTER qa/pilot-db-fixture.sql AND the actual pilot migration.
-- These assertions run against temporary CI PostgreSQL ONLY.
DO $$
BEGIN
  IF (SELECT verification_required FROM public.suppliers
      WHERE id='00000000-0000-0000-0000-0000000000a2') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Legacy suppliers were not grandfathered';
  END IF;
  IF (SELECT file_size_limit FROM storage.buckets WHERE id='supplier-documents')<>5242880
     THEN RAISE EXCEPTION 'Private document upload limit absent'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='supplier_onboarding_drafts' AND relrowsecurity)
     THEN RAISE EXCEPTION 'Drafts are missing RLS'; END IF;
END $$;

INSERT INTO auth.users (id,raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-0000000000b1','{}'),
 ('00000000-0000-0000-0000-0000000000c1','{"requested_account_type":"supplier","pilot_terms_accepted":true,"pilot_terms_version":"2026-10-13-pilot-v1"}'),
 ('00000000-0000-0000-0000-0000000000d1','{"requested_account_type":"dropshipper","pilot_terms_accepted":true,"pilot_terms_version":"wrong-version"}');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-0000-0000-0000000000b1','admin'),
 ('00000000-0000-0000-0000-0000000000c1','supplier'),
 ('00000000-0000-0000-0000-0000000000d1','dropshipper');
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.account_agreement_acceptances
               WHERE user_id='00000000-0000-0000-0000-0000000000c1'
                 AND policy_version='2026-10-13-pilot-v1') THEN
  RAISE EXCEPTION 'Correct signup acceptance was not captured';
 END IF;
 IF EXISTS(SELECT 1 FROM public.account_agreement_acceptances
           WHERE user_id='00000000-0000-0000-0000-0000000000d1') THEN
  RAISE EXCEPTION 'Unknown version must not create acceptance evidence';
 END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
-- Deliberately try to bypass new-supplier verification.
INSERT INTO public.suppliers(id,profile_id,business_name,verification_required)
VALUES ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000c1','New Supplier',false);
DO $$
BEGIN
 IF (SELECT verification_required FROM public.suppliers
    WHERE id='00000000-0000-0000-0000-0000000000c2') IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Client bypassed new-supplier verification';
 END IF;
END $$;
INSERT INTO public.supplier_onboarding_drafts(supplier_id,name,cost_price)
VALUES('00000000-0000-0000-0000-0000000000c2','Private draft',12);
DO $$
BEGIN
  BEGIN
   INSERT INTO public.supplier_onboarding_drafts(supplier_id,name,cost_price)
   VALUES('00000000-0000-0000-0000-0000000000a2','Forged draft',1);
   RAISE EXCEPTION 'Another supplier draft was accepted';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Another supplier draft was accepted' THEN RAISE; END IF;
  END;
END $$;
-- In-progress applications can request changes, but NOT be approved.
SELECT public.supplier_submit_verification('12 Warehouse Street, Cairo','01000000000','in_progress');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
DO $$
BEGIN
 BEGIN
   PERFORM public.admin_review_supplier('00000000-0000-0000-0000-0000000000c2','approve');
   RAISE EXCEPTION 'Approval bypassed application review';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM <> 'Supplier verification must be approved first' THEN RAISE; END IF;
 END;
END $$;
SELECT public.admin_review_supplier_verification('00000000-0000-0000-0000-0000000000c2','request_changes','Registration documents are required');
RESET ROLE;
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('supplier-documents','00000000-0000-0000-0000-0000000000c2/registration.pdf'),
 ('supplier-documents','00000000-0000-0000-0000-0000000000c2/tax.pdf');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
SELECT public.supplier_submit_verification(
 '12 Warehouse Street, Cairo','01000000000','registered','CR123','TAX123',
 '00000000-0000-0000-0000-0000000000c2/registration.pdf',
 '00000000-0000-0000-0000-0000000000c2/tax.pdf'
);
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false);
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.supplier_verification_applications
   WHERE supplier_id='00000000-0000-0000-0000-0000000000c2') THEN
   RAISE EXCEPTION 'Other account can read supplier verification';
 END IF;
 IF EXISTS(SELECT 1 FROM public.supplier_onboarding_drafts
   WHERE supplier_id='00000000-0000-0000-0000-0000000000c2') THEN
   RAISE EXCEPTION 'Other account can read supplier drafts';
 END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
SELECT public.admin_review_supplier_verification('00000000-0000-0000-0000-0000000000c2','approve');
DO $$
BEGIN
 IF (SELECT status FROM public.suppliers
   WHERE id='00000000-0000-0000-0000-0000000000c2') <> 'approved' THEN
   RAISE EXCEPTION 'Approved verification did not approve supplier';
 END IF;
 IF (SELECT review_status FROM public.supplier_verification_applications
   WHERE supplier_id='00000000-0000-0000-0000-0000000000c2') <> 'approved' THEN
   RAISE EXCEPTION 'Application decision was not recorded';
 END IF;
END $$;
RESET ROLE;
SELECT 'Pilot SQL smoke tests passed against the isolated PostgreSQL fixture' AS result;
