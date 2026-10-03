create or replace function public.sync_order_financials(_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  o public.orders%rowtype;
  os public.order_settlements%rowtype;
  v_status text;
  v_courier numeric;
  v_ship numeric;
  v_collected numeric:=0;
  v_refunded numeric:=0;
  v_remit text;
begin
  select * into o
  from public.orders
  where id=_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;

  if auth.uid() is null or not (
    private.has_role(auth.uid(),'admin'::public.app_role)
    or exists(
      select 1 from public.dropshippers d
      where d.id=o.dropshipper_id and d.profile_id=auth.uid()
    )
    or exists(
      select 1
      from public.order_items oi
      join public.suppliers s on s.id=oi.supplier_id
      where oi.order_id=o.id and s.profile_id=auth.uid()
    )
  ) then
    raise exception 'Not authorized to synchronize this order';
  end if;

  select * into os
  from public.order_settlements
  where order_id=_order_id
  for update;

  v_remit:=coalesce(os.cod_remittance_status,'not_remitted');

  v_status:=case
    when o.status='delivered' and o.payment_status='paid' then 'ready'
    when o.status='returned' and o.payment_status='refunded' then 'refunded'
    when o.status in ('refused','cancelled') or o.payment_status in ('failed','cancelled') then 'void'
    else 'pending'
  end;

  if o.payment_status in ('paid','refunded') then
    v_collected:=coalesce(o.total_amount,0);
  end if;

  if o.payment_status='refunded' then
    v_refunded:=coalesce(o.total_amount,0);
    if v_remit='remitted' then
      v_remit:='reversal_required';
    end if;
  end if;

  select courier_cost_at_purchase
  into v_courier
  from public.order_shipping_costs
  where order_id=_order_id
  limit 1;

  v_ship:=case
    when v_courier is null then null
    else coalesce(o.shipping_fee_at_purchase,0)-v_courier
  end;

  insert into public.order_settlements(
    order_id,currency,settlement_status,customer_collected_amount,customer_refunded_amount,
    product_subtotal_amount,customer_shipping_fee_amount,courier_cost_amount,shipping_margin_amount,
    cod_collected_at,refunded_at,cod_remittance_status,expected_cod_amount,remittance_difference,updated_at
  )
  values(
    o.id,coalesce(o.currency,'EGP'),v_status,v_collected,v_refunded,
    coalesce(o.product_subtotal_amount,0),coalesce(o.shipping_fee_at_purchase,0),v_courier,v_ship,
    case when o.payment_status in ('paid','refunded') then now() end,
    case when o.payment_status='refunded' then now() end,
    v_remit,coalesce(o.total_amount,0),coalesce(os.remittance_difference,0),now()
  )
  on conflict(order_id) do update
  set settlement_status=excluded.settlement_status,
      customer_collected_amount=excluded.customer_collected_amount,
      customer_refunded_amount=excluded.customer_refunded_amount,
      product_subtotal_amount=excluded.product_subtotal_amount,
      customer_shipping_fee_amount=excluded.customer_shipping_fee_amount,
      courier_cost_amount=excluded.courier_cost_amount,
      shipping_margin_amount=excluded.shipping_margin_amount,
      cod_collected_at=coalesce(public.order_settlements.cod_collected_at,excluded.cod_collected_at),
      refunded_at=case
        when excluded.settlement_status='refunded'
          then coalesce(public.order_settlements.refunded_at,excluded.refunded_at)
        else public.order_settlements.refunded_at
      end,
      cod_remittance_status=case
        when public.order_settlements.cod_remittance_status='reversed' then 'reversed'
        when public.order_settlements.cod_remittance_status='reversal_required' then 'reversal_required'
        when excluded.cod_remittance_status='reversal_required' then 'reversal_required'
        when public.order_settlements.cod_remittance_status in ('remitted','disputed')
          then public.order_settlements.cod_remittance_status
        else excluded.cod_remittance_status
      end,
      expected_cod_amount=excluded.expected_cod_amount,
      updated_at=now();

  insert into public.order_item_settlements(
    order_item_id,order_id,supplier_id,dropshipper_id,currency,settlement_status,
    quantity,retail_amount,supplier_gross_amount,commission_rate,platform_commission_amount,
    supplier_net_amount,dropshipper_profit_amount,supplier_payout_status,dropshipper_payout_status,updated_at
  )
  select
    oi.id,
    o.id,
    oi.supplier_id,
    o.dropshipper_id,
    coalesce(o.currency,'EGP'),
    v_status,
    oi.quantity,
    round(coalesce(oi.retail_price_at_purchase,0)*oi.quantity,2),
    round(coalesce(oi.cost_price_at_purchase,0)*oi.quantity,2),
    coalesce(oi.commission_rate_at_purchase,0),
    round(coalesce(oi.cost_price_at_purchase,0)*oi.quantity*coalesce(oi.commission_rate_at_purchase,0)/100,2),
    round(
      coalesce(oi.cost_price_at_purchase,0)*oi.quantity
      -(coalesce(oi.cost_price_at_purchase,0)*oi.quantity*coalesce(oi.commission_rate_at_purchase,0)/100),
      2
    ),
    round((coalesce(oi.retail_price_at_purchase,0)-coalesce(oi.cost_price_at_purchase,0))*oi.quantity,2),
    case
      when v_status='ready' and v_remit='remitted' then 'pending'
      when v_status in ('void','refunded') then 'blocked'
      else 'not_ready'
    end,
    case
      when v_status='ready' and v_remit='remitted' then 'pending'
      when v_status in ('void','refunded') then 'blocked'
      else 'not_ready'
    end,
    now()
  from public.order_items oi
  where oi.order_id=o.id
  on conflict(order_item_id) do update
  set settlement_status=excluded.settlement_status,
      retail_amount=excluded.retail_amount,
      supplier_gross_amount=excluded.supplier_gross_amount,
      commission_rate=excluded.commission_rate,
      platform_commission_amount=excluded.platform_commission_amount,
      supplier_net_amount=excluded.supplier_net_amount,
      dropshipper_profit_amount=excluded.dropshipper_profit_amount,
      supplier_payout_status=case
        when public.order_item_settlements.supplier_reversal_resolved_at is not null then 'blocked'
        when public.order_item_settlements.supplier_payout_status='reversal_required' then 'reversal_required'
        when excluded.settlement_status in ('void','refunded')
             and public.order_item_settlements.supplier_payout_status='paid' then 'reversal_required'
        when excluded.settlement_status in ('void','refunded') then 'blocked'
        when excluded.settlement_status='ready' and v_remit='remitted' then
          case
            when public.order_item_settlements.supplier_payout_status='paid' then 'paid'
            else 'pending'
          end
        else
          case
            when public.order_item_settlements.supplier_payout_status='paid' then 'paid'
            else 'not_ready'
          end
      end,
      dropshipper_payout_status=case
        when public.order_item_settlements.dropshipper_reversal_resolved_at is not null then 'blocked'
        when public.order_item_settlements.dropshipper_payout_status='reversal_required' then 'reversal_required'
        when excluded.settlement_status in ('void','refunded')
             and public.order_item_settlements.dropshipper_payout_status='paid' then 'reversal_required'
        when excluded.settlement_status in ('void','refunded') then 'blocked'
        when excluded.settlement_status='ready' and v_remit='remitted' then
          case
            when public.order_item_settlements.dropshipper_payout_status='paid' then 'paid'
            else 'pending'
          end
        else
          case
            when public.order_item_settlements.dropshipper_payout_status='paid' then 'paid'
            else 'not_ready'
          end
      end,
      updated_at=now();

  return jsonb_build_object(
    'order_id',o.id,
    'settlement_status',v_status,
    'cod_remittance_status',v_remit,
    'customer_collected_amount',v_collected,
    'customer_refunded_amount',v_refunded,
    'expected_cod_amount',coalesce(o.total_amount,0)
  );
end;
$function$;
