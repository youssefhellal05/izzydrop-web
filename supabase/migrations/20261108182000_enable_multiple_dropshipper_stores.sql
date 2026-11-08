-- Enable multiple independent native storefronts per dropshipper.
-- Store products and designs are already scoped to store_id; the owner-level
-- unique constraint was the only one-store-per-account restriction.
alter table public.dropshipper_stores
  drop constraint if exists dropshipper_stores_dropshipper_id_key;

alter table public.dropshipper_stores
  add column if not exists closed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.dropshipper_stores'::regclass
      and conname = 'dropshipper_stores_closed_not_published'
  ) then
    alter table public.dropshipper_stores
      add constraint dropshipper_stores_closed_not_published
      check (closed_at is null or published is false);
  end if;
end $$;

alter table public.dropshipper_stores
  drop constraint if exists dropshipper_stores_slug_reserved;

alter table public.dropshipper_stores
  add constraint dropshipper_stores_slug_reserved check (
    slug not in (
      'admin','app','api','assets','auth','login','logout','products','product','settings',
      'store','storefront','store-manager','store-design','my-stores','store-create',
      'store-dashboard','supplier','suppliers','checkout','orders','help','about'
    )
  );

create index if not exists idx_dropshipper_stores_owner_created
  on public.dropshipper_stores (dropshipper_id, created_at desc);

create or replace function private.is_published_dropshipper_store(_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dropshipper_stores s
    where s.id = _store_id
      and s.published is true
      and s.closed_at is null
  );
$$;

revoke all on function private.is_published_dropshipper_store(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_published_dropshipper_store(uuid) to anon, authenticated;

create or replace function public.public_dropshipper_store_by_slug(_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private', 'pg_temp'
as $function$
  select jsonb_build_object(
    'store', jsonb_build_object(
      'id', ds.id,
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
    and ds.published is true
    and ds.closed_at is null
    and d.status = 'active'
  limit 1;
$function$;
