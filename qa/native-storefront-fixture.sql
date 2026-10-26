-- Disposable CI-only schema fixture for the native storefront migration.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS storage;

-- Mirror Supabase's broad default grants so the hardening migration is exercised in CI.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

CREATE TYPE public.app_role AS ENUM ('admin','supplier','dropshipper');

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT false $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TABLE public.dropshippers (
  id uuid PRIMARY KEY, profile_id uuid NOT NULL, business_name text, status text NOT NULL
);
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY, business_name text, status text NOT NULL
);
CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY, supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  name text NOT NULL, name_en text, description text, description_en text, currency text NOT NULL,
  status text NOT NULL, admin_blocked boolean NOT NULL DEFAULT false
);
CREATE TABLE public.dropshipper_product_links (
  id uuid PRIMARY KEY, dropshipper_id uuid NOT NULL REFERENCES public.dropshippers(id),
  supplier_product_id uuid NOT NULL REFERENCES public.supplier_products(id), status text NOT NULL
);
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES public.supplier_products(id),
  is_enabled boolean NOT NULL, stock_quantity integer NOT NULL, variant_name text, sku text,
  option_values jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  variant_image_url text
);
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.supplier_products(id),
  url text NOT NULL, position integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (bucket_id text NOT NULL, name text NOT NULL);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[] LANGUAGE sql IMMUTABLE
AS $$ SELECT string_to_array(name, '/') $$;

GRANT USAGE ON SCHEMA public, auth, private, storage TO anon, authenticated;
GRANT SELECT ON public.dropshippers, public.dropshipper_product_links TO authenticated;
GRANT SELECT ON public.supplier_products, public.suppliers, public.product_variants, public.product_images TO authenticated;
