create or replace function public.supplier_create_product_v2(
  _name_en text default null::text,
  _name_ar text default null::text,
  _description_en text default null::text,
  _description_ar text default null::text,
  _source_language text default 'en'::text,
  _sku text default null::text,
  _cost numeric default 0,
  _retail numeric default null::numeric,
  _currency text default 'EGP'::text,
  _variants jsonb default '[]'::jsonb,
  _category_id uuid default null::uuid,
  _shipping_cost numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  sid uuid;
  pid uuid;
  vid uuid;
  base_sku text;
  canonical_name text;
  canonical_description text;
  item jsonb;
  idx integer := 0;
  variant_name text;
  variant_sku text;
  variant_cost numeric;
  variant_retail numeric;
  variant_stock integer;
  variant_weight integer;
  variant_enabled boolean;
  variant_options jsonb;
  variant_count integer := 0;
  created_variants jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select s.id into sid
  from public.suppliers s
  where s.profile_id=auth.uid() and s.status='approved'
  limit 1;
  if sid is null then raise exception 'Approved supplier profile not found'; end if;

  if _source_language not in ('en','ar') then raise exception 'Source language must be en or ar'; end if;
  if _category_id is not null and not exists(select 1 from public.categories where id=_category_id) then
    raise exception 'Category not found';
  end if;
  if _shipping_cost is null or _shipping_cost < 0 then raise exception 'Estimated shipping cost must be 0 or more'; end if;

  canonical_name :=
    case when _source_language='ar'
      then coalesce(nullif(btrim(_name_ar),''),nullif(btrim(_name_en),''))
      else coalesce(nullif(btrim(_name_en),''),nullif(btrim(_name_ar),''))
    end;
  canonical_description :=
    case when _source_language='ar'
      then coalesce(nullif(btrim(_description_ar),''),nullif(btrim(_description_en),''))
      else coalesce(nullif(btrim(_description_en),''),nullif(btrim(_description_ar),''))
    end;

  if canonical_name is null then raise exception 'Product name is required in at least one language'; end if;
  if _cost is null or _cost < 0 then raise exception 'Supplier price must be 0 or more'; end if;
  if _retail is not null and _retail < 0 then raise exception 'Suggested retail price must be 0 or more'; end if;

  base_sku := upper(nullif(btrim(_sku),''));
  if base_sku is null then
    loop
      base_sku := 'IZ-' || upper(substr(md5(gen_random_uuid()::text),1,10));
      exit when not exists (
        select 1 from public.supplier_products where supplier_id=sid and sku=base_sku
      );
    end loop;
  elsif exists (
    select 1 from public.supplier_products where supplier_id=sid and sku=base_sku
  ) then
    raise exception 'You already have a product with this SKU';
  end if;

  insert into public.supplier_products(
    supplier_id,category_id,name,description,sku,cost_price,suggested_retail_price,currency,status,
    name_en,name_ar,description_en,description_ar,content_source_language,estimated_shipping_cost
  ) values (
    sid,_category_id,canonical_name,canonical_description,base_sku,_cost,_retail,
    coalesce(nullif(upper(btrim(_currency)),''),'EGP'),'inactive',
    nullif(btrim(_name_en),''),nullif(btrim(_name_ar),''),
    nullif(btrim(_description_en),''),nullif(btrim(_description_ar),''),
    _source_language,_shipping_cost
  ) returning id into pid;

  if jsonb_typeof(coalesce(_variants,'[]'::jsonb))='array' then
    for item in select value from jsonb_array_elements(coalesce(_variants,'[]'::jsonb))
    loop
      idx := idx + 1;
      variant_name := coalesce(nullif(btrim(item->>'name'),''), case when idx=1 then 'Default' else 'Variant '||idx end);
      variant_sku := upper(nullif(btrim(item->>'sku'),''));
      if variant_sku is null then variant_sku := base_sku || '-' || lpad(idx::text,2,'0'); end if;
      variant_cost := coalesce(nullif(item->>'cost','')::numeric,_cost);
      variant_retail := coalesce(nullif(item->>'retail','')::numeric,_retail);
      variant_stock := coalesce(nullif(item->>'stock','')::integer,0);
      variant_weight := nullif(item->>'weight_grams','')::integer;
      variant_enabled := coalesce(nullif(item->>'enabled','')::boolean,true);
      variant_options := case when jsonb_typeof(item->'options')='object' then item->'options' else '{}'::jsonb end;

      if variant_cost < 0 then raise exception 'Variant supplier price must be 0 or more'; end if;
      if variant_retail is not null and variant_retail < 0 then raise exception 'Variant suggested retail price must be 0 or more'; end if;
      if variant_stock < 0 then raise exception 'Variant stock must be 0 or more'; end if;

      insert into public.product_variants(
        product_id,variant_name,sku,cost_price,suggested_retail_price,stock_quantity,weight_grams,option_values,is_enabled
      ) values (
        pid,variant_name,variant_sku,variant_cost,variant_retail,variant_stock,variant_weight,variant_options,variant_enabled
      ) returning id into vid;

      created_variants := created_variants || jsonb_build_array(jsonb_build_object(
        'id',vid,'index',idx-1,'sku',variant_sku,'options',variant_options
      ));
      variant_count := variant_count + 1;
    end loop;
  end if;

  if variant_count=0 then
    insert into public.product_variants(
      product_id,variant_name,sku,cost_price,suggested_retail_price,stock_quantity,option_values,is_enabled
    ) values (pid,'Default',base_sku||'-01',_cost,_retail,0,'{}'::jsonb,true)
    returning id into vid;
    created_variants := jsonb_build_array(jsonb_build_object('id',vid,'index',0,'sku',base_sku||'-01','options','{}'::jsonb));
    variant_count := 1;
  end if;

  return jsonb_build_object(
    'product_id',pid,'sku',base_sku,'status','inactive','variant_count',variant_count,'variants',created_variants
  );
end;
$function$;
