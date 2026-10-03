create or replace function public.admin_confirm_cod_remittance(
  _order_id uuid,
  _remitted_amount numeric default null,
  _courier_cost numeric default null,
  _resolution_reason text default null,
  _reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  o public.orders%rowtype;
  os public.order_settlements%rowtype;
  a numeric;
  st text;
  partner text;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _remitted_amount is not null and _remitted_amount<0 then raise exception 'Remitted amount cannot be negative'; end if;
  if _courier_cost is not null and _courier_cost<0 then raise exception 'Courier cost cannot be negative'; end if;
  if nullif(btrim(_reference),'') is null then raise exception 'A remittance reference is required'; end if;

  perform public.sync_order_financials(_order_id);

  select * into o from public.orders where id=_order_id for update;
  select * into os from public.order_settlements where order_id=_order_id for update;

  if o.status<>'delivered' or o.payment_status<>'paid' or os.settlement_status<>'ready' then
    raise exception 'Only delivered, paid COD orders can be remitted';
  end if;

  if os.cod_remittance_status in ('remitted','disputed','reversal_required','reversed') then
    raise exception 'COD remittance already resolved';
  end if;

  a:=coalesce(_remitted_amount,o.total_amount);
  if os.cod_remitted_amount is not null and a=os.cod_remitted_amount then
    raise exception 'This remittance amount was already recorded';
  end if;

  st:=case
    when a<=0 then 'not_remitted'
    when a<coalesce(os.expected_cod_amount,o.total_amount) then 'partial'
    else 'remitted'
  end;

  if st<>'remitted' and nullif(btrim(_resolution_reason),'') is null then
    raise exception 'A discrepancy reason is required';
  end if;

  select shipping_partner_name into partner
  from public.shipping_settings
  where id=true;

  insert into public.order_shipping_costs(
    order_id,shipping_partner_name,courier_cost_at_purchase,created_at
  )
  values(_order_id,partner,_courier_cost,now())
  on conflict(order_id) do update
  set shipping_partner_name=coalesce(public.order_shipping_costs.shipping_partner_name,excluded.shipping_partner_name),
      courier_cost_at_purchase=coalesce(excluded.courier_cost_at_purchase,public.order_shipping_costs.courier_cost_at_purchase);

  update public.order_settlements
  set cod_remittance_status=st,
      cod_remitted_amount=a,
      cod_remitted_at=case when st='remitted' then now() else null end,
      remittance_difference=coalesce(os.expected_cod_amount,o.total_amount)-a,
      remittance_reference=btrim(_reference),
      remittance_note=nullif(btrim(_resolution_reason),''),
      courier_cost_amount=coalesce(_courier_cost,courier_cost_amount),
      shipping_margin_amount=case
        when coalesce(_courier_cost,courier_cost_amount) is null then null
        else customer_shipping_fee_amount-coalesce(_courier_cost,courier_cost_amount)
      end,
      updated_at=now()
  where order_id=_order_id;

  if st='remitted' then
    update public.order_item_settlements
    set supplier_payout_status=case when supplier_payout_status='paid' then 'paid' else 'pending' end,
        dropshipper_payout_status=case when dropshipper_payout_status='paid' then 'paid' else 'pending' end,
        updated_at=now()
    where order_id=_order_id and settlement_status='ready';
  end if;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(
    auth.uid(),
    'cod_remittance_recorded',
    'orders',
    _order_id::text,
    jsonb_build_object(
      'expected',os.expected_cod_amount,
      'remitted',a,
      'difference',coalesce(os.expected_cod_amount,o.total_amount)-a,
      'status',st,
      'reason',_resolution_reason,
      'reference',_reference
    )
  );

  return jsonb_build_object(
    'order_id',_order_id,
    'cod_remittance_status',st,
    'expected_cod_amount',os.expected_cod_amount,
    'cod_remitted_amount',a,
    'remittance_difference',coalesce(os.expected_cod_amount,o.total_amount)-a,
    'payout_eligible',st='remitted',
    'reference',btrim(_reference)
  );
end;
$function$;

revoke execute on function public.admin_mark_supplier_payout_paid(uuid) from authenticated;
revoke execute on function public.admin_mark_dropshipper_payout_paid(uuid) from authenticated;
revoke execute on function public.admin_mark_supplier_payout_paid(uuid) from anon;
revoke execute on function public.admin_mark_dropshipper_payout_paid(uuid) from anon;
revoke execute on function public.admin_mark_supplier_payout_paid(uuid) from public;
revoke execute on function public.admin_mark_dropshipper_payout_paid(uuid) from public;
