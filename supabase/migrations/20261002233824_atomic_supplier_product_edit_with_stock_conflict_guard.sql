create or replace function public.supplier_update_product_v3(
  _product_id uuid,
  _expected_product_updated_at timestamptz,
  _product jsonb,
  _variants jsonb
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  current_product public.supplier_products%rowtype;
  current_variant public.product_variants%rowtype;
  item jsonb;
  vid uuid;
  expected_variant_updated_at timestamptz;
  expected_stock integer;
  incoming_stock integer;
  incoming_cost numeric;
  incoming_retail numeric;
  incoming_weight integer;
  incoming_status public.product_status;
  incoming_cost_product numeric;
  incoming_retail_product numeric;
  incoming_category uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if _product_id is null or _product is null then
    raise exception 'Product data is required';
  end if;

  if jsonb_typeof(coalesce(_variants,'[]'::jsonb)) <> 'array' then
    raise exception 'Variants must be an array';
  end if;

  select *
  into current_product
  from public.supplier_products
  where id=_product_id
  for update;

  if not found then
    raise exception 'Product not found or access denied';
  end if;

  if _expected_product_updated_at is null
     or current_product.updated_at is distinct from _expected_product_updated_at then
    raise exception 'Product changed while you were editing. Refresh and try again.';
  end if;

  perform 1
  from public.product_variants
  where product_id=_product_id
  order by id
  for update;

  if (
    select count(*)
    from public.product_variants
    where product_id=_product_id
  ) <> jsonb_array_length(coalesce(_variants,'[]'::jsonb)) then
    raise exception 'Variants changed while you were editing. Refresh and try again.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(_variants,'[]'::jsonb))
  loop
    begin
      vid := (item->>'id')::uuid;
      expected_variant_updated_at := (item->>'expected_updated_at')::timestamptz;
      expected_stock := (item->>'expected_stock')::integer;
    exception when others then
      raise exception 'Invalid variant edit snapshot';
    end;

    select *
    into current_variant
    from public.product_variants
    where id=vid and product_id=_product_id;

    if not found then
      raise exception 'Variants changed while you were editing. Refresh and try again.';
    end if;

    if expected_variant_updated_at is null
       or current_variant.updated_at is distinct from expected_variant_updated_at
       or current_variant.stock_quantity is distinct from expected_stock then
      raise exception 'Inventory changed while you were editing. Nothing was saved. Refresh and try again.';
    end if;
  end loop;

  incoming_cost_product := nullif(_product->>'cost_price','')::numeric;
  incoming_retail_product := nullif(_product->>'suggested_retail_price','')::numeric;
  incoming_category := nullif(_product->>'category_id','')::uuid;
  incoming_status := coalesce(nullif(_product->>'status','')::public.product_status,current_product.status);

  if incoming_cost_product is null or incoming_cost_product < 0 then
    raise exception 'Supplier price must be 0 or more';
  end if;
  if incoming_retail_product is not null and incoming_retail_product < 0 then
    raise exception 'Suggested retail price must be 0 or more';
  end if;
  if coalesce(nullif(btrim(_product->>'sku'),''),'')='' then
    raise exception 'SKU is required';
  end if;
  if incoming_category is not null
     and not exists(select 1 from public.categories where id=incoming_category) then
    raise exception 'Category not found';
  end if;

  for item in select value from jsonb_array_elements(coalesce(_variants,'[]'::jsonb))
  loop
    incoming_stock := nullif(item->>'stock_quantity','')::integer;
    incoming_cost := nullif(item->>'cost_price','')::numeric;
    incoming_retail := nullif(item->>'suggested_retail_price','')::numeric;
    incoming_weight := nullif(item->>'weight_grams','')::integer;

    if incoming_stock is null or incoming_stock < 0 then
      raise exception 'Variant stock must be 0 or more';
    end if;
    if incoming_cost is not null and incoming_cost < 0 then
      raise exception 'Variant supplier price must be 0 or more';
    end if;
    if incoming_retail is not null and incoming_retail < 0 then
      raise exception 'Variant suggested retail price must be 0 or more';
    end if;
    if incoming_weight is not null and incoming_weight < 0 then
      raise exception 'Variant weight must be 0 or more';
    end if;
  end loop;

  update public.supplier_products
  set
    name_en=nullif(btrim(_product->>'name_en'),''),
    name_ar=nullif(btrim(_product->>'name_ar'),''),
    description_en=nullif(btrim(_product->>'description_en'),''),
    description_ar=nullif(btrim(_product->>'description_ar'),''),
    content_source_language=case when _product->>'content_source_language'='ar' then 'ar' else 'en' end,
    name=case
      when _product->>'content_source_language'='ar'
        then coalesce(nullif(btrim(_product->>'name_ar'),''),nullif(btrim(_product->>'name_en'),''))
      else coalesce(nullif(btrim(_product->>'name_en'),''),nullif(btrim(_product->>'name_ar'),''))
    end,
    description=case
      when _product->>'content_source_language'='ar'
        then coalesce(nullif(btrim(_product->>'description_ar'),''),nullif(btrim(_product->>'description_en'),''))
      else coalesce(nullif(btrim(_product->>'description_en'),''),nullif(btrim(_product->>'description_ar'),''))
    end,
    sku=upper(btrim(_product->>'sku')),
    cost_price=incoming_cost_product,
    category_id=incoming_category,
    suggested_retail_price=incoming_retail_product,
    status=incoming_status,
    updated_at=now()
  where id=_product_id;

  for item in select value from jsonb_array_elements(coalesce(_variants,'[]'::jsonb))
  loop
    vid := (item->>'id')::uuid;

    update public.product_variants
    set
      variant_name=coalesce(nullif(btrim(item->>'variant_name'),''),'Default'),
      sku=nullif(upper(btrim(item->>'sku')),''),
      stock_quantity=(item->>'stock_quantity')::integer,
      cost_price=nullif(item->>'cost_price','')::numeric,
      suggested_retail_price=nullif(item->>'suggested_retail_price','')::numeric,
      weight_grams=nullif(item->>'weight_grams','')::integer,
      variant_image_url=nullif(item->>'variant_image_url',''),
      is_enabled=coalesce((item->>'is_enabled')::boolean,true),
      updated_at=now()
    where id=vid and product_id=_product_id;
  end loop;
end;
$function$;

revoke all on function public.supplier_update_product_v3(uuid,timestamptz,jsonb,jsonb) from public,anon;
grant execute on function public.supplier_update_product_v3(uuid,timestamptz,jsonb,jsonb) to authenticated;
