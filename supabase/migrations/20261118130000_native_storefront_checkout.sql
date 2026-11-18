-- Native hosted storefront COD checkout. Staged for disposable-environment validation.
-- Does not change existing Shopify/WooCommerce or external storefront order flows.

begin;

create table if not exists private.native_storefront_order_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.dropshipper_stores(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(store_id,idempotency_key),
  check(length(idempotency_key) between 8 and 120),
  check(length(request_hash)=32)
);

alter table private.native_storefront_order_requests enable row level security;
revoke all on private.native_storefront_order_requests from public, anon, authenticated;
grant select,insert,update,delete on private.native_storefront_order_requests to service_role;

create or replace function public.native_storefront_create_order(
  _slug text,
  _variant_id uuid,
  _quantity integer,
  _customer_name text,
  _customer_phone text,
  _customer_email text,
  _shipping_address jsonb,
  _idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','pg_temp'
as $function$
declare
  store_key uuid;
  did uuid;
  pid uuid;
  sid uuid;
  existing_order uuid;
  saved_hash text;
  request_hash text;
  available integer;
  product_cost numeric;
  variant_cost numeric;
  retail numeric;
  currency_code text;
  commission numeric;
  delivery_fee numeric;
  courier_cost numeric;
  shipping_partner text;
  order_ref text;
  subtotal numeric;
  created_order uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if _quantity is null or _quantity<1 or _quantity>50 then
    raise exception 'Quantity must be between 1 and 50';
  end if;
  if _variant_id is null then raise exception 'Choose an available product option'; end if;
  if length(btrim(coalesce(_slug,'')))<2 or length(_slug)>100 then
    raise exception 'A valid store link is required';
  end if;
  if length(btrim(coalesce(_idempotency_key,'')))<8 or length(_idempotency_key)>120 then
    raise exception 'A valid order request key is required';
  end if;
  if length(btrim(coalesce(_customer_name,'')))<2 or length(_customer_name)>120
     or length(regexp_replace(coalesce(_customer_phone,''),'[^0-9+]','','g'))<8
     or length(_customer_phone)>40 then
    raise exception 'Customer name and a valid phone number are required';
  end if;
  if _customer_email is not null and (
     length(_customer_email)>254 or _customer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ) then raise exception 'Enter a valid email address or leave it blank'; end if;

  if _shipping_address is null or jsonb_typeof(_shipping_address)<>'object'
     or length(btrim(coalesce(_shipping_address->>'address1','')))<3
     or length(btrim(coalesce(_shipping_address->>'city','')))<2
     or not private.is_cairo_delivery_address(_shipping_address) then
    raise exception 'A complete Cairo delivery address is required at this time';
  end if;
  if length(_shipping_address::text)>2000 then raise exception 'Delivery address is too long'; end if;
  if nullif(btrim(coalesce(_shipping_address->>'map_url','')),'') is not null and (
    length(_shipping_address->>'map_url')>500 or
    (_shipping_address->>'map_url') !~* '^https://(maps\.app\.goo\.gl/|www\.google\.[^/]+/maps|maps\.google\.[^/]+/)'
  ) then raise exception 'Use a valid Google Maps link or leave the map link blank'; end if;

  select ds.id,d.id
  into store_key,did
  from public.dropshipper_stores ds
  join public.dropshippers d on d.id=ds.dropshipper_id
  where ds.slug=lower(btrim(_slug))
    and ds.published is true
    and ds.closed_at is null
    and d.status='active'
    and exists(
      select 1 from public.dropshipper_identity_verifications dv
      where dv.dropshipper_id=d.id and dv.review_status='approved'
    )
  limit 1;
  if store_key is null then raise exception 'This store is not available for ordering'; end if;

  request_hash:=md5(jsonb_build_object(
    'slug',lower(btrim(_slug)),'variant_id',_variant_id,'quantity',_quantity,
    'customer_name',btrim(_customer_name),'customer_phone',regexp_replace(_customer_phone,'[^0-9+]','','g'),
    'customer_email',nullif(lower(btrim(coalesce(_customer_email,''))),''),
    'shipping_address',_shipping_address
  )::text);

  insert into private.native_storefront_order_requests(store_id,idempotency_key,request_hash)
  values(store_key,btrim(_idempotency_key),request_hash)
  on conflict(store_id,idempotency_key) do nothing;

  select request_hash,order_id into saved_hash,existing_order
  from private.native_storefront_order_requests
  where store_id=store_key and idempotency_key=btrim(_idempotency_key)
  for update;

  if saved_hash is distinct from request_hash then
    raise exception 'This order request key was already used for different order details';
  end if;
  if existing_order is not null then
    return (
      select jsonb_build_object(
        'order_id',o.id,'reference',o.external_order_ref,'duplicate',true,
        'product_subtotal',o.product_subtotal_amount,'shipping_fee',o.shipping_fee_at_purchase,'total_amount',o.total_amount
      )
      from public.orders o where o.id=existing_order
    );
  end if;

  select
    p.id,p.supplier_id,p.cost_price,p.currency,
    coalesce(p.commission_rate_override,s.commission_rate_override,
      (select default_commission_rate from public.marketplace_settings where id=true),0),
    v.stock_quantity,v.cost_price,spv.retail_price
  into pid,sid,product_cost,currency_code,commission,available,variant_cost,retail
  from public.dropshipper_stores ds
  join public.dropshippers d on d.id=ds.dropshipper_id
  join public.dropshipper_store_products dsp on dsp.store_id=ds.id
  join public.dropshipper_product_links l on l.id=dsp.product_link_id
  join public.supplier_products p on p.id=l.supplier_product_id
  join public.suppliers s on s.id=p.supplier_id
  join public.dropshipper_store_product_variants spv on spv.store_product_id=dsp.id
  join public.product_variants v on v.id=spv.variant_id
  where ds.id=store_key and d.id=did
    and dsp.is_published is true
    and dsp.content_reviewed_at is not null
    and l.status='active'
    and p.status='active' and p.admin_blocked is false
    and s.status='approved'
    and spv.variant_id=_variant_id
    and spv.enabled is true and v.is_enabled is true
    and v.product_id=p.id
  for update of v;

  if pid is null then raise exception 'This product option is not available in this store'; end if;
  if available<_quantity then raise exception 'Not enough stock is available'; end if;
  if retail is null or retail<0 then raise exception 'This product option has no valid selling price'; end if;

  select customer_delivery_fee,internal_courier_cost,shipping_partner_name
  into delivery_fee,courier_cost,shipping_partner
  from public.shipping_settings
  where id=true and is_active is true and customer_delivery_fee is not null;
  if delivery_fee is null then raise exception 'Cairo delivery is not configured yet'; end if;

  update public.product_variants
  set stock_quantity=stock_quantity-_quantity,updated_at=now()
  where id=_variant_id;

  subtotal:=retail*_quantity;
  order_ref:='IZD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.orders(
    dropshipper_id,customer_name,customer_email,customer_phone,shipping_address,
    status,payment_status,currency,product_subtotal_amount,shipping_fee_at_purchase,
    total_amount,source,external_order_ref,payment_method
  ) values(
    did,btrim(_customer_name),nullif(lower(btrim(coalesce(_customer_email,''))),''),regexp_replace(_customer_phone,'[^0-9+]','','g'),
    _shipping_address,'pending','pending',currency_code,subtotal,delivery_fee,
    subtotal+delivery_fee,'storefront',order_ref,'cod'
  ) returning id into created_order;

  insert into public.order_items(
    order_id,supplier_id,supplier_product_id,variant_id,quantity,
    cost_price_at_purchase,retail_price_at_purchase,fulfillment_status,
    stock_reserved_quantity,commission_rate_at_purchase
  ) values(
    created_order,sid,pid,_variant_id,_quantity,coalesce(variant_cost,product_cost),
    retail,'unfulfilled',_quantity,commission
  );

  insert into public.order_shipping_costs(order_id,shipping_partner_name,courier_cost_at_purchase)
  values(created_order,shipping_partner,courier_cost);

  update private.native_storefront_order_requests
  set order_id=created_order
  where store_id=store_key and idempotency_key=btrim(_idempotency_key);

  return jsonb_build_object(
    'order_id',created_order,'reference',order_ref,'duplicate',false,
    'product_subtotal',subtotal,'shipping_fee',delivery_fee,'total_amount',subtotal+delivery_fee,
    'payment_method','cod'
  );
end;
$function$;

revoke all on function public.native_storefront_create_order(text,uuid,integer,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.native_storefront_create_order(text,uuid,integer,text,text,text,jsonb,text) to service_role;

-- Also prevent a non-verified dropshipper from exposing legacy stores through the public catalog.
create or replace function public.public_dropshipper_store_by_slug(_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','public','private','pg_temp'
as $function$
  select jsonb_build_object(
    'store',jsonb_build_object('id',ds.id,'store_name',ds.store_name,'slug',ds.slug,'description',ds.description,'logo_url',ds.logo_url),
    'products',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',dsp.id,
          'title',coalesce(nullif(btrim(dsp.title_override),''),nullif(btrim(p.name_en),''),p.name),
          'description',coalesce(dsp.description_override,''),
          'currency',p.currency,
          'images',coalesce((
            select jsonb_agg(to_jsonb(img.url) order by img.pos)
            from (
              select selected.value as url,selected.ordinality as pos
              from jsonb_array_elements_text(
                case when jsonb_array_length(dsp.selected_image_urls)>0 then dsp.selected_image_urls
                else coalesce((select jsonb_agg(pi.url order by pi.position,pi.created_at) from public.product_images pi where pi.product_id=p.id),'[]'::jsonb) end
              ) with ordinality as selected(value,ordinality)
              union all
              select custom.value as url,custom.ordinality+10000 as pos
              from jsonb_array_elements_text(dsp.custom_image_urls) with ordinality as custom(value,ordinality)
            ) img where img.url ~* '^https://[^[:space:]]+$'
          ),'[]'::jsonb),
          'variants',coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',v.id,'name',coalesce(nullif(btrim(v.variant_name),''),'Option'),
              'options',coalesce(v.option_values,'{}'::jsonb),'price',spv.retail_price,
              'in_stock',(v.stock_quantity>0),
              'image_url',case when v.variant_image_url ~* '^https://[^[:space:]]+$' then v.variant_image_url else null end
            ) order by v.created_at,v.id)
            from public.dropshipper_store_product_variants spv
            join public.product_variants v on v.id=spv.variant_id
            where spv.store_product_id=dsp.id and spv.enabled is true
              and v.product_id=p.id and v.is_enabled is true
          ),'[]'::jsonb)
        ) order by dsp.created_at desc
      )
      from public.dropshipper_store_products dsp
      join public.dropshipper_product_links l on l.id=dsp.product_link_id
      join public.supplier_products p on p.id=l.supplier_product_id
      join public.suppliers s on s.id=p.supplier_id
      where dsp.store_id=ds.id and dsp.is_published is true and dsp.content_reviewed_at is not null
        and l.status='active' and p.status='active' and p.admin_blocked is false and s.status='approved'
        and exists(
          select 1 from public.dropshipper_store_product_variants selected_variant
          join public.product_variants available_variant on available_variant.id=selected_variant.variant_id
          where selected_variant.store_product_id=dsp.id and selected_variant.enabled is true
            and available_variant.product_id=p.id and available_variant.is_enabled is true
        )
    ),'[]'::jsonb)
  )
  from public.dropshipper_stores ds
  join public.dropshippers d on d.id=ds.dropshipper_id
  where ds.slug=lower(btrim(coalesce(_slug,''))) and ds.published is true
    and ds.closed_at is null and d.status='active'
    and exists(
      select 1 from public.dropshipper_identity_verifications dv
      where dv.dropshipper_id=d.id and dv.review_status='approved'
    )
  limit 1;
$function$;

commit;
