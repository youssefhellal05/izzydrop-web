create or replace function private.sourcing_set_interest(
  _request_id uuid default null,
  _response_id uuid default null,
  _interested boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  did uuid:=private.sourcing_dropshipper();
  rid uuid;
  response_count integer:=0;
  request_count integer:=0;
begin
  if did is null then raise exception 'Active dropshipper required'; end if;
  if (_request_id is null)=(_response_id is null) then
    raise exception 'Choose one request or sourced offer';
  end if;

  if _response_id is not null then
    select o.request_id
    into rid
    from public.sourcing_responses o
    where o.id=_response_id;

    if rid is null then raise exception 'Sourced offer unavailable'; end if;

    if _interested then
      perform 1
      from public.sourcing_responses o
      where o.id=_response_id
        and o.status='sourced'
        and private.sourcing_supplier_approved(o.supplier_id);
      if not found then raise exception 'Sourced offer unavailable'; end if;

      perform 1
      from public.product_requests
      where id=rid and status not in ('closed','archived')
      for update;
      if not found then raise exception 'Request is closed or unavailable'; end if;

      insert into public.sourcing_request_interests(request_id,dropshipper_id)
      values(rid,did)
      on conflict do nothing;

      insert into public.sourcing_response_interests(response_id,dropshipper_id)
      values(_response_id,did)
      on conflict do nothing;
    else
      delete from public.sourcing_response_interests
      where response_id=_response_id and dropshipper_id=did;
    end if;
  else
    rid:=_request_id;

    perform 1
    from public.product_requests
    where id=rid
      and (_interested=false or status not in ('closed','archived'))
    for update;
    if not found then
      if _interested then raise exception 'Request is closed or unavailable';
      else raise exception 'Request unavailable';
      end if;
    end if;

    if _interested then
      insert into public.sourcing_request_interests(request_id,dropshipper_id)
      values(rid,did)
      on conflict do nothing;
    else
      delete from public.sourcing_response_interests sri
      using public.sourcing_responses sr
      where sri.response_id=sr.id
        and sr.request_id=rid
        and sri.dropshipper_id=did;

      delete from public.sourcing_request_interests
      where request_id=rid and dropshipper_id=did;
    end if;
  end if;

  select count(*) into request_count
  from public.sourcing_request_interests
  where request_id=rid;

  if _response_id is not null then
    select count(*) into response_count
    from public.sourcing_response_interests
    where response_id=_response_id;
  end if;

  return jsonb_build_object(
    'request_id',rid,
    'response_id',_response_id,
    'interested',_interested,
    'request_interest_count',request_count,
    'response_interest_count',response_count
  );
end;
$function$;

create or replace function public.sourcing_set_interest(
  _request_id uuid default null,
  _response_id uuid default null,
  _interested boolean default true
)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.sourcing_set_interest(_request_id,_response_id,_interested);
$function$;

revoke all on function public.sourcing_set_interest(uuid,uuid,boolean) from public,anon;
grant execute on function public.sourcing_set_interest(uuid,uuid,boolean) to authenticated;
