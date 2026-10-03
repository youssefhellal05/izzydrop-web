alter table public.dropshipper_alerts
  drop constraint if exists dropshipper_alerts_alert_type_check;

alter table public.dropshipper_alerts
  add constraint dropshipper_alerts_alert_type_check
  check (alert_type in (
    'low_stock',
    'out_of_stock',
    'price_change',
    'sourcing_sourced',
    'sourcing_available',
    'sourcing_updated'
  ));

create or replace function private.sourcing_notify(_id uuid, _type text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  rec record;
  latest_product uuid;
  has_prior boolean;
begin
  for rec in
    select
      d.id as dropshipper_id,
      o.catalog_product_id,
      o.id as response_id,
      r.id as request_id,
      r.title
    from public.sourcing_responses o
    join public.product_requests r on r.id=o.request_id
    join public.dropshippers d
      on d.status='active'
     and (
       d.id=r.dropshipper_id
       or exists(
         select 1
         from public.sourcing_request_interests i
         where i.request_id=r.id and i.dropshipper_id=d.id
       )
       or exists(
         select 1
         from public.sourcing_response_interests i
         where i.response_id=o.id and i.dropshipper_id=d.id
       )
     )
    where o.id=_id
      and o.status='sourced'
      and private.sourcing_supplier_approved(o.supplier_id)
      and private.sourcing_catalog_product(o.catalog_product_id) is not null
  loop
    if _type='sourcing_available' then
      latest_product:=null;
      has_prior:=false;

      select a.supplier_product_id
      into latest_product
      from public.dropshipper_alerts a
      where a.dropshipper_id=rec.dropshipper_id
        and a.sourcing_response_id=rec.response_id
        and a.alert_type in ('sourcing_available','sourcing_updated')
      order by a.created_at desc,a.id desc
      limit 1;

      has_prior:=found;

      if not has_prior then
        insert into public.dropshipper_alerts(
          dropshipper_id,
          supplier_product_id,
          alert_type,
          title,
          message,
          metadata,
          sourcing_response_id
        )
        values(
          rec.dropshipper_id,
          rec.catalog_product_id,
          'sourcing_available',
          'Sourced product is available to sell',
          'A supplier sourced ' || rec.title || '. It is now available in Products.',
          jsonb_build_object(
            'request_id',rec.request_id,
            'response_id',rec.response_id,
            'view','sourced',
            'catalog_product_id',rec.catalog_product_id
          ),
          rec.response_id
        )
        on conflict(dropshipper_id,sourcing_response_id,alert_type)
        where sourcing_response_id is not null
        do nothing;

      elsif latest_product is distinct from rec.catalog_product_id then
        delete from public.dropshipper_alerts
        where dropshipper_id=rec.dropshipper_id
          and sourcing_response_id=rec.response_id
          and alert_type='sourcing_updated';

        insert into public.dropshipper_alerts(
          dropshipper_id,
          supplier_product_id,
          alert_type,
          title,
          message,
          metadata,
          sourcing_response_id
        )
        values(
          rec.dropshipper_id,
          rec.catalog_product_id,
          'sourcing_updated',
          'Sourced product link updated',
          'A supplier corrected the sourced product for ' || rec.title || '. Open the updated product.',
          jsonb_build_object(
            'request_id',rec.request_id,
            'response_id',rec.response_id,
            'view','sourced',
            'catalog_product_id',rec.catalog_product_id,
            'corrected',true
          ),
          rec.response_id
        );
      end if;

    else
      insert into public.dropshipper_alerts(
        dropshipper_id,
        supplier_product_id,
        alert_type,
        title,
        message,
        metadata,
        sourcing_response_id
      )
      values(
        rec.dropshipper_id,
        rec.catalog_product_id,
        _type,
        case
          when _type='sourcing_sourced' then 'Your requested product has been sourced'
          else 'Sourcing update'
        end,
        'A supplier sourced ' || rec.title || '. It is now available in Products.',
        jsonb_build_object(
          'request_id',rec.request_id,
          'response_id',rec.response_id,
          'view','sourced',
          'catalog_product_id',rec.catalog_product_id
        ),
        rec.response_id
      )
      on conflict(dropshipper_id,sourcing_response_id,alert_type)
      where sourcing_response_id is not null
      do nothing;
    end if;
  end loop;
end;
$function$;
