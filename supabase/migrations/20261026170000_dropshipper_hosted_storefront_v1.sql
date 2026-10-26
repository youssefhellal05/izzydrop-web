begin;

-- Keep one dropshipper-specific storefront profile, separate from supplier listings.
create table if not exists public.dropshipper_stores (
  id uuid primary key default gen_random_uuid(),
  dropshipper_id uuid not null unique references public.dropshippers(id) on delete cascade,
  store_name text not null,
  slug text not null unique,
  description text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dropshipper_stores_name_length check (char_length(btrim(store_name)) between 2 and 80),
  constraint dropshipper_stores_slug_format check (
    char_length(slug) between 3 and 48
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint dropshipper_stores_description_length check (char_length(description) <= 500)
);

-- Product edits are scoped to a dropshipper's link; supplier source data is never overwritten.
alter table public.dropshipper_product_links
  add column if not exists custom_title text,
  add column if not exists custom_description text,
  add column if not exists custom_image_urls jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dropshipper_product_links_custom_image_urls_array'
      and conrelid = 'public.dropshipper_product_links'::regclass
  ) then
    alter table public.dropshipper_product_links
      add constraint dropshipper_product_links_custom_image_urls_array
      check (custom_image_urls is null or jsonb_typeof(custom_image_urls) = 'array');
  end if;
end $$;

-- Optional per-store variant visibility and price overrides. A missing configuration
-- means enabled supplier variants keep the existing default selection behavior.
create table if not exists public.dropshipper_store_product_variants (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.dropshipper_product_links(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  enabled boolean not null default true,
  retail_price numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dropshipper_store_product_variants_unique unique (link_id, variant_id),
  constraint dropshipper_store_product_variants_price_nonnegative
    check (retail_price is null or retail_price >= 0)
);

create index if not exists dropshipper_store_product_variants_variant_idx
  on public.dropshipper_store_product_variants(variant_id);

alter table public.dropshipper_stores enable row level security;
alter table public.dropshipper_store_product_variants enable row level security;

revoke all on public.dropshipper_stores from anon, public;
revoke all on public.dropshipper_store_product_variants from anon, public;
grant select, insert, update on public.dropshipper_stores to authenticated;
grant select, insert, update, delete on public.dropshipper_store_product_variants to authenticated;

drop policy if exists "dropshipper stores owner manages own" on public.dropshipper_stores;
create policy "dropshipper stores owner manages own"
  on public.dropshipper_stores
  for all to authenticated
  using (
    exists (
      select 1 from public.dropshippers d
      where d.id = dropshipper_stores.dropshipper_id
        and d.profile_id = auth.uid()
    )
    or private.has_role(auth.uid(), 'admin'::app_role)
  )
  with check (
    exists (
      select 1 from public.dropshippers d
      where d.id = dropshipper_stores.dropshipper_id
        and d.profile_id = auth.uid()
    )
    or private.has_role(auth.uid(), 'admin'::app_role)
  );

drop policy if exists "store product variants owner manages own" on public.dropshipper_store_product_variants;
create policy "store product variants owner manages own"
  on public.dropshipper_store_product_variants
  for all to authenticated
  using (
    exists (
      select 1
      from public.dropshipper_product_links l
      join public.dropshippers d on d.id = l.dropshipper_id
      where l.id = dropshipper_store_product_variants.link_id
        and d.profile_id = auth.uid()
    )
    or private.has_role(auth.uid(), 'admin'::app_role)
  )
  with check (
    exists (
      select 1
      from public.dropshipper_product_links l
      join public.dropshippers d on d.id = l.dropshipper_id
      where l.id = dropshipper_store_product_variants.link_id
        and d.profile_id = auth.uid()
    )
    or private.has_role(auth.uid(), 'admin'::app_role)
  );

-- Reject attempts to attach a variant from a different supplier product to a link.
create or replace function private.enforce_store_variant_link_match()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  linked_product_id uuid;
  actual_product_id uuid;
begin
  select l.supplier_product_id into linked_product_id
  from public.dropshipper_product_links l
  where l.id = new.link_id;

  select v.product_id into actual_product_id
  from public.product_variants v
  where v.id = new.variant_id;

  if linked_product_id is null or actual_product_id is null or linked_product_id <> actual_product_id then
    raise exception 'Variant must belong to the product selected in My Products';
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_store_variant_link_match() from public, anon, authenticated;
drop trigger if exists enforce_store_variant_link_match on public.dropshipper_store_product_variants;
create trigger enforce_store_variant_link_match
  before insert or update of link_id, variant_id
  on public.dropshipper_store_product_variants
  for each row execute function private.enforce_store_variant_link_match();

commit;
