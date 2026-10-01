create or replace function public.configure_storefront_integration(
  _product_id uuid,
  _website_url text,
  _retail_price numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  did uuid; lid uuid; iid uuid; tok uuid; slug text; current_retail numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if nullif(btrim(_website_url),'') is null or _website_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'Enter a valid website URL beginning with http:// or https://';
  end if;
  if _retail_price is not null and _retail_price < 0 then raise exception 'Selling price must be 0 or more'; end if;
  select id into did from public.dropshippers where profile_id=auth.uid() and status='active' limit 1;
  if did is null then raise exception 'Active dropshipper profile not found'; end if;
  if not exists (
    select 1 from public.supplier_products p
    join public.suppliers s on s.id=p.supplier_id
    where p.id=_product_id and p.status='active' and not p.admin_blocked and s.status='approved'
  ) then raise exception 'Product is not available'; end if;
  select id into lid from public.dropshipper_product_links
  where dropshipper_id=did and supplier_product_id=_product_id limit 1;
  if lid is null then
    insert into public.dropshipper_product_links(
      dropshipper_id,supplier_product_id,retail_price,pricing_mode,status,synced_at
    ) values(did,_product_id,_retail_price,
      case when _retail_price is null then 'follow_suggestions' else 'custom' end,
      'active',now()) returning id into lid;
  else
    update public.dropshipper_product_links
    set retail_price=case when _retail_price is null then retail_price else _retail_price end,
        pricing_mode=case when _retail_price is null then pricing_mode else 'custom' end,
        status='active',synced_at=now(),updated_at=now()
    where id=lid;
  end if;
  insert into public.storefront_integrations(link_id,website_url,enabled)
  values(lid,btrim(_website_url),true)
  on conflict (link_id) do update set website_url=excluded.website_url,enabled=true,updated_at=now()
  returning id,public_token into iid,tok;
  select p.public_slug,
    case when coalesce(l.pricing_mode,'custom')='custom' and l.retail_price is not null
      then l.retail_price else p.suggested_retail_price end
  into slug,current_retail
  from public.dropshipper_product_links l
  join public.supplier_products p on p.id=l.supplier_product_id
  where l.id=lid;
  return jsonb_build_object(
    'integration_id',iid,'link_id',lid,'public_token',tok,
    'website_url',btrim(_website_url),'product_id',_product_id,
    'public_slug',slug,'retail_price',current_retail
  );
end;
$function$;
