-- WooCommerce connection credentials and mappings are server-managed only.
-- Browser clients cannot read store secrets or publish mappings directly.
create table if not exists public.woocommerce_store_credentials (
  id uuid primary key default gen_random_uuid(),
  dropshipper_id uuid not null references public.dropshippers(id) on delete cascade unique,
  store_url text not null,
  consumer_key text not null,
  consumer_secret text not null,
  store_name text,
  currency text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.woocommerce_store_credentials enable row level security;
revoke all on public.woocommerce_store_credentials from anon, authenticated;
grant all on public.woocommerce_store_credentials to service_role;

create table if not exists public.woocommerce_product_mappings (
  id uuid primary key default gen_random_uuid(),
  store_credential_id uuid not null references public.woocommerce_store_credentials(id) on delete cascade,
  store_url text not null,
  dropshipper_id uuid not null references public.dropshippers(id) on delete cascade,
  supplier_product_id uuid not null references public.supplier_products(id) on delete cascade,
  woo_product_id bigint not null,
  product_type text not null check (product_type in ('simple', 'variable')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_credential_id, store_url, supplier_product_id)
);

create index if not exists woocommerce_product_mappings_dropshipper_idx
  on public.woocommerce_product_mappings (dropshipper_id, updated_at desc);

alter table public.woocommerce_product_mappings enable row level security;
revoke all on public.woocommerce_product_mappings from anon, authenticated;
grant all on public.woocommerce_product_mappings to service_role;

create table if not exists public.woocommerce_variant_mappings (
  id uuid primary key default gen_random_uuid(),
  store_credential_id uuid not null references public.woocommerce_store_credentials(id) on delete cascade,
  store_url text not null,
  dropshipper_id uuid not null references public.dropshippers(id) on delete cascade,
  supplier_product_id uuid not null references public.supplier_products(id) on delete cascade,
  supplier_variant_id uuid not null references public.product_variants(id) on delete cascade,
  woo_product_id bigint not null,
  woo_item_id bigint not null,
  is_variation boolean not null default true,
  sku text not null,
  last_synced_price numeric(12,2) not null check (last_synced_price >= 0),
  last_synced_stock integer not null check (last_synced_stock >= 0),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_credential_id, store_url, supplier_variant_id)
);

create index if not exists woocommerce_variant_mappings_product_idx
  on public.woocommerce_variant_mappings (store_credential_id, store_url, supplier_product_id);

alter table public.woocommerce_variant_mappings enable row level security;
revoke all on public.woocommerce_variant_mappings from anon, authenticated;
grant all on public.woocommerce_variant_mappings to service_role;
