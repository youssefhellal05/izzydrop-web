begin;

create or replace function public.admin_resolve_cod_discrepancy(_order_id uuid,_resolution_reason text,_reference text,_approve_payout boolean default false)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare os public.order_settlements%rowtype;
begin
 if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
 if nullif(btrim(_resolution_reason),'') is null or nullif(btrim(_reference),'') is null then raise exception 'A reason and reference are required'; end if;
 select * into os from public.order_settlements where order_id=_order_id for update; if not found then raise exception 'Settlement not found'; end if;
 if os.cod_remittance_status not in ('partial','not_remitted','disputed') then raise exception 'This remittance is not a discrepancy'; end if;
 update public.order_settlements set cod_remittance_status=case when _approve_payout then 'remitted' else 'disputed' end,remittance_note=btrim(_resolution_reason),remittance_reference=btrim(_reference),cod_remitted_at=coalesce(cod_remitted_at,now()),updated_at=now() where order_id=_order_id;
 if _approve_payout then update public.order_item_settlements set supplier_payout_status=case when supplier_payout_status='paid' then 'paid' else 'pending' end,dropshipper_payout_status=case when dropshipper_payout_status='paid' then 'paid' else 'pending' end,updated_at=now() where order_id=_order_id and settlement_status='ready'; end if;
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'cod_remittance_discrepancy_resolved','orders',_order_id::text,jsonb_build_object('approved_for_payout',_approve_payout,'reason',_resolution_reason,'reference',_reference,'remitted_amount',os.cod_remitted_amount,'expected_amount',os.expected_cod_amount));
 return jsonb_build_object('order_id',_order_id,'cod_remittance_status',case when _approve_payout then 'remitted' else 'disputed' end,'payout_eligible',_approve_payout,'reason',_resolution_reason,'reference',_reference);
end; $$;
revoke all on function public.admin_resolve_cod_discrepancy(uuid,text,text,boolean) from public,anon;
grant execute on function public.admin_resolve_cod_discrepancy(uuid,text,text,boolean) to authenticated,service_role;

drop function if exists public.admin_settlements();
create function public.admin_settlements()
returns table(order_id uuid,order_item_id uuid,external_order_ref text,created_at timestamptz,order_status public.order_status,payment_status public.payment_status,settlement_status text,cod_remittance_status text,expected_cod_amount numeric,customer_collected_amount numeric,cod_remitted_amount numeric,remittance_difference numeric,remittance_reference text,remittance_note text,customer_shipping_fee_amount numeric,courier_cost_amount numeric,shipping_margin_amount numeric,supplier_name text,dropshipper_name text,supplier_gross_amount numeric,platform_commission_amount numeric,supplier_net_amount numeric,dropshipper_profit_amount numeric,supplier_payout_status text,dropshipper_payout_status text)
language plpgsql stable security definer set search_path='public','private' as $$
begin
 if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
 return query select o.id,i.order_item_id,o.external_order_ref,o.created_at,o.status,o.payment_status,os.settlement_status,os.cod_remittance_status,os.expected_cod_amount,os.customer_collected_amount,os.cod_remitted_amount,os.remittance_difference,os.remittance_reference,os.remittance_note,os.customer_shipping_fee_amount,os.courier_cost_amount,os.shipping_margin_amount,s.business_name,d.business_name,i.supplier_gross_amount,i.platform_commission_amount,i.supplier_net_amount,i.dropshipper_profit_amount,i.supplier_payout_status,i.dropshipper_payout_status from public.order_item_settlements i join public.order_settlements os on os.order_id=i.order_id join public.orders o on o.id=i.order_id join public.suppliers s on s.id=i.supplier_id join public.dropshippers d on d.id=i.dropshipper_id order by o.created_at desc,i.order_item_id;
end; $$;

commit;
