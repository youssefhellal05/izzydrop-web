-- Native IzzyDrop storefront MVP. Does not modify Shopify or custom-website integrations.
create table if not exists public.dropshipper_stores (
  id uuid primary key default gen_random_uuid(),
  dropshipper_id uuid not null unique references public.dropshippers(id) on delete cascade,
  slug text not null unique,
  store_name text not null check (length(btrim(store_name)) between 2 and 80),
  description text not null default '' check (length(description) <= 800),
  logo_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dropshipper_stores_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint dropshipper_stores_slug_reserved check (
    slug not in ('admin','app','api','assets','auth','login','logout','products','product','settings',
                 'store','storefront','store-manager','supplier','suppliers','checkout','orders','help','about')
  ),
  constraint dropshipper_stores_logo_url_https check (logo_url is null or logo_url ~* '^https://[^[:space:]]+$')
);

create table if not exists public.dropshipper_store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.dropshipper_stores(id) on delete cascade,
  product_link_id uuid not null references public.dropshipper_product_links(id) on delete cascade,
  is_published boolean not null default false,
  content_reviewed_at timestamptz,
  title_override text check (title_override is null or length(title_override) between 2 and 200),
  description_override text check (description_override is null or length(description_override) <= 5000),
  selected_image_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(selected_image_urls) = 'array' and jsonb_array_length(selected_image_urls) <= 20),
  custom_image_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(custom_image_urls) = 'array' and jsonb_array_length(custom_image_urls) <= 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dropshipper_store_products_store_link_unique unique (store_id, product_link_id)
);

create table if not exists public.dropshipper_store_product_variants (
  id uuid primary key default gen_random_uuid(),
  store_product_id uuid not null references public.dropshipper_store_products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  retail_price numeric(12,2) not null check (retail_price >= 0 and retail_price <= 100000000),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dropshipper_store_product_variants_unique unique (store_product_id, variant_id)
);

create index if not exists idx_dropshipper_stores_published_slug
  on public.dropshipper_stores (slug) where published = true;
create index if not exists idx_store_products_store_published
  on public.dropshipper_store_products (store_id, is_published, created_at desc);
create index if not exists idx_store_product_variants_parent_enabled
  on public.dropshipper_store_product_variants (store_product_id, enabled);

alter table public.dropshipper_stores enable row level security;
alter table public.dropshipper_store_products enable row level security;
alter table public.dropshipper_store_product_variants enable row level security;

revoke all on public.dropshipper_stores from anon;
revoke all on public.dropshipper_store_products from anon;
revoke all on public.dropshipper_store_product_variants from anon;
grant select, insert, update, delete on public.dropshipper_stores to authenticated;
grant select, insert, update, delete on public.dropshipper_store_products to authenticated;
grant select, insert, update, delete on public.dropshipper_store_product_variants to authenticated;

drop policy if exists "store owner manages own storefront" on public.dropshipper_stores;
create policy "store owner manages own storefront"
on public.dropshipper_stores
for all to authenticated
using (exists (
  select 1 from public.dropshippers d
  where d.id = dropshipper_stores.dropshipper_id
    and d.profile_id = (select auth.uid())
))
with check (exists (
  select 1 from public.dropshippers d
  where d.id = dropshipper_stores.dropshipper_id
    and d.profile_id = (select auth.uid())
));

drop policy if exists "admin manages all storefronts" on public.dropshipper_stores;
create policy "admin manages all storefronts"
on public.dropshipper_stores
for all to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role))
with check (private.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "store owner manages own store products" on public.dropshipper_store_products;
create policy "store owner manages own store products"
on public.dropshipper_store_products
for all to authenticated
using (exists (
  select 1
  from public.dropshipper_stores ds
  join public.dropshippers d on d.id = ds.dropshipper_id
  join public.dropshipper_product_links l on l.id = dropshipper_store_products.product_link_id
  where ds.id = dropshipper_store_products.store_id
    and l.dropshipper_id = ds.dropshipper_id
    and d.profile_id = (select auth.uid())
))
with check (exists (
  select 1
  from public.dropshipper_stores ds
  join public.dropshippers d on d.id = ds.dropshipper_id
  join public.dropshipper_product_links l on l.id = dropshipper_store_products.product_link_id
  where ds.id = dropshipper_store_products.store_id
    and l.dropshipper_id = ds.dropshipper_id
    and d.profile_id = (select auth.uid())
));

drop policy if exists "admin manages all store products" on public.dropshipper_store_products;
create policy "admin manages all store products"
on public.dropshipper_store_products
for all to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role))
with check (private.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "store owner manages own store product variants" on public.dropshipper_store_product_variants;
create policy "store owner manages own store product variants"
on public.dropshipper_store_product_variants
for all to authenticated
using (exists (
  select 1
  from public.dropshipper_store_products dsp
  join public.dropshipper_stores ds on ds.id = dsp.store_id
  join public.dropshippers d on d.id = ds.dropshipper_id
  where dsp.id = dropshipper_store_product_variants.store_product_id
    and d.profile_id = (select auth.uid())
))
with check (exists (
  select 1
  from public.dropshipper_store_products dsp
  join public.dropshipper_stores ds on ds.id = dsp.store_id
  join public.dropshippers d on d.id = ds.dropshipper_id
  where dsp.id = dropshipper_store_product_variants.store_product_id
    and d.profile_id = (select auth.uid())
));

drop policy if exists "admin manages all store product variants" on public.dropshipper_store_product_variants;
create policy "admin manages all store product variants"
on public.dropshipper_store_product_variants
for all to authenticated
using (private.has_role((select auth.uid()), 'admin'::public.app_role))
with check (private.has_role((select auth.uid()), 'admin'::public.app_role));

create or replace function private.validate_dropshipper_store_product()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_store_dropshipper_id uuid;
  v_link_dropshipper_id uuid;
begin
  select ds.dropshipper_id into v_store_dropshipper_id
  from public.dropshipper_stores ds where ds.id = new.store_id;
  select l.dropshipper_id into v_link_dropshipper_id
  from public.dropshipper_product_links l where l.id = new.product_link_id;

  if v_store_dropshipper_id is null or v_link_dropshipper_id is null
     or v_store_dropshipper_id is distinct from v_link_dropshipper_id then
    raise exception 'Store products must belong to the same dropshipper as the product link';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_dropshipper_store_product() from public, anon, authenticated;

drop trigger if exists validate_dropshipper_store_product on public.dropshipper_store_products;
create trigger validate_dropshipper_store_product
before insert or update of store_id, product_link_id on public.dropshipper_store_products
for each row execute function private.validate_dropshipper_store_product();

create or replace function private.validate_dropshipper_store_variant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_source_product_id uuid;
  v_variant_product_id uuid;
begin
  select l.supplier_product_id into v_source_product_id
  from public.dropshipper_store_products dsp
  join public.dropshipper_product_links l on l.id = dsp.product_link_id
  where dsp.id = new.store_product_id;

  select v.product_id into v_variant_product_id
  from public.product_variants v where v.id = new.variant_id;

  if v_source_product_id is null or v_variant_product_id is null
     or v_source_product_id is distinct from v_variant_product_id then
    raise exception 'Store variant must belong to the selected source product';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_dropshipper_store_variant() from public, anon, authenticated;

drop trigger if exists validate_dropshipper_store_variant on public.dropshipper_store_product_variants;
create trigger validate_dropshipper_store_variant
before insert or update of store_product_id, variant_id on public.dropshipper_store_product_variants
for each row execute function private.validate_dropshipper_store_variant();

drop trigger if exists dropshipper_stores_set_updated_at on public.dropshipper_stores;
create trigger dropshipper_stores_set_updated_at
before update on public.dropshipper_stores
for each row execute function public.set_updated_at();

drop trigger if exists dropshipper_store_products_set_updated_at on public.dropshipper_store_products;
create trigger dropshipper_store_products_set_updated_at
before update on public.dropshipper_store_products
for each row execute function public.set_updated_at();

drop trigger if exists dropshipper_store_product_variants_set_updated_at on public.dropshipper_store_product_variants;
create trigger dropshipper_store_product_variants_set_updated_at
before update on public.dropshipper_store_product_variants
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('storefront-images', 'storefront-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

drop policy if exists "storefront images public read" on storage.objects;
create policy "storefront images public read"
on storage.objects for select
using (bucket_id = 'storefront-images');

drop policy if exists "storefront owner uploads own images" on storage.objects;
create policy "storefront owner uploads own images"
on storage.objects for insert to authenticated
with check (bucket_id = 'storefront-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "storefront owner updates own images" on storage.objects;
create policy "storefront owner updates own images"
on storage.objects for update to authenticated
using (bucket_id = 'storefront-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'storefront-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "storefront owner deletes own images" on storage.objects;
create policy "storefront owner deletes own images"
on storage.objects for delete to authenticated
using (bucket_id = 'storefront-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.public_dropshipper_store_by_slug(_slug text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $function$
  select jsonb_build_object(
    'store', jsonb_build_object(
      'store_name', ds.store_name,
      'slug', ds.slug,
      'description', ds.description,
      'logo_url', ds.logo_url
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', dsp.id,
          'title', coalesce(nullif(btrim(dsp.title_override), ''), nullif(btrim(p.name_en), ''), p.name),
          'description', coalesce(dsp.description_override, ''),
          'currency', p.currency,
          'images', coalesce((
            select jsonb_agg(to_jsonb(img.url) order by img.pos)
            from (
              select selected.value as url, selected.ordinality as pos
              from jsonb_array_elements_text(
                case
                  when jsonb_array_length(dsp.selected_image_urls) > 0 then dsp.selected_image_urls
                  else coalesce((
                    select jsonb_agg(pi.url order by pi.position, pi.created_at)
                    from public.product_images pi where pi.product_id = p.id
                  ), '[]'::jsonb)
                end
              ) with ordinality as selected(value, ordinality)
              union all
              select custom.value as url, custom.ordinality + 10000 as pos
              from jsonb_array_elements_text(dsp.custom_image_urls) with ordinality as custom(value, ordinality)
            ) img
            where img.url ~* '^https://[^[:space:]]+$'
          ), '[]'::jsonb),
          'variants', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', v.id,
              'name', coalesce(nullif(btrim(v.variant_name), ''), 'Option'),
              'options', coalesce(v.option_values, '{}'::jsonb),
              'price', spv.retail_price,
              'in_stock', (v.stock_quantity > 0),
              'image_url', case when v.variant_image_url ~* '^https://[^[:space:]]+$' then v.variant_image_url else null end
            ) order by v.created_at, v.id)
            from public.dropshipper_store_product_variants spv
            join public.product_variants v on v.id = spv.variant_id
            where spv.store_product_id = dsp.id
              and spv.enabled = true
              and v.product_id = p.id
              and v.is_enabled = true
          ), '[]'::jsonb)
        ) order by dsp.created_at desc
      )
      from public.dropshipper_store_products dsp
      join public.dropshipper_product_links l on l.id = dsp.product_link_id
      join public.supplier_products p on p.id = l.supplier_product_id
      join public.suppliers s on s.id = p.supplier_id
      where dsp.store_id = ds.id
        and dsp.is_published = true
        and dsp.content_reviewed_at is not null
        and l.status = 'active'
        and p.status = 'active'
        and p.admin_blocked = false
        and s.status = 'approved'
        and exists (
          select 1
          from public.dropshipper_store_product_variants selected_variant
          join public.product_variants available_variant on available_variant.id = selected_variant.variant_id
          where selected_variant.store_product_id = dsp.id
            and selected_variant.enabled = true
            and available_variant.product_id = p.id
            and available_variant.is_enabled = true
        )
    ), '[]'::jsonb)
  )
  from public.dropshipper_stores ds
  join public.dropshippers d on d.id = ds.dropshipper_id
  where ds.slug = lower(btrim(coalesce(_slug, '')))
    and ds.published = true
    and d.status = 'active'
  limit 1;
$function$;

revoke all on function public.public_dropshipper_store_by_slug(text) from public;
grant execute on function public.public_dropshipper_store_by_slug(text) to anon, authenticated;
