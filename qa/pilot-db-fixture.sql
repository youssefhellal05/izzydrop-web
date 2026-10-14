-- A deliberately SMALL schema fixture for migration compilation / RLS smoke tests.
-- This is not the full IzzyDrop production schema or a substitute for end-to-end staging.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA storage;
CREATE TYPE public.app_role AS ENUM ('admin','supplier','dropshipper');
CREATE TYPE public.supplier_status AS ENUM ('pending','approved','rejected','suspended');
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL,
  PRIMARY KEY(user_id,role)
);
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id),
  business_name text NOT NULL,
  status public.supplier_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_table text,
  target_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL
);
INSERT INTO storage.buckets (id) VALUES ('supplier-documents');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE FUNCTION private.has_role(_user_id uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;
GRANT USAGE ON SCHEMA public,auth,private,storage TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.suppliers TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
CREATE POLICY pilot_fixture_supplier_select ON public.suppliers FOR SELECT TO authenticated
USING (profile_id=(select auth.uid()) OR private.has_role((select auth.uid()),'admin'::public.app_role));
CREATE POLICY pilot_fixture_supplier_insert ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (profile_id=(select auth.uid()));
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
-- A legacy supplier predating the migration must remain exempt.
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.suppliers(id,profile_id,business_name,status) VALUES
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','Legacy Supplier','approved');
