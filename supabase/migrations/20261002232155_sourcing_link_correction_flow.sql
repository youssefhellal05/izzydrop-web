create or replace function private.sourcing_notify(_id uuid, _type text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.dropshipper_alerts(
    dropshipper_id,
    supplier_product_id,
    alert_type,
    title,
    message,
    metadata,
    sourcing_response_id
  )
  select
    d.id,
    o.catalog_product_id,
    _type,
    case
      when _type='sourcing_available' then 'Sourced product is available to sell'
      else 'Your requested product has been sourced'
    end,
    'A supplier sourced ' || r.title || '. It is now available in Products.',
    jsonb_build_object(
      'request_id',r.id,
      'response_id',o.id,
      'view','sourced',
      'catalog_product_id',o.catalog_product_id
    ),
    o.id
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
    and _type='sourcing_available'
    and private.sourcing_catalog_product(o.catalog_product_id) is not null
  on conflict(dropshipper_id,sourcing_response_id,alert_type)
  where sourcing_response_id is not null
  do update set
    supplier_product_id=excluded.supplier_product_id,
    title=case
      when public.dropshipper_alerts.supplier_product_id is distinct from excluded.supplier_product_id
        then 'Sourced product link updated'
      else excluded.title
    end,
    message=excluded.message,
    metadata=excluded.metadata,
    read_at=case
      when public.dropshipper_alerts.supplier_product_id is distinct from excluded.supplier_product_id
        then null
      else public.dropshipper_alerts.read_at
    end,
    created_at=case
      when public.dropshipper_alerts.supplier_product_id is distinct from excluded.supplier_product_id
        then now()
      else public.dropshipper_alerts.created_at
    end;
end;
$function$;

create or replace function private.sourcing_link_catalog(_response_id uuid, _product_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  sid uuid:=private.sourcing_supplier();
  o public.sourcing_responses;
  rid uuid;
begin
  if sid is null then raise exception 'Approved supplier required'; end if;

  select request_id into rid
  from public.sourcing_responses
  where id=_response_id and supplier_id=sid;

  if rid is null then raise exception 'Your sourcing response is required'; end if;

  perform 1
  from public.product_requests
  where id=rid and status in ('open','sourcing','sourced')
  for update;

  if not found then raise exception 'Request is closed or unavailable'; end if;

  select *
  into o
  from public.sourcing_responses
  where id=_response_id and supplier_id=sid
  for update;

  if o.status not in ('sourcing','sourced') then
    raise exception 'Start sourcing first';
  end if;

  if _product_id is null then
    raise exception 'Choose your published product';
  end if;

  perform 1
  from public.supplier_products
  where id=_product_id and supplier_id=sid and status='active'
  for share;

  if not found then
    raise exception 'Choose your own active published product';
  end if;

  perform 1
  from public.product_variants
  where product_id=_product_id and is_enabled
  for share;

  if private.sourcing_catalog_product(_product_id) is null then
    raise exception 'Product requires valid enabled variants';
  end if;

  if o.catalog_product_id=_product_id and o.status='sourced' then
    return;
  end if;

  update public.sourcing_responses
  set
    status='sourced',
    catalog_product_id=_product_id,
    sourced_at=coalesce(sourced_at,now()),
    updated_at=now()
  where id=_response_id;

  perform private.sourcing_sync_request(rid);
  perform private.sourcing_notify(_response_id,'sourcing_available');
end;
$function$;
