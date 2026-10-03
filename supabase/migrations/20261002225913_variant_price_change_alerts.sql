create or replace function private.emit_izzy_variant_price_alerts()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  product_name text;
  currency_code text;
  variant_text text;
begin
  if old.cost_price is not distinct from new.cost_price then
    return new;
  end if;

  select p.name,p.currency
    into product_name,currency_code
  from public.supplier_products p
  where p.id=new.product_id;

  variant_text := coalesce(
    nullif(btrim(new.variant_name),''),
    nullif(btrim(new.sku),''),
    'Variant'
  );

  insert into public.dropshipper_alerts(
    dropshipper_id,
    supplier_product_id,
    alert_type,
    title,
    message,
    metadata
  )
  select
    l.dropshipper_id,
    new.product_id,
    'price_change',
    'Supplier price changed',
    coalesce(product_name,'Product') || ' — ' || variant_text ||
      ' cost changed from ' || old.cost_price || ' to ' || new.cost_price ||
      ' ' || coalesce(currency_code,'EGP') || '.',
    jsonb_build_object(
      'variant_id',new.id,
      'variant_name',new.variant_name,
      'variant_sku',new.sku,
      'old_cost',old.cost_price,
      'new_cost',new.cost_price,
      'currency',coalesce(currency_code,'EGP')
    )
  from public.dropshipper_product_links l
  where l.supplier_product_id=new.product_id
    and l.status='active'
    and l.alert_on_price_change;

  return new;
end;
$function$;

drop trigger if exists trg_izzy_variant_price_alerts on public.product_variants;

create trigger trg_izzy_variant_price_alerts
after update of cost_price on public.product_variants
for each row
execute function private.emit_izzy_variant_price_alerts();
