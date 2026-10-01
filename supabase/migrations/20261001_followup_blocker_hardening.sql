begin;

-- B1: allow the lifecycle RPCs that call sync internally, while preventing
-- arbitrary authenticated users from syncing another user's order.
create or replace function public.sync_order_financials(_order_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare o public.orders%rowtype; os public.order_settlements%rowtype; v_status text; v_courier numeric; v_ship numeric; v_collected numeric:=0; v_refunded numeric:=0; v_remit text;
begin
  select * into o from public.orders where id=_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if auth.uid() is null or not (
    private.has_role(auth.uid(),'admin'::public.app_role)
    or exists(select 1 from public.dropshippers d where d.id=o.dropshipper_id and d.profile_id=auth.uid())
    or exists(select 1 from public.order_items oi join public.suppliers s on s.id=oi.supplier_id where oi.order_id=o.id and s.profile_id=auth.uid())
  ) then raise exception 'Not authorized to synchronize this order'; end if;
  select * into os from public.order_settlements where order_id=_order_id for update;
  v_remit:=coalesce(os.cod_remittance_status,'not_remitted');
  v_status:=case when o.status='delivered' and o.payment_status='paid' then 'ready' when o.status='returned' and o.payment_status='refunded' then 'refunded' when o.status in ('refused','cancelled') or o.payment_status in ('failed','cancelled') then 'void' else 'pending' end;
  if o.payment_status in ('paid','refunded') then v_collected:=coalesce(o.total_amount,0); end if;
  if o.payment_status='refunded' then v_refunded:=coalesce(o.total_amount,0); if v_remit='remitted' then v_remit:='reversal_required'; end if; end if;
  select courier_cost_at_purchase into v_courier from public.order_shipping_costs where order_id=_order_id limit 1;
  v_ship:=case when v_courier is null then null else coalesce(o.shipping_fee_at_purchase,0)-v_courier end;
  insert into public.order_settlements(order_id,currency,settlement_status,customer_collected_amount,customer_refunded_amount,product_subtotal_amount,customer_shipping_fee_amount,courier_cost_amount,shipping_margin_amount,cod_collected_at,refunded_at,cod_remittance_status,expected_cod_amount,remittance_difference,updated_at)
  values(o.id,coalesce(o.currency,'EGP'),v_status,v_collected,v_refunded,coalesce(o.product_subtotal_amount,0),coalesce(o.shipping_fee_at_purchase,0),v_courier,v_ship,case when o.payment_status in ('paid','refunded') then now() end,case when o.payment_status='refunded' then now() end,v_remit,coalesce(o.total_amount,0),coalesce(os.remittance_difference,0),now())
  on conflict(order_id) do update set settlement_status=excluded.settlement_status,customer_collected_amount=excluded.customer_collected_amount,customer_refunded_amount=excluded.customer_refunded_amount,product_subtotal_amount=excluded.product_subtotal_amount,customer_shipping_fee_amount=excluded.customer_shipping_fee_amount,courier_cost_amount=excluded.courier_cost_amount,shipping_margin_amount=excluded.shipping_margin_amount,cod_collected_at=coalesce(public.order_settlements.cod_collected_at,excluded.cod_collected_at),refunded_at=case when excluded.settlement_status='refunded' then coalesce(public.order_settlements.refunded_at,excluded.refunded_at) else public.order_settlements.refunded_at end,cod_remittance_status=case when public.order_settlements.cod_remittance_status in ('remitted','disputed','reversal_required') then public.order_settlements.cod_remittance_status else excluded.cod_remittance_status end,expected_cod_amount=excluded.expected_cod_amount,updated_at=now();
  insert into public.order_item_settlements(order_item_id,order_id,supplier_id,dropshipper_id,currency,settlement_status,quantity,retail_amount,supplier_gross_amount,commission_rate,platform_commission_amount,supplier_net_amount,dropshipper_profit_amount,supplier_payout_status,dropshipper_payout_status,updated_at)
  select oi.id,o.id,oi.supplier_id,o.dropshipper_id,coalesce(o.currency,'EGP'),v_status,oi.quantity,round(coalesce(oi.retail_price_at_purchase,0)*oi.quantity,2),round(coalesce(oi.cost_price_at_purchase,0)*oi.quantity,2),coalesce(oi.commission_rate_at_purchase,0),round(coalesce(oi.cost_price_at_purchase,0)*oi.quantity*coalesce(oi.commission_rate_at_purchase,0)/100,2),round(coalesce(oi.cost_price_at_purchase,0)*oi.quantity-(coalesce(oi.cost_price_at_purchase,0)*oi.quantity*coalesce(oi.commission_rate_at_purchase,0)/100),2),round((coalesce(oi.retail_price_at_purchase,0)-coalesce(oi.cost_price_at_purchase,0))*oi.quantity,2),case when v_status='ready' and v_remit='remitted' then 'pending' when v_status in ('void','refunded') then 'blocked' else 'not_ready' end,case when v_status='ready' and v_remit='remitted' then 'pending' when v_status in ('void','refunded') then 'blocked' else 'not_ready' end,now() from public.order_items oi where oi.order_id=o.id
  on conflict(order_item_id) do update set settlement_status=excluded.settlement_status,retail_amount=excluded.retail_amount,supplier_gross_amount=excluded.supplier_gross_amount,commission_rate=excluded.commission_rate,platform_commission_amount=excluded.platform_commission_amount,supplier_net_amount=excluded.supplier_net_amount,dropshipper_profit_amount=excluded.dropshipper_profit_amount,updated_at=now();
  return jsonb_build_object('order_id',o.id,'settlement_status',v_status,'cod_remittance_status',v_remit,'customer_collected_amount',v_collected,'customer_refunded_amount',v_refunded,'expected_cod_amount',coalesce(o.total_amount,0));
end; $$;

revoke all on function public.create_dropshipper_order(uuid,uuid,integer,text,text,text,jsonb,text,text) from public,anon;
grant execute on function public.create_dropshipper_order(uuid,uuid,integer,text,text,text,jsonb,text,text) to authenticated,service_role;
revoke all on function public.prevent_supplier_admin_block_bypass() from public,anon,authenticated;

-- B3: storefront prices are channel-specific; this function no longer writes
-- the general My Products price.
create or replace function public.configure_storefront_integration_v2(_product_id uuid,_website_url text,_variants jsonb) returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare did uuid; lid uuid; iid uuid; tok uuid; slug text; item jsonb; vid uuid; price numeric; countv integer:=0; minprice numeric;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if nullif(btrim(_website_url),'') is null or _website_url !~* '^https?://[^[:space:]]+$' then raise exception 'Enter a valid website URL beginning with http:// or https://'; end if;
 if jsonb_typeof(coalesce(_variants,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(_variants,'[]'::jsonb))=0 then raise exception 'Choose at least one product variant'; end if;
 select id into did from public.dropshippers where profile_id=auth.uid() and status='active' limit 1; if did is null then raise exception 'Active dropshipper profile not found'; end if;
 if not exists(select 1 from public.supplier_products p join public.suppliers s on s.id=p.supplier_id where p.id=_product_id and p.status='active' and not p.admin_blocked and s.status='approved') then raise exception 'Product is not available'; end if;
 select id into lid from public.dropshipper_product_links where dropshipper_id=did and supplier_product_id=_product_id limit 1;
 if lid is null then insert into public.dropshipper_product_links(dropshipper_id,supplier_product_id,pricing_mode,status,synced_at) values(did,_product_id,'follow_suggestions','active',now()) returning id into lid; else update public.dropshipper_product_links set status='active',synced_at=now(),updated_at=now() where id=lid; end if;
 insert into public.storefront_integrations(link_id,website_url,enabled) values(lid,btrim(_website_url),true) on conflict(link_id) do update set website_url=excluded.website_url,enabled=true,updated_at=now() returning id,public_token into iid,tok;
 delete from public.storefront_integration_variants where integration_id=iid;
 for item in select value from jsonb_array_elements(_variants) loop begin vid:=(item->>'variant_id')::uuid; exception when others then raise exception 'Invalid variant'; end; price:=nullif(item->>'retail_price','')::numeric; if price is null or price<0 then raise exception 'Each selected variant needs a valid selling price'; end if; if not exists(select 1 from public.product_variants pv where pv.id=vid and pv.product_id=_product_id and pv.is_enabled) then raise exception 'Variant is not available for this product'; end if; insert into public.storefront_integration_variants(integration_id,variant_id,retail_price,enabled) values(iid,vid,price,true); countv:=countv+1; minprice:=case when minprice is null then price else least(minprice,price) end; end loop;
 select public_slug into slug from public.supplier_products where id=_product_id; return jsonb_build_object('integration_id',iid,'link_id',lid,'public_token',tok,'website_url',btrim(_website_url),'product_id',_product_id,'public_slug',slug,'variant_count',countv,'starting_price',minprice);
end; $$;

commit;
