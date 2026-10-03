create or replace function private.emit_izzy_inventory_alerts()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  total_stock integer;
  pid uuid;
  warning_level integer;
begin
  pid := coalesce(new.product_id, old.product_id);

  select
    coalesce(sum(v.stock_quantity) filter (where v.is_enabled),0)::int,
    s.low_stock_threshold
  into total_stock,warning_level
  from public.supplier_products p
  join public.suppliers s on s.id=p.supplier_id
  left join public.product_variants v on v.product_id=p.id
  where p.id=pid
  group by s.low_stock_threshold;

  warning_level:=coalesce(warning_level,5);

  insert into public.dropshipper_alerts(
    dropshipper_id,supplier_product_id,alert_type,title,message,metadata
  )
  select
    l.dropshipper_id,
    pid,
    case when total_stock=0 then 'out_of_stock' else 'low_stock' end,
    case when total_stock=0 then 'Product out of stock' else 'Low stock alert' end,
    p.name||
      case
        when total_stock=0 then ' is out of stock.'
        else ' has only '||total_stock||' sellable units left.'
      end,
    jsonb_build_object('stock',total_stock,'warning_level',warning_level,'sellable_stock',true)
  from public.dropshipper_product_links l
  join public.supplier_products p on p.id=l.supplier_product_id
  where l.supplier_product_id=pid
    and l.status='active'
    and l.alert_on_low_stock
    and total_stock<=warning_level
    and not exists (
      select 1
      from public.dropshipper_alerts a
      where a.dropshipper_id=l.dropshipper_id
        and a.supplier_product_id=pid
        and a.alert_type=case when total_stock=0 then 'out_of_stock' else 'low_stock' end
        and a.created_at>now()-interval '12 hours'
    );

  return new;
end;
$function$;

drop trigger if exists trg_izzy_inventory_alerts on public.product_variants;

create trigger trg_izzy_inventory_alerts
after insert or update of stock_quantity,is_enabled on public.product_variants
for each row
execute function private.emit_izzy_inventory_alerts();
