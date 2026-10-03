create table if not exists private.storefront_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.storefront_check_rate_limit(
  _token uuid,
  _client_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  key_value text;
  key_limit integer;
  row_window timestamptz;
  row_count integer;
  allowed boolean := true;
  retry_after integer := 0;
  max_retry integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if _token is null then
    raise exception 'Storefront token is required';
  end if;

  if nullif(btrim(_client_hash),'') is null
     or length(_client_hash) > 128 then
    raise exception 'Valid client fingerprint is required';
  end if;

  for key_value,key_limit in
    select 'client:'||_token::text||':'||btrim(_client_hash), 20
    union all
    select 'integration:'||_token::text, 100
  loop
    insert into private.storefront_rate_limits(
      rate_key,window_started_at,request_count,updated_at
    )
    values(key_value,now(),1,now())
    on conflict(rate_key) do update
    set
      window_started_at=case
        when private.storefront_rate_limits.window_started_at <= now()-interval '10 minutes'
          then now()
        else private.storefront_rate_limits.window_started_at
      end,
      request_count=case
        when private.storefront_rate_limits.window_started_at <= now()-interval '10 minutes'
          then 1
        else private.storefront_rate_limits.request_count+1
      end,
      updated_at=now()
    returning window_started_at,request_count
    into row_window,row_count;

    if row_count > key_limit then
      allowed:=false;
      retry_after:=greatest(
        1,
        ceil(extract(epoch from (row_window+interval '10 minutes'-now())))::integer
      );
      max_retry:=greatest(max_retry,retry_after);
    end if;
  end loop;

  return jsonb_build_object(
    'allowed',allowed,
    'retry_after_seconds',max_retry
  );
end;
$function$;

revoke all on function public.storefront_check_rate_limit(uuid,text) from public,anon,authenticated;
grant execute on function public.storefront_check_rate_limit(uuid,text) to service_role;
