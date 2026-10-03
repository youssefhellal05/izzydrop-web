create or replace function public.dropshipper_alert_metrics()
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'unread_count', count(*) filter (where a.read_at is null),
    'total_count', count(*)
  )
  from public.dropshipper_alerts a;
$function$;

revoke all on function public.dropshipper_alert_metrics() from public,anon;
grant execute on function public.dropshipper_alert_metrics() to authenticated;
