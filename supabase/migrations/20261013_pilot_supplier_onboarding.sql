-- IzzyDrop controlled pilot onboarding, staged ONLY; do not apply directly to production.
-- Preserve legacy supplier access and existing commercial tables/flows.
BEGIN;

-- Existing private bucket: restrict new uploads without changing owner/admin RLS.
UPDATE storage.buckets
  SET file_size_limit=5242880,
      allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png']::text[]
  WHERE id='supplier-documents';

CREATE TABLE public.account_agreement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('supplier','dropshipper')),
  policy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  acceptance_method text NOT NULL DEFAULT 'signup',
  UNIQUE(user_id,account_type,policy_version)
);
ALTER TABLE public.account_agreement_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_agreement_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_agreement_acceptances TO authenticated;
CREATE POLICY pilot_agreement_read ON public.account_agreement_acceptances
  FOR SELECT TO authenticated USING (
    user_id=(select auth.uid()) OR private.has_role((select auth.uid()),'admin'::public.app_role)
  );

-- Capture only the registration event; changes to editable user metadata do not change this record.
-- A browser checkbox is evidence of assent, not proof of government identity.
CREATE OR REPLACE FUNCTION private.capture_pilot_signup_acceptance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $fn$
DECLARE v_type text; v_version text;
BEGIN
  v_type:=NEW.raw_user_meta_data->>'requested_account_type';
  v_version:=NEW.raw_user_meta_data->>'pilot_terms_version';
  IF v_type IN ('supplier','dropshipper')
     AND NEW.raw_user_meta_data->>'pilot_terms_accepted'='true'
     AND v_version='2026-10-13-pilot-v1' THEN
    INSERT INTO public.account_agreement_acceptances(user_id,account_type,policy_version,acceptance_method)
    VALUES(NEW.id,v_type,v_version,'signup')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $fn$;
-- First install only: the Auth-owned table grants TRIGGER but not trigger DROP to postgres.
-- Do not attempt DROP TRIGGER against auth.users during the pilot rollout.
CREATE TRIGGER trg_capture_pilot_signup_acceptance AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.capture_pilot_signup_acceptance();
REVOKE ALL ON FUNCTION private.capture_pilot_signup_acceptance() FROM PUBLIC,anon,authenticated;

-- Grandfather current suppliers. After migration new applications require review;
-- the INSERT trigger stops any browser from passing verification_required=false.
ALTER TABLE public.suppliers ADD COLUMN verification_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.suppliers ALTER COLUMN verification_required SET DEFAULT true;
CREATE OR REPLACE FUNCTION private.protect_pilot_verification_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(),'admin'::public.app_role)
       THEN NEW.verification_required:=true; END IF;
  ELSIF NEW.verification_required IS DISTINCT FROM OLD.verification_required
        AND auth.uid() IS NOT NULL
        AND NOT private.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Supplier verification requirement cannot be changed';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_protect_pilot_verification_flag ON public.suppliers;
CREATE TRIGGER trg_protect_pilot_verification_flag
BEFORE INSERT OR UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION private.protect_pilot_verification_flag();
REVOKE ALL ON FUNCTION private.protect_pilot_verification_flag() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.supplier_verification_applications (
  supplier_id uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  business_address text NOT NULL,
  business_phone text NOT NULL,
  registration_status text NOT NULL CHECK (registration_status IN ('registered','in_progress','not_registered')),
  registration_number text,
  tax_registration_number text,
  registration_document_path text,
  tax_document_path text,
  supplier_notes text,
  review_status text NOT NULL DEFAULT 'submitted'
    CHECK (review_status IN ('submitted','needs_changes','approved','rejected')),
  review_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submission_count integer NOT NULL DEFAULT 1 CHECK (submission_count > 0)
);
ALTER TABLE public.supplier_verification_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_verification_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.supplier_verification_applications TO authenticated;
CREATE POLICY pilot_verification_read ON public.supplier_verification_applications
FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.suppliers s
         WHERE s.id=supplier_id AND s.profile_id=(select auth.uid()))
 OR private.has_role((select auth.uid()),'admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.supplier_submit_verification(
  _business_address text, _business_phone text, _registration_status text,
  _registration_number text DEFAULT NULL, _tax_registration_number text DEFAULT NULL,
  _registration_document_path text DEFAULT NULL, _tax_document_path text DEFAULT NULL,
  _supplier_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $fn$
DECLARE sid uuid; changed public.supplier_verification_applications%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT id INTO sid FROM public.suppliers
  WHERE profile_id=auth.uid() AND status='pending' FOR UPDATE;
  IF sid IS NULL THEN RAISE EXCEPTION 'Only a pending supplier may submit verification'; END IF;
  IF length(btrim(coalesce(_business_address,'')))<8 OR length(_business_address)>400
     THEN RAISE EXCEPTION 'Enter a complete business or warehouse address'; END IF;
  IF length(btrim(coalesce(_business_phone,'')))<7 OR length(_business_phone)>40
     THEN RAISE EXCEPTION 'Enter a valid contact number'; END IF;
  IF _registration_status NOT IN ('registered','in_progress','not_registered')
     OR _registration_status IS NULL THEN RAISE EXCEPTION 'Select a registration status'; END IF;
  IF length(coalesce(_registration_number,''))>100 OR length(coalesce(_tax_registration_number,''))>100
     OR length(coalesce(_registration_document_path,''))>300 OR length(coalesce(_tax_document_path,''))>300
     OR length(coalesce(_supplier_notes,''))>1500 THEN
    RAISE EXCEPTION 'One or more fields are too long';
  END IF;
  -- Uploaded paths must be owned by this supplier and physically exist in private storage.
  IF _registration_status='registered' AND
     (coalesce(btrim(_registration_document_path),'')='' OR coalesce(btrim(_tax_document_path),'')='') THEN
    RAISE EXCEPTION 'Upload commercial registration and tax documents before submitting';
  END IF;
  IF _registration_document_path IS NOT NULL AND
     (left(_registration_document_path,length(sid::text)+1)<>sid::text||'/'
      OR NOT EXISTS(SELECT 1 FROM storage.objects o
         WHERE o.bucket_id='supplier-documents' AND o.name=_registration_document_path)) THEN
    RAISE EXCEPTION 'Commercial registration document was not found in your private folder';
  END IF;
  IF _tax_document_path IS NOT NULL AND
     (left(_tax_document_path,length(sid::text)+1)<>sid::text||'/'
      OR NOT EXISTS(SELECT 1 FROM storage.objects o
         WHERE o.bucket_id='supplier-documents' AND o.name=_tax_document_path)) THEN
    RAISE EXCEPTION 'Tax document was not found in your private folder';
  END IF;
  INSERT INTO public.supplier_verification_applications
    (supplier_id,business_address,business_phone,registration_status,
     registration_number,tax_registration_number,registration_document_path,tax_document_path,supplier_notes)
  VALUES (sid,btrim(_business_address),btrim(_business_phone),_registration_status,
    nullif(btrim(_registration_number),''),nullif(btrim(_tax_registration_number),''),
    nullif(btrim(_registration_document_path),''),nullif(btrim(_tax_document_path),''),
    nullif(btrim(_supplier_notes),''))
  ON CONFLICT (supplier_id) DO UPDATE SET
    business_address=EXCLUDED.business_address,
    business_phone=EXCLUDED.business_phone,
    registration_status=EXCLUDED.registration_status,
    registration_number=EXCLUDED.registration_number,
    tax_registration_number=EXCLUDED.tax_registration_number,
    registration_document_path=EXCLUDED.registration_document_path,
    tax_document_path=EXCLUDED.tax_document_path,
    supplier_notes=EXCLUDED.supplier_notes,
    review_status='submitted',review_reason=NULL,reviewed_by=NULL,reviewed_at=NULL,
    submitted_at=now(),updated_at=now(),
    submission_count=public.supplier_verification_applications.submission_count+1
  RETURNING * INTO changed;
  INSERT INTO public.audit_log(actor_id,action,target_table,target_id,details)
  VALUES(auth.uid(),'supplier_verification_submitted','supplier_verification_applications',sid::text,
         jsonb_build_object('submission_count',changed.submission_count));
  RETURN jsonb_build_object('supplier_id',sid,'review_status',changed.review_status);
END $fn$;
REVOKE ALL ON FUNCTION public.supplier_submit_verification(text,text,text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.supplier_submit_verification(text,text,text,text,text,text,text,text) TO authenticated;

-- Staging-only draft store: intentionally NOT public.supplier_products.
-- No products, variants, image storage, orders, or payouts can reference these rows.
CREATE TABLE public.supplier_onboarding_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 150),
  description text CHECK (length(coalesce(description,''))<=5000),
  sku text CHECK (length(coalesce(sku,''))<=100),
  cost_price numeric NOT NULL CHECK(cost_price>=0),
  suggested_retail_price numeric CHECK(suggested_retail_price>=0),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.supplier_onboarding_drafts(supplier_id,created_at DESC);
ALTER TABLE public.supplier_onboarding_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_onboarding_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.supplier_onboarding_drafts TO authenticated;
CREATE POLICY pilot_drafts_read ON public.supplier_onboarding_drafts
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id
     AND s.profile_id=(select auth.uid()))
);
CREATE POLICY pilot_drafts_insert ON public.supplier_onboarding_drafts
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id
     AND s.profile_id=(select auth.uid()) AND s.status='pending')
);
CREATE POLICY pilot_drafts_update ON public.supplier_onboarding_drafts
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id
     AND s.profile_id=(select auth.uid()) AND s.status='pending'))
WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id
     AND s.profile_id=(select auth.uid()) AND s.status='pending'));
CREATE POLICY pilot_drafts_delete ON public.supplier_onboarding_drafts
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id
     AND s.profile_id=(select auth.uid()) AND s.status='pending')
);
-- Prevent updates from moving a draft to another supplier, including another owned row.
CREATE OR REPLACE FUNCTION private.protect_pilot_draft_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,private AS $fn$
BEGIN
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
    RAISE EXCEPTION 'Cannot move draft to another supplier';
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_protect_pilot_draft_owner
BEFORE UPDATE ON public.supplier_onboarding_drafts
FOR EACH ROW EXECUTE FUNCTION private.protect_pilot_draft_owner();

-- Keep the original, proven approval RPC behavior for grandfathered suppliers.
-- For NEW suppliers, forbid approval until verification AND signup assent are recorded.
CREATE OR REPLACE FUNCTION public.admin_review_supplier(_supplier_id uuid,_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $fn$
DECLARE new_status public.supplier_status; old_status public.supplier_status;
        supplier_name text; supplier_owner uuid; requires_review boolean;
BEGIN
  IF NOT private.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF _decision='approve' THEN new_status:='approved';
  ELSIF _decision='reject' THEN new_status:='rejected';
  ELSIF _decision='suspend' THEN new_status:='suspended';
  ELSE RAISE EXCEPTION 'Invalid supplier review decision'; END IF;
  SELECT status,business_name,profile_id,verification_required
    INTO old_status,supplier_name,supplier_owner,requires_review
  FROM public.suppliers WHERE id=_supplier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF;

  IF _decision='approve' AND requires_review THEN
    IF NOT EXISTS(SELECT 1 FROM public.supplier_verification_applications a
      WHERE a.supplier_id=_supplier_id AND a.review_status='approved') THEN
      RAISE EXCEPTION 'Supplier verification must be approved first';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.account_agreement_acceptances a
      WHERE a.user_id=supplier_owner AND a.account_type='supplier'
        AND a.policy_version='2026-10-13-pilot-v1') THEN
      RAISE EXCEPTION 'Supplier has no recorded acceptance of the pilot terms';
    END IF;
  END IF;
  UPDATE public.suppliers SET status=new_status,
    approved_by=CASE WHEN new_status='approved' THEN auth.uid() ELSE approved_by END,
    approved_at=CASE WHEN new_status='approved' THEN now() ELSE approved_at END,
    updated_at=now() WHERE id=_supplier_id;
  INSERT INTO public.audit_log(actor_id,action,target_table,target_id,details)
  VALUES(auth.uid(),'supplier_status_changed','suppliers',_supplier_id::text,
    jsonb_build_object('supplier_name',supplier_name,'from',old_status,'to',new_status));
  RETURN jsonb_build_object('supplier_id',_supplier_id,'status',new_status);
END $fn$;
REVOKE ALL ON FUNCTION public.admin_review_supplier(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_supplier(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_supplier_verification(
  _supplier_id uuid,_decision text,_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $fn$
DECLARE a public.supplier_verification_applications%ROWTYPE;
        next_status text; current_supplier_status public.supplier_status;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(),'admin'::public.app_role)
    THEN RAISE EXCEPTION 'Admin access required'; END IF;
  -- Lock suppliers before applications, matching supplier submissions, to avoid deadlocks.
  SELECT status INTO current_supplier_status FROM public.suppliers
    WHERE id=_supplier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF;
  IF current_supplier_status<>'pending' THEN
    RAISE EXCEPTION 'Only pending suppliers may be reviewed in pilot onboarding';
  END IF;
  SELECT * INTO a FROM public.supplier_verification_applications
    WHERE supplier_id=_supplier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No verification submitted'; END IF;
  IF _decision='request_changes' THEN
    next_status:='needs_changes';
  ELSIF _decision='reject' THEN
    next_status:='rejected';
  ELSIF _decision='approve' THEN
    IF a.review_status<>'submitted' THEN RAISE EXCEPTION 'Only submitted applications may be approved'; END IF;
    IF a.registration_status<>'registered'
       OR coalesce(btrim(a.registration_number),'')=''
       OR coalesce(btrim(a.tax_registration_number),'')=''
       OR coalesce(btrim(a.registration_document_path),'')=''
       OR coalesce(btrim(a.tax_document_path),'')='' THEN
       RAISE EXCEPTION 'Commercial registration and tax details and uploaded documents must be complete for approval';
    END IF;
    next_status:='approved';
  ELSE RAISE EXCEPTION 'Unknown verification decision'; END IF;
  IF next_status IN ('needs_changes','rejected') AND length(btrim(coalesce(_reason,'')))<8
     THEN RAISE EXCEPTION 'A clear reason is required'; END IF;
  UPDATE public.supplier_verification_applications SET
    review_status=next_status,review_reason=nullif(btrim(_reason),''),
    reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
  WHERE supplier_id=_supplier_id;
  INSERT INTO public.audit_log(actor_id,action,target_table,target_id,details)
  VALUES(auth.uid(),'supplier_verification_reviewed','supplier_verification_applications',_supplier_id::text,
    jsonb_build_object('decision',next_status,'reason',left(coalesce(_reason,''),500)));
  IF next_status='approved' THEN
    PERFORM public.admin_review_supplier(_supplier_id,'approve');
  ELSIF next_status='rejected' THEN
    PERFORM public.admin_review_supplier(_supplier_id,'reject');
  END IF;
  RETURN jsonb_build_object('supplier_id',_supplier_id,'review_status',next_status);
END $fn$;
REVOKE ALL ON FUNCTION public.admin_review_supplier_verification(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_supplier_verification(uuid,text,text) TO authenticated;

COMMIT;
