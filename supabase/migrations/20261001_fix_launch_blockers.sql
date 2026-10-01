-- IzzyDrop launch blocker fixes B1-B5.
-- Applied only after rollback QA against the live project.

begin;

-- B1: financial functions are never an anonymous API. Internal calls remain
-- possible from SECURITY DEFINER functions; direct sync is admin-only.
revoke all on function public.sync_order_financials(uuid) from public, anon, authenticated;
grant execute on function public.sync_order_financials(uuid) to service_role;
revoke all on function public.admin_confirm_cod_remittance(uuid,numeric,numeric) from public, anon;
grant execute on function public.admin_confirm_cod_remittance(uuid,numeric,numeric) to authenticated, service_role;
revoke all on function public.admin_mark_supplier_payout_paid(uuid) from public, anon;
grant execute on function public.admin_mark_supplier_payout_paid(uuid) to authenticated, service_role;
revoke all on function public.admin_mark_dropshipper_payout_paid(uuid) from public, anon;
grant execute on function public.admin_mark_dropshipper_payout_paid(uuid) to authenticated, service_role;

-- B2: remittance has an auditable expected amount and explicit reconciliation.
alter table public.order_settlements
  add column if not exists expected_cod_amount numeric not null default 0,
  add column if not exists remittance_difference numeric not null default 0,
  add column if not exists remittance_reference text,
  add column if not exists remittance_note text;

-- B3: NULL is no longer overloaded as an accidental custom price. Existing
-- non-NULL values are preserved as explicit custom intent; NULL follows suggestions.
alter table public.dropshipper_product_links
  add column if not exists pricing_mode text not null default 'follow_suggestions';
update public.dropshipper_product_links
set pricing_mode=case when retail_price is null then 'follow_suggestions' else 'custom' end
where pricing_mode is null or pricing_mode='follow_suggestions';
alter table public.dropshipper_product_links
  drop constraint if exists dropshipper_product_links_pricing_mode_check,
  add constraint dropshipper_product_links_pricing_mode_check
  check (pricing_mode in ('follow_suggestions','custom'));

-- B4: server-side idempotency for manual orders.
create table if not exists public.manual_order_requests(
  id uuid primary key default gen_random_uuid(),
  dropshipper_id uuid not null references public.dropshippers(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(dropshipper_id,idempotency_key)
);
alter table public.manual_order_requests enable row level security;
revoke all on public.manual_order_requests from public, anon, authenticated;

-- B5: admin restriction is separate from supplier publication status. Existing
-- inactive rows are intentionally left unblocked.
alter table public.supplier_products
  add column if not exists admin_blocked boolean not null default false,
  add column if not exists admin_block_reason text,
  add column if not exists admin_blocked_by uuid references auth.users(id),
  add column if not exists admin_blocked_at timestamptz,
  add column if not exists admin_block_previous_status public.product_status;

create or replace function public.prevent_supplier_admin_block_bypass()
returns trigger language plpgsql security definer
set search_path='public','private' as $$
begin
  if old.admin_blocked and (new.status is distinct from old.status or new.admin_blocked is distinct from old.admin_blocked)
     and not private.has_role(auth.uid(),'admin'::public.app_role)
     and current_setting('request.jwt.claim.role',true) <> 'service_role' then
    raise exception 'Product is blocked by IzzyDrop administration';
  end if;
  return new;
end; $$;
drop trigger if exists trg_prevent_supplier_admin_block_bypass on public.supplier_products;
create trigger trg_prevent_supplier_admin_block_bypass
before update on public.supplier_products
for each row execute function public.prevent_supplier_admin_block_bypass();

-- Keep the established admin function name used by the UI, but make inactive
-- mean an administrative block and active mean an administrative release.
create or replace function public.admin_set_product_status(_product_id uuid,_status text)
returns jsonb language plpgsql security definer
set search_path='public','private' as $$
declare r public.supplier_products%rowtype; old_status public.product_status;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
  if _status not in ('active','inactive') then raise exception 'Admin can only activate or deactivate products'; end if;
  select * into r from public.supplier_products where id=_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  old_status:=r.status;
  if _status='inactive' then
    update public.supplier_products set admin_blocked=true,admin_block_reason=coalesce(admin_block_reason,'Blocked by IzzyDrop administration'),admin_blocked_by=auth.uid(),admin_blocked_at=now(),admin_block_previous_status=case when status='active' then status else admin_block_previous_status end, status='inactive',updated_at=now() where id=_product_id returning * into r;
  else
    update public.supplier_products set admin_blocked=false,admin_block_reason=null,admin_blocked_by=null,admin_blocked_at=null,status=coalesce(admin_block_previous_status,status,'inactive'::public.product_status),admin_block_previous_status=null,updated_at=now() where id=_product_id returning * into r;
  end if;
  insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),case when _status='inactive' then 'product_admin_blocked' else 'product_admin_unblocked' end,'supplier_products',_product_id::text,jsonb_build_object('product_name',r.name,'from',old_status,'to',r.status,'reason',r.admin_block_reason));
  return jsonb_build_object('product_id',r.id,'status',r.status,'admin_blocked',r.admin_blocked,'admin_block_reason',r.admin_block_reason);
end; $$;

-- Make direct supplier publication RPCs reject blocked products by virtue of
-- the trigger; catalog SQL also excludes the blocked flag where it is visible.
create or replace function public.marketplace_catalog_v2()
returns table(product_id uuid,public_slug text,supplier_id uuid,supplier_name text,category_id uuid,category_name text,name text,description text,name_en text,name_ar text,description_en text,description_ar text,content_source_language text,sku text,suggested_retail_price numeric,currency text,status public.product_status,stock_quantity integer,primary_image_url text,created_at timestamptz)
language sql stable security definer set search_path='public','private' as $$
select p.id,p.public_slug,p.supplier_id,s.business_name,p.category_id,c.name,p.name,p.description,p.name_en,p.name_ar,p.description_en,p.description_ar,p.content_source_language,p.sku,p.suggested_retail_price,p.currency,p.status,coalesce((select sum(v.stock_quantity)::int from public.product_variants v where v.product_id=p.id and v.is_enabled),0),(select i.url from public.product_images i where i.product_id=p.id order by i.position,i.created_at limit 1),p.created_at
from public.supplier_products p join public.suppliers s on s.id=p.supplier_id left join public.categories c on c.id=p.category_id
where p.status='active' and not p.admin_blocked and s.status='approved' and (exists(select 1 from public.dropshippers d where d.profile_id=auth.uid()) or private.has_role(auth.uid(),'admin'::public.app_role)) order by p.created_at desc;
$$;

create or replace function public.public_catalog()
returns table(public_slug text,name text,description text,name_en text,name_ar text,description_en text,description_ar text,content_source_language text,sku text,suggested_retail_price numeric,currency text,supplier_name text,category_name text,stock_quantity integer,primary_image_url text)
language sql stable security definer set search_path='public' as $$
select p.public_slug,p.name,p.description,p.name_en,p.name_ar,p.description_en,p.description_ar,p.content_source_language,p.sku,coalesce((select min(coalesce(v.suggested_retail_price,p.suggested_retail_price)) from public.product_variants v where v.product_id=p.id and v.is_enabled),p.suggested_retail_price),p.currency,s.business_name,c.name,coalesce((select sum(v.stock_quantity)::int from public.product_variants v where v.product_id=p.id and v.is_enabled),0),(select i.url from public.product_images i where i.product_id=p.id order by i.position,i.created_at limit 1)
from public.supplier_products p join public.suppliers s on s.id=p.supplier_id left join public.categories c on c.id=p.category_id
where p.status='active' and not p.admin_blocked and s.status='approved' order by p.created_at desc;
$$;

create or replace function public.public_product(_slug text)
returns jsonb language sql stable security definer set search_path='public' as $$
select jsonb_build_object('product_id',p.id,'slug',p.public_slug,'name',p.name,'description',p.description,'name_en',p.name_en,'name_ar',p.name_ar,'description_en',p.description_en,'description_ar',p.description_ar,'content_source_language',p.content_source_language,'sku',p.sku,'suggested_retail_price',p.suggested_retail_price,'currency',p.currency,'supplier',s.business_name,'category',c.name,'category_ar',c.name_ar,'images',coalesce((select jsonb_agg(jsonb_build_object('url',i.url,'position',i.position) order by i.position,i.created_at) from public.product_images i where i.product_id=p.id),'[]'::jsonb),'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.variant_name,'sku',v.sku,'stock_quantity',v.stock_quantity,'weight_grams',v.weight_grams,'options',coalesce(v.option_values,'{}'::jsonb),'image_url',v.variant_image_url,'suggested_retail_price',coalesce(v.suggested_retail_price,p.suggested_retail_price)) order by v.created_at,v.id) from public.product_variants v where v.product_id=p.id and v.is_enabled),'[]'::jsonb))
from public.supplier_products p join public.suppliers s on s.id=p.supplier_id left join public.categories c on c.id=p.category_id where p.public_slug=_slug and p.status='active' and not p.admin_blocked and s.status='approved' limit 1;
$$;

-- Recreate the core financial sync with explicit remittance states and no
-- direct user authorization surface. Internal SECURITY DEFINER callers use it.
create or replace function public.sync_order_financials(_order_id uuid)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare o public.orders%rowtype; os public.order_settlements%rowtype; v_status text; v_courier numeric; v_ship numeric; v_collected numeric:=0; v_refunded numeric:=0; v_remit text;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
  select * into o from public.orders where id=_order_id for update; if not found then raise exception 'Order not found'; end if;
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
  on conflict(order_item_id) do update set settlement_status=excluded.settlement_status,retail_amount=excluded.retail_amount,supplier_gross_amount=excluded.supplier_gross_amount,commission_rate=excluded.commission_rate,platform_commission_amount=excluded.platform_commission_amount,supplier_net_amount=excluded.supplier_net_amount,dropshipper_profit_amount=excluded.dropshipper_profit_amount,supplier_payout_status=case when excluded.settlement_status='ready' and v_remit='remitted' then case when public.order_item_settlements.supplier_payout_status='paid' then 'paid' else 'pending' end when excluded.settlement_status in ('void','refunded') then case when public.order_item_settlements.supplier_payout_status='paid' then 'reversal_required' else 'blocked' end else case when public.order_item_settlements.supplier_payout_status='paid' then 'paid' else 'not_ready' end end,dropshipper_payout_status=case when excluded.settlement_status='ready' and v_remit='remitted' then case when public.order_item_settlements.dropshipper_payout_status='paid' then 'paid' else 'pending' end when excluded.settlement_status in ('void','refunded') then case when public.order_item_settlements.dropshipper_payout_status='paid' then 'reversal_required' else 'blocked' end else case when public.order_item_settlements.dropshipper_payout_status='paid' then 'paid' else 'not_ready' end end,updated_at=now();
  return jsonb_build_object('order_id',o.id,'settlement_status',v_status,'cod_remittance_status',v_remit,'customer_collected_amount',v_collected,'customer_refunded_amount',v_refunded,'expected_cod_amount',coalesce(o.total_amount,0));
end; $$;

-- B2 replacement: classify the recorded amount. Only exact reconciliation is
-- payout-eligible; a discrepancy is explicit and remains blocked.
drop function if exists public.admin_confirm_cod_remittance(uuid,numeric,numeric);
create function public.admin_confirm_cod_remittance(_order_id uuid,_remitted_amount numeric default null,_courier_cost numeric default null,_resolution_reason text default null,_reference text default null)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare o public.orders%rowtype; os public.order_settlements%rowtype; a numeric; st text; partner text;
begin
 if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
 if _remitted_amount is not null and _remitted_amount<0 then raise exception 'Remitted amount cannot be negative'; end if;
 if _courier_cost is not null and _courier_cost<0 then raise exception 'Courier cost cannot be negative'; end if;
 perform public.sync_order_financials(_order_id);
 select * into o from public.orders where id=_order_id for update; select * into os from public.order_settlements where order_id=_order_id for update;
 if o.status<>'delivered' or o.payment_status<>'paid' or os.settlement_status<>'ready' then raise exception 'Only delivered, paid COD orders can be remitted'; end if;
 if os.cod_remittance_status in ('remitted','disputed','reversal_required') then raise exception 'COD remittance already resolved'; end if;
 a:=coalesce(_remitted_amount,o.total_amount); st:=case when a<=0 then 'not_remitted' when a<coalesce(os.expected_cod_amount,o.total_amount) then 'partial' else 'remitted' end;
 if st<>'remitted' and nullif(btrim(_resolution_reason),'') is not null then st:='disputed'; end if;
 select shipping_partner_name into partner from public.shipping_settings where id=true;
 insert into public.order_shipping_costs(order_id,shipping_partner_name,courier_cost_at_purchase,created_at) values(_order_id,partner,_courier_cost,now()) on conflict(order_id) do update set shipping_partner_name=coalesce(public.order_shipping_costs.shipping_partner_name,excluded.shipping_partner_name),courier_cost_at_purchase=coalesce(excluded.courier_cost_at_purchase,public.order_shipping_costs.courier_cost_at_purchase);
 update public.order_settlements set cod_remittance_status=st,cod_remitted_amount=a,cod_remitted_at=case when st in ('remitted','disputed') then now() else null end,remittance_difference=coalesce(os.expected_cod_amount,o.total_amount)-a,remittance_reference=nullif(btrim(_reference),''),remittance_note=nullif(btrim(_resolution_reason),''),courier_cost_amount=coalesce(_courier_cost,courier_cost_amount),shipping_margin_amount=case when coalesce(_courier_cost,courier_cost_amount) is null then null else customer_shipping_fee_amount-coalesce(_courier_cost,courier_cost_amount) end,updated_at=now() where order_id=_order_id;
 if st='remitted' then update public.order_item_settlements set supplier_payout_status=case when supplier_payout_status='paid' then 'paid' else 'pending' end,dropshipper_payout_status=case when dropshipper_payout_status='paid' then 'paid' else 'pending' end,updated_at=now() where order_id=_order_id and settlement_status='ready'; end if;
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'cod_remittance_recorded','orders',_order_id::text,jsonb_build_object('expected',os.expected_cod_amount,'remitted',a,'difference',coalesce(os.expected_cod_amount,o.total_amount)-a,'status',st,'reason',_resolution_reason,'reference',_reference));
 return jsonb_build_object('order_id',_order_id,'cod_remittance_status',st,'expected_cod_amount',os.expected_cod_amount,'cod_remitted_amount',a,'remittance_difference',coalesce(os.expected_cod_amount,o.total_amount)-a,'payout_eligible',st='remitted');
end; $$;
grant execute on function public.admin_confirm_cod_remittance(uuid,numeric,numeric,text,text) to authenticated,service_role;
revoke all on function public.admin_confirm_cod_remittance(uuid,numeric,numeric,text,text) from public,anon;

-- Payout functions retain admin body checks and require exact reconciliation.
create or replace function public.admin_mark_supplier_payout_paid(_order_item_id uuid) returns jsonb language plpgsql security definer set search_path='public','private' as $$ declare r public.order_item_settlements%rowtype; rem text; begin if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if; select * into r from public.order_item_settlements where order_item_id=_order_item_id for update; if not found then raise exception 'Settlement item not found'; end if; select cod_remittance_status into rem from public.order_settlements where order_id=r.order_id; if r.settlement_status<>'ready' or rem<>'remitted' then raise exception 'Payout is not ready: COD remittance is not fully reconciled'; end if; if r.supplier_payout_status='paid' then return jsonb_build_object('order_item_id',_order_item_id,'supplier_payout_status','paid','duplicate',true); end if; update public.order_item_settlements set supplier_payout_status='paid',supplier_paid_at=now(),updated_at=now() where order_item_id=_order_item_id returning * into r; insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'supplier_payout_paid','order_item_settlements',_order_item_id::text,jsonb_build_object('amount',r.supplier_net_amount)); return jsonb_build_object('order_item_id',_order_item_id,'supplier_payout_status','paid','amount',r.supplier_net_amount); end; $$;
create or replace function public.admin_mark_dropshipper_payout_paid(_order_item_id uuid) returns jsonb language plpgsql security definer set search_path='public','private' as $$ declare r public.order_item_settlements%rowtype; rem text; begin if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if; select * into r from public.order_item_settlements where order_item_id=_order_item_id for update; if not found then raise exception 'Settlement item not found'; end if; select cod_remittance_status into rem from public.order_settlements where order_id=r.order_id; if r.settlement_status<>'ready' or rem<>'remitted' then raise exception 'Payout is not ready: COD remittance is not fully reconciled'; end if; if r.dropshipper_payout_status='paid' then return jsonb_build_object('order_item_id',_order_item_id,'dropshipper_payout_status','paid','duplicate',true); end if; update public.order_item_settlements set dropshipper_payout_status='paid',dropshipper_paid_at=now(),updated_at=now() where order_item_id=_order_item_id returning * into r; insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'dropshipper_payout_paid','order_item_settlements',_order_item_id::text,jsonb_build_object('amount',r.dropshipper_profit_amount)); return jsonb_build_object('order_item_id',_order_item_id,'dropshipper_payout_status','paid','amount',r.dropshipper_profit_amount); end; $$;

-- B3: explicit mode in link and manual order pricing.
drop function if exists public.link_product_to_web(uuid,numeric);
create function public.link_product_to_web(_product_id uuid,_retail_price numeric default null) returns public.dropshipper_product_links language plpgsql security definer set search_path='public','private' as $$ declare did uuid; row_out public.dropshipper_product_links; begin select id into did from public.dropshippers where profile_id=auth.uid() and status='active' limit 1; if did is null then raise exception 'Active dropshipper profile not found'; end if; if not exists(select 1 from public.supplier_products p join public.suppliers s on s.id=p.supplier_id where p.id=_product_id and p.status='active' and not p.admin_blocked and s.status='approved') then raise exception 'Product is not available'; end if; insert into public.dropshipper_product_links(dropshipper_id,supplier_product_id,retail_price,pricing_mode,status,updated_at) values(did,_product_id,_retail_price,case when _retail_price is null then 'follow_suggestions' else 'custom' end,'active',now()) on conflict(dropshipper_id,supplier_product_id) do update set retail_price=case when _retail_price is null then public.dropshipper_product_links.retail_price else _retail_price end,pricing_mode=case when _retail_price is null then public.dropshipper_product_links.pricing_mode else 'custom' end,status='active',updated_at=now() returning * into row_out; return row_out; end; $$;

-- B4: manual order RPC accepts a technical idempotency key.
drop function if exists public.create_dropshipper_order(uuid,uuid,integer,text,text,text,jsonb,text);
create function public.create_dropshipper_order(_product_id uuid,_variant_id uuid,_quantity integer,_customer_name text,_customer_phone text,_customer_email text default null,_shipping_address jsonb default '{}'::jsonb,_external_order_ref text default null,_idempotency_key text default null) returns uuid language plpgsql security definer set search_path='public','private' as $$
declare did uuid; sid uuid; oid uuid; available integer; pc numeric;vc numeric;pr numeric;vr numeric;lr numeric; retail numeric; curr text; comm numeric; fee numeric; courier numeric; partner text; req public.manual_order_requests%rowtype; h text;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if; if nullif(btrim(_idempotency_key),'') is null or length(_idempotency_key)>120 then raise exception 'A valid order request key is required'; end if; if _quantity is null or _quantity<1 then raise exception 'Quantity must be at least 1'; end if; if length(btrim(coalesce(_customer_name,'')))<2 then raise exception 'Customer name is required'; end if; if length(regexp_replace(coalesce(_customer_phone,''),'[^0-9+]','','g'))<8 then raise exception 'A valid customer phone number is required'; end if; if length(btrim(coalesce(_shipping_address->>'address1','')))<3 or length(btrim(coalesce(_shipping_address->>'city','')))<2 or not private.is_cairo_delivery_address(_shipping_address) then raise exception 'A delivery address and Cairo area are required'; end if;
 select d.id into did from public.dropshippers d where d.profile_id=auth.uid() and d.status='active' limit 1; if did is null then raise exception 'Active dropshipper profile not found'; end if;
 h:=md5(jsonb_build_object('product',_product_id,'variant',_variant_id,'quantity',_quantity,'name',_customer_name,'phone',_customer_phone,'email',_customer_email,'address',_shipping_address)::text);
 insert into public.manual_order_requests(dropshipper_id,idempotency_key,request_hash) values(did,btrim(_idempotency_key),h) on conflict(dropshipper_id,idempotency_key) do nothing;
 select * into req from public.manual_order_requests where dropshipper_id=did and idempotency_key=btrim(_idempotency_key) for update;
 if req.request_hash<>h then raise exception 'This order request key was already used for different order details'; end if;
 if req.order_id is not null then return req.order_id; end if;
 select ss.customer_delivery_fee,ss.internal_courier_cost,ss.shipping_partner_name into fee,courier,partner from public.shipping_settings ss where ss.id=true and ss.is_active and ss.customer_delivery_fee is not null limit 1; if fee is null then raise exception 'Cairo delivery is not configured yet'; end if;
 select p.supplier_id,p.cost_price,p.suggested_retail_price,l.retail_price,p.currency,coalesce(p.commission_rate_override,s.commission_rate_override,(select default_commission_rate from public.marketplace_settings where id=true),0),l.pricing_mode into sid,pc,pr,lr,curr,comm,req.request_hash from public.dropshipper_product_links l join public.supplier_products p on p.id=l.supplier_product_id join public.suppliers s on s.id=p.supplier_id where l.dropshipper_id=did and l.supplier_product_id=_product_id and l.status='active' and p.status='active' and not p.admin_blocked and s.status='approved' limit 1; if sid is null then raise exception 'Product is not linked or is currently unavailable'; end if;
 select stock_quantity,cost_price,suggested_retail_price into available,vc,vr from public.product_variants where id=_variant_id and product_id=_product_id and is_enabled for update; if not found then raise exception 'Variant not available'; end if; if available<_quantity then raise exception 'Not enough stock'; end if;
 retail:=case when (select pricing_mode from public.dropshipper_product_links where dropshipper_id=did and supplier_product_id=_product_id)='custom' then lr else coalesce(vr,pr) end; if retail is null or retail<0 then raise exception 'Selling price is not configured'; end if;
 update public.product_variants set stock_quantity=stock_quantity-_quantity,updated_at=now() where id=_variant_id;
 insert into public.orders(dropshipper_id,customer_name,customer_email,customer_phone,shipping_address,status,payment_status,currency,product_subtotal_amount,shipping_fee_at_purchase,total_amount,source,external_order_ref,payment_method) values(did,nullif(btrim(_customer_name),''),nullif(btrim(_customer_email),''),nullif(btrim(_customer_phone),''),coalesce(_shipping_address,'{}'::jsonb),'pending','pending',curr,retail*_quantity,fee,retail*_quantity+fee,'manual',nullif(btrim(_external_order_ref),''),'cod') returning id into oid;
 insert into public.order_items(order_id,supplier_id,supplier_product_id,variant_id,quantity,cost_price_at_purchase,retail_price_at_purchase,fulfillment_status,stock_reserved_quantity,commission_rate_at_purchase) values(oid,sid,_product_id,_variant_id,_quantity,coalesce(vc,pc),retail,'unfulfilled',_quantity,comm); insert into public.order_shipping_costs(order_id,shipping_partner_name,courier_cost_at_purchase) values(oid,partner,courier); update public.manual_order_requests set order_id=oid,updated_at=now() where id=req.id; return oid;
end; $$;

-- Storefront retry fix: resolve an already completed key before stock checks.
create or replace function public.storefront_create_order(_token uuid,_variant_id uuid,_quantity integer,_customer_name text,_customer_phone text,_customer_email text default null,_shipping_address jsonb default '{}'::jsonb,_idempotency_key text default null) returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare iid uuid; did uuid; pid uuid; sid uuid; existing uuid; avail integer; pc numeric;vc numeric; retail numeric; curr text; comm numeric; fee numeric; courier numeric; partner text; ref text; subtotal numeric;
begin
 if _quantity is null or _quantity<1 or _quantity>50 then raise exception 'Quantity must be between 1 and 50'; end if; if nullif(btrim(_idempotency_key),'') is null then raise exception 'A valid order request key is required'; end if; if length(btrim(coalesce(_customer_name,'')))<2 or length(regexp_replace(coalesce(_customer_phone,''),'[^0-9+]','','g'))<8 then raise exception 'Customer details are required'; end if; if length(btrim(coalesce(_shipping_address->>'address1','')))<3 or length(btrim(coalesce(_shipping_address->>'city','')))<2 or not private.is_cairo_delivery_address(_shipping_address) then raise exception 'A delivery address and Cairo area are required'; end if;
 select si.id,d.id,p.id,p.supplier_id,p.cost_price,p.currency,coalesce(p.commission_rate_override,s.commission_rate_override,(select default_commission_rate from public.marketplace_settings where id=true),0) into iid,did,pid,sid,pc,curr,comm from public.storefront_integrations si join public.dropshipper_product_links l on l.id=si.link_id join public.dropshippers d on d.id=l.dropshipper_id join public.supplier_products p on p.id=l.supplier_product_id join public.suppliers s on s.id=p.supplier_id where si.public_token=_token and si.enabled and l.status='active' and d.status='active' and p.status='active' and not p.admin_blocked and s.status='approved' limit 1; if iid is null then raise exception 'Storefront integration is not available'; end if;
 select sor.order_id into existing from public.storefront_order_requests sor where sor.integration_id=iid and sor.idempotency_key=btrim(_idempotency_key) for update; if existing is not null then return jsonb_build_object('order_id',existing,'duplicate',true); end if;
 insert into public.storefront_order_requests(integration_id,idempotency_key) values(iid,btrim(_idempotency_key)) on conflict(integration_id,idempotency_key) do nothing; select sor.order_id into existing from public.storefront_order_requests sor where sor.integration_id=iid and sor.idempotency_key=btrim(_idempotency_key) for update; if existing is not null then return jsonb_build_object('order_id',existing,'duplicate',true); end if;
 select customer_delivery_fee,internal_courier_cost,shipping_partner_name into fee,courier,partner from public.shipping_settings where id=true and is_active and customer_delivery_fee is not null; if fee is null then raise exception 'Cairo delivery is not configured yet'; end if;
 select siv.retail_price,pv.stock_quantity,pv.cost_price into retail,avail,vc from public.storefront_integration_variants siv join public.product_variants pv on pv.id=siv.variant_id where siv.integration_id=iid and siv.variant_id=_variant_id and siv.enabled and pv.product_id=pid and pv.is_enabled for update of pv; if not found then raise exception 'This variant is not available on this website'; end if; if avail<_quantity then raise exception 'Not enough stock'; end if;
 update public.product_variants set stock_quantity=stock_quantity-_quantity,updated_at=now() where id=_variant_id; subtotal:=retail*_quantity; ref:='WEB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); insert into public.orders(dropshipper_id,customer_name,customer_email,customer_phone,shipping_address,status,payment_status,currency,product_subtotal_amount,shipping_fee_at_purchase,total_amount,source,external_order_ref,payment_method) values(did,nullif(btrim(_customer_name),''),nullif(btrim(_customer_email),''),nullif(btrim(_customer_phone),''),coalesce(_shipping_address,'{}'::jsonb),'pending','pending',curr,subtotal,fee,subtotal+fee,'storefront',ref,'cod') returning id into existing; insert into public.order_items(order_id,supplier_id,supplier_product_id,variant_id,quantity,cost_price_at_purchase,retail_price_at_purchase,fulfillment_status,stock_reserved_quantity,commission_rate_at_purchase) values(existing,sid,pid,_variant_id,_quantity,coalesce(vc,pc),retail,'unfulfilled',_quantity,comm); insert into public.order_shipping_costs(order_id,shipping_partner_name,courier_cost_at_purchase) values(existing,partner,courier); update public.storefront_order_requests set order_id=existing where integration_id=iid and idempotency_key=btrim(_idempotency_key); return jsonb_build_object('order_id',existing,'reference',ref,'duplicate',false,'product_subtotal',subtotal,'shipping_fee',fee,'total_amount',subtotal+fee);
end; $$;

commit;
