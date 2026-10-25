-- WooCommerce connection credentials are server-managed only.
-- Keys are never readable from browser clients; access is through Edge Functions.
create table if not exists public.woocommerce_store_credentials (
  id uuid primary key default gen_random_uuid(),
  dropshipper_id uuid not null references public.dropshippers(id) on delete cascade,
  store_url text not null,
  consumer_key text not null,
  consumer_secret text not null,
  store_name text,
  currency text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dropshipper_id, store_url)
);

alter table public.woocommerce_store_credentials enable row level security;
revoke all on public.woocommerce_store_credentials from anon, authenticated;
grant all on public.woocommerce_store_credentials to service_role;
