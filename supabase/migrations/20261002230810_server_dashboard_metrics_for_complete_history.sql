create or replace function public.supplier_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private'
as $function$
declare
  sid uuid;
  result jsonb;
  cairo_today date := (now() at time zone 'Africa/Cairo')::date;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select s.id into sid
  from public.suppliers s
  where s.profile_id=auth.uid() and s.status='approved'
  limit 1;

  if sid is null then raise exception 'Approved supplier profile not found'; end if;

  select jsonb_build_object(
    'new_items', count(*) filter (
      where i.fulfillment_status not in ('fulfilled','cancelled')
        and o.status <> 'processing'
    ),
    'open_items', count(*) filter (
      where i.fulfillment_status not in ('fulfilled','cancelled')
    ),
    'orders_received_today', count(distinct o.id) filter (
      where (o.created_at at time zone 'Africa/Cairo')::date=cairo_today
    ),
    'units_ordered_today', coalesce(sum(i.quantity) filter (
      where (i.created_at at time zone 'Africa/Cairo')::date=cairo_today
    ),0),
    'items_shipped_today', count(*) filter (
      where i.fulfillment_status='fulfilled'
        and (coalesce(i.updated_at,i.created_at) at time zone 'Africa/Cairo')::date=cairo_today
    ),
    'total_orders', count(distinct o.id),
    'date_scope','Africa/Cairo',
    'today',cairo_today
  )
  into result
  from public.order_items i
  join public.orders o on o.id=i.order_id
  where i.supplier_id=sid;

  return coalesce(result,jsonb_build_object(
    'new_items',0,
    'open_items',0,
    'orders_received_today',0,
    'units_ordered_today',0,
    'items_shipped_today',0,
    'total_orders',0,
    'date_scope','Africa/Cairo',
    'today',cairo_today
  ));
end;
$function$;

create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private'
as $function$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'total_orders',count(*),
    'open_orders',count(*) filter (where status in ('pending','processing','shipped','in_transit')),
    'delivered_orders',count(*) filter (where status='delivered')
  )
  into result
  from public.orders;

  return coalesce(result,jsonb_build_object('total_orders',0,'open_orders',0,'delivered_orders',0));
end;
$function$;

revoke all on function public.supplier_dashboard_metrics() from public,anon;
grant execute on function public.supplier_dashboard_metrics() to authenticated;

revoke all on function public.admin_dashboard_metrics() from public,anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;
