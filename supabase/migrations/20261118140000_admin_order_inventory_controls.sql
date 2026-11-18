-- Audited order delivery edits and inventory adjustments for the Admin Control Center.
-- Staged only. Apply in a disposable Supabase environment before production.

begin;

create or replace function public.admin_update_order_shipping_details(
  _order_id uuid,
  _customer_name text,
  _customer_phone text,
  _customer_email text,
  _shipping_address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  old_row public.orders%rowtype;
  changed_fields text[]:='{}';
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _order_id is null then raise exception 'Order is required'; end if;
  if length(btrim(coalesce(_customer_name,'')))<2 or length(_customer_name)>120 then
    raise exception 'Customer name must be between 2 and 120 characters';
  end if;
  if length(regexp_replace(coalesce(_customer_phone,''),'[^0-9+]','','g'))<8 or length(_customer_phone)>40 then
    raise exception 'Enter a valid customer phone number';
  end if;
  if _customer_email is not null and (
    length(_customer_email)>254 or _customer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ) then raise exception 'Enter a valid customer email or leave it blank'; end if;
  if _shipping_address is null or jsonb_typeof(_shipping_address)<>'object'
     or length(_shipping_address::text)>2000
     or length(btrim(coalesce(_shipping_address->>'address1','')))<3
     or length(btrim(coalesce(_shipping_address->>'city','')))<2 then
    raise exception 'Enter a complete delivery address as a JSON object';
  end if;
  if nullif(btrim(coalesce(_shipping_address->>'map_url','')),'') is not null and (
    length(_shipping_address->>'map_url')>500 or
    (_shipping_address->>'map_url') !~* '^https://(maps\.app\.goo\.gl/|www\.google\.[^/]+/maps|maps\.google\.[^/]+/)'
  ) then raise exception 'Use a valid Google Maps link or leave it blank'; end if;

  select * into old_row from public.orders where id=_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if old_row.status not in ('pending','processing') then
    raise exception 'Delivery details can only be changed while an order is pending or processing';
  end if;

  if old_row.customer_name is distinct from btrim(_customer_name) then changed_fields:=array_append(changed_fields,'customer_name'); end if;
  if old_row.customer_phone is distinct from regexp_replace(_customer_phone,'[^0-9+]','','g') then changed_fields:=array_append(changed_fields,'customer_phone'); end if;
  if old_row.customer_email is distinct from nullif(lower(btrim(coalesce(_customer_email,''))),'') then changed_fields:=array_append(changed_fields,'customer_email'); end if;
  if old_row.shipping_address is distinct from _shipping_address then changed_fields:=array_append(changed_fields,'shipping_address'); end if;

  update public.orders
  set customer_name=btrim(_customer_name),
      customer_phone=regexp_replace(_customer_phone,'[^0-9+]','','g'),
      customer_email=nullif(lower(btrim(coalesce(_customer_email,''))),''),
      shipping_address=_shipping_address,
      updated_at=now()
  where id=_order_id;

  if cardinality(changed_fields)>0 then
    insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'admin_order_delivery_details_updated','orders',_order_id::text,
      jsonb_build_object('changed_fields',changed_fields,'order_ref',old_row.external_order_ref));
  end if;
  return jsonb_build_object('order_id',_order_id,'changed_fields',changed_fields);
end;
$function$;

revoke all on function public.admin_update_order_shipping_details(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.admin_update_order_shipping_details(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.admin_adjust_product_variant_stock(
  _variant_id uuid,
  _new_available_stock integer,
  _reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  old_row public.product_variants%rowtype;
  product_name text;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _new_available_stock is null or _new_available_stock<0 or _new_available_stock>1000000 then
    raise exception 'Available stock must be between 0 and 1,000,000';
  end if;
  if length(btrim(coalesce(_reason,'')))<8 or length(_reason)>500 then
    raise exception 'Enter a clear inventory adjustment reason (at least 8 characters)';
  end if;

  select * into old_row from public.product_variants where id=_variant_id for update;
  if not found then raise exception 'Product variant not found'; end if;
  select name into product_name from public.supplier_products where id=old_row.product_id;
  if old_row.stock_quantity is distinct from _new_available_stock then
    update public.product_variants
    set stock_quantity=_new_available_stock,updated_at=now()
    where id=_variant_id;

    insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'admin_variant_stock_adjusted','product_variants',_variant_id::text,
      jsonb_build_object(
        'supplier_product_id',old_row.product_id,
        'product_name',product_name,
        'variant_name',old_row.variant_name,
        'from_available_stock',old_row.stock_quantity,
        'to_available_stock',_new_available_stock,
        'reason',btrim(_reason)
      ));
  end if;

  return jsonb_build_object('variant_id',_variant_id,'available_stock',_new_available_stock,
    'previous_available_stock',old_row.stock_quantity,'updated',old_row.stock_quantity is distinct from _new_available_stock);
end;
$function$;

revoke all on function public.admin_adjust_product_variant_stock(uuid,integer,text) from public,anon;
grant execute on function public.admin_adjust_product_variant_stock(uuid,integer,text) to authenticated;

commit;
