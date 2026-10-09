begin;

-- Versioned payouts keep the old RPCs available for any cached clients.
create or replace function public.dropshipper_settlements_v2()
returns setof jsonb language sql stable security definer set search_path='public','private'
as $$
  select jsonb_build_object(
    'order_id',o.id,'external_order_ref',o.external_order_ref,
    'order_status',o.status,'payment_status',o.payment_status,
    'settlement_status',s.settlement_status,'currency',s.currency,
    'retail_amount',s.retail_amount,'supplier_gross_amount',s.supplier_gross_amount,
    'dropshipper_fee_amount',s.dropshipper_fee_amount,
    'dropshipper_fee_rate',s.dropshipper_fee_rate,
    'dropshipper_profit_amount',s.dropshipper_profit_amount,
    'payout_status',s.dropshipper_payout_status,'created_at',o.created_at
  )
  from public.order_item_settlements s
  join public.orders o on o.id=s.order_id
  join public.dropshippers d on d.id=s.dropshipper_id
  where d.profile_id=auth.uid()
  order by o.created_at desc;
$$;

create or replace function public.admin_settlements_v2()
returns setof jsonb language plpgsql stable security definer set search_path='public','private'
as $$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role)
    then raise exception 'Admin access required'; end if;
  return query
    select to_jsonb(a) || jsonb_build_object(
      'dropshipper_fee_amount',i.dropshipper_fee_amount,
      'total_izzydrop_fee_amount',a.platform_commission_amount+i.dropshipper_fee_amount
    )
    from public.admin_settlements() a
    join public.order_item_settlements i on i.order_item_id=a.order_item_id;
end; $$;

revoke all on function public.dropshipper_settlements_v2() from public,anon;
grant execute on function public.dropshipper_settlements_v2() to authenticated,service_role;
revoke all on function public.admin_settlements_v2() from public,anon;
grant execute on function public.admin_settlements_v2() to authenticated,service_role;

commit;