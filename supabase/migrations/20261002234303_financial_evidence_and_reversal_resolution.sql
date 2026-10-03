alter table public.order_item_settlements
  add column if not exists supplier_payout_method text,
  add column if not exists supplier_payout_reference text,
  add column if not exists supplier_payout_note text,
  add column if not exists dropshipper_payout_method text,
  add column if not exists dropshipper_payout_reference text,
  add column if not exists dropshipper_payout_note text,
  add column if not exists supplier_reversal_resolution text,
  add column if not exists supplier_reversal_reference text,
  add column if not exists supplier_reversal_note text,
  add column if not exists supplier_reversal_resolved_at timestamptz,
  add column if not exists dropshipper_reversal_resolution text,
  add column if not exists dropshipper_reversal_reference text,
  add column if not exists dropshipper_reversal_note text,
  add column if not exists dropshipper_reversal_resolved_at timestamptz;

alter table public.order_settlements
  add column if not exists reversal_resolved_at timestamptz,
  add column if not exists reversal_resolution_reference text,
  add column if not exists reversal_resolution_note text;

alter table public.order_settlements
  drop constraint if exists order_settlements_cod_remittance_status_check;

alter table public.order_settlements
  add constraint order_settlements_cod_remittance_status_check
  check (cod_remittance_status in (
    'not_remitted','partial','disputed','remitted','reversal_required','reversed'
  ));

alter table public.order_item_settlements
  drop constraint if exists order_item_settlements_supplier_reversal_resolution_check;
alter table public.order_item_settlements
  add constraint order_item_settlements_supplier_reversal_resolution_check
  check (supplier_reversal_resolution is null or supplier_reversal_resolution in ('recovered','offset','waived','other'));

alter table public.order_item_settlements
  drop constraint if exists order_item_settlements_dropshipper_reversal_resolution_check;
alter table public.order_item_settlements
  add constraint order_item_settlements_dropshipper_reversal_resolution_check
  check (dropshipper_reversal_resolution is null or dropshipper_reversal_resolution in ('recovered','offset','waived','other'));

create or replace function public.admin_record_supplier_payout(
  _order_item_id uuid,
  _payment_method text,
  _reference text,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  r public.order_item_settlements%rowtype;
  rem text;
  backfilled boolean:=false;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if nullif(btrim(_payment_method),'') is null then raise exception 'Payment method is required'; end if;
  if nullif(btrim(_reference),'') is null then raise exception 'Payment reference is required'; end if;

  select * into r
  from public.order_item_settlements
  where order_item_id=_order_item_id
  for update;
  if not found then raise exception 'Settlement item not found'; end if;

  select cod_remittance_status into rem
  from public.order_settlements
  where order_id=r.order_id;

  if r.supplier_payout_status='paid' then
    if r.supplier_payout_reference is null or r.supplier_payout_method is null then
      update public.order_item_settlements
      set supplier_payout_method=btrim(_payment_method),
          supplier_payout_reference=btrim(_reference),
          supplier_payout_note=nullif(btrim(_note),''),
          updated_at=now()
      where order_item_id=_order_item_id
      returning * into r;
      backfilled:=true;

      insert into public.audit_log(actor_id,action,target_table,target_id,details)
      values(auth.uid(),'supplier_payout_evidence_backfilled','order_item_settlements',_order_item_id::text,
        jsonb_build_object('amount',r.supplier_net_amount,'method',_payment_method,'reference',_reference,'note',_note));
    end if;

    return jsonb_build_object(
      'order_item_id',_order_item_id,
      'supplier_payout_status','paid',
      'duplicate',true,
      'evidence_backfilled',backfilled,
      'method',r.supplier_payout_method,
      'reference',r.supplier_payout_reference
    );
  end if;

  if r.settlement_status<>'ready' or rem<>'remitted' or r.supplier_payout_status<>'pending' then
    raise exception 'Supplier payout is not ready';
  end if;

  update public.order_item_settlements
  set supplier_payout_status='paid',
      supplier_paid_at=now(),
      supplier_payout_method=btrim(_payment_method),
      supplier_payout_reference=btrim(_reference),
      supplier_payout_note=nullif(btrim(_note),''),
      updated_at=now()
  where order_item_id=_order_item_id
  returning * into r;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'supplier_payout_paid','order_item_settlements',_order_item_id::text,
    jsonb_build_object('amount',r.supplier_net_amount,'method',_payment_method,'reference',_reference,'note',_note));

  return jsonb_build_object(
    'order_item_id',_order_item_id,
    'supplier_payout_status','paid',
    'amount',r.supplier_net_amount,
    'method',r.supplier_payout_method,
    'reference',r.supplier_payout_reference
  );
end;
$function$;

create or replace function public.admin_record_dropshipper_payout(
  _order_item_id uuid,
  _payment_method text,
  _reference text,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  r public.order_item_settlements%rowtype;
  rem text;
  backfilled boolean:=false;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if nullif(btrim(_payment_method),'') is null then raise exception 'Payment method is required'; end if;
  if nullif(btrim(_reference),'') is null then raise exception 'Payment reference is required'; end if;

  select * into r
  from public.order_item_settlements
  where order_item_id=_order_item_id
  for update;
  if not found then raise exception 'Settlement item not found'; end if;

  select cod_remittance_status into rem
  from public.order_settlements
  where order_id=r.order_id;

  if r.dropshipper_payout_status='paid' then
    if r.dropshipper_payout_reference is null or r.dropshipper_payout_method is null then
      update public.order_item_settlements
      set dropshipper_payout_method=btrim(_payment_method),
          dropshipper_payout_reference=btrim(_reference),
          dropshipper_payout_note=nullif(btrim(_note),''),
          updated_at=now()
      where order_item_id=_order_item_id
      returning * into r;
      backfilled:=true;

      insert into public.audit_log(actor_id,action,target_table,target_id,details)
      values(auth.uid(),'dropshipper_payout_evidence_backfilled','order_item_settlements',_order_item_id::text,
        jsonb_build_object('amount',r.dropshipper_profit_amount,'method',_payment_method,'reference',_reference,'note',_note));
    end if;

    return jsonb_build_object(
      'order_item_id',_order_item_id,
      'dropshipper_payout_status','paid',
      'duplicate',true,
      'evidence_backfilled',backfilled,
      'method',r.dropshipper_payout_method,
      'reference',r.dropshipper_payout_reference
    );
  end if;

  if r.settlement_status<>'ready' or rem<>'remitted' or r.dropshipper_payout_status<>'pending' then
    raise exception 'Dropshipper payout is not ready';
  end if;

  update public.order_item_settlements
  set dropshipper_payout_status='paid',
      dropshipper_paid_at=now(),
      dropshipper_payout_method=btrim(_payment_method),
      dropshipper_payout_reference=btrim(_reference),
      dropshipper_payout_note=nullif(btrim(_note),''),
      updated_at=now()
  where order_item_id=_order_item_id
  returning * into r;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'dropshipper_payout_paid','order_item_settlements',_order_item_id::text,
    jsonb_build_object('amount',r.dropshipper_profit_amount,'method',_payment_method,'reference',_reference,'note',_note));

  return jsonb_build_object(
    'order_item_id',_order_item_id,
    'dropshipper_payout_status','paid',
    'amount',r.dropshipper_profit_amount,
    'method',r.dropshipper_payout_method,
    'reference',r.dropshipper_payout_reference
  );
end;
$function$;

create or replace function public.admin_resolve_payout_reversal(
  _order_item_id uuid,
  _party text,
  _resolution text,
  _reference text,
  _note text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  r public.order_item_settlements%rowtype;
  remaining integer;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _party not in ('supplier','dropshipper') then raise exception 'Party must be supplier or dropshipper'; end if;
  if _resolution not in ('recovered','offset','waived','other') then raise exception 'Invalid reversal resolution'; end if;
  if nullif(btrim(_reference),'') is null then raise exception 'Resolution reference is required'; end if;
  if nullif(btrim(_note),'') is null then raise exception 'Resolution note is required'; end if;

  select * into r
  from public.order_item_settlements
  where order_item_id=_order_item_id
  for update;
  if not found then raise exception 'Settlement item not found'; end if;

  perform 1 from public.order_settlements where order_id=r.order_id for update;

  if _party='supplier' then
    if r.supplier_payout_status<>'reversal_required' then raise exception 'Supplier reversal is not pending'; end if;

    update public.order_item_settlements
    set supplier_payout_status='blocked',
        supplier_reversal_resolution=_resolution,
        supplier_reversal_reference=btrim(_reference),
        supplier_reversal_note=btrim(_note),
        supplier_reversal_resolved_at=now(),
        updated_at=now()
    where order_item_id=_order_item_id;
  else
    if r.dropshipper_payout_status<>'reversal_required' then raise exception 'Dropshipper reversal is not pending'; end if;

    update public.order_item_settlements
    set dropshipper_payout_status='blocked',
        dropshipper_reversal_resolution=_resolution,
        dropshipper_reversal_reference=btrim(_reference),
        dropshipper_reversal_note=btrim(_note),
        dropshipper_reversal_resolved_at=now(),
        updated_at=now()
    where order_item_id=_order_item_id;
  end if;

  select count(*) into remaining
  from public.order_item_settlements
  where order_id=r.order_id
    and (supplier_payout_status='reversal_required' or dropshipper_payout_status='reversal_required');

  if remaining=0 then
    update public.order_settlements
    set cod_remittance_status='reversed',
        reversal_resolved_at=now(),
        reversal_resolution_reference=btrim(_reference),
        reversal_resolution_note=btrim(_note),
        updated_at=now()
    where order_id=r.order_id;
  end if;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'payout_reversal_resolved','order_item_settlements',_order_item_id::text,
    jsonb_build_object('party',_party,'resolution',_resolution,'reference',_reference,'note',_note,'order_id',r.order_id,'remaining_reversals',remaining));

  return jsonb_build_object(
    'order_item_id',_order_item_id,
    'order_id',r.order_id,
    'party',_party,
    'resolution',_resolution,
    'remaining_reversals',remaining,
    'order_reversal_status',case when remaining=0 then 'reversed' else 'reversal_required' end
  );
end;
$function$;

revoke all on function public.admin_record_supplier_payout(uuid,text,text,text) from public,anon;
grant execute on function public.admin_record_supplier_payout(uuid,text,text,text) to authenticated;
revoke all on function public.admin_record_dropshipper_payout(uuid,text,text,text) from public,anon;
grant execute on function public.admin_record_dropshipper_payout(uuid,text,text,text) to authenticated;
revoke all on function public.admin_resolve_payout_reversal(uuid,text,text,text,text) from public,anon;
grant execute on function public.admin_resolve_payout_reversal(uuid,text,text,text,text) to authenticated;

drop function if exists public.admin_settlements();

create function public.admin_settlements()
returns table(
  order_id uuid,
  order_item_id uuid,
  external_order_ref text,
  created_at timestamptz,
  order_status public.order_status,
  payment_status public.payment_status,
  settlement_status text,
  cod_remittance_status text,
  expected_cod_amount numeric,
  customer_collected_amount numeric,
  cod_remitted_amount numeric,
  remittance_difference numeric,
  remittance_reference text,
  remittance_note text,
  customer_shipping_fee_amount numeric,
  courier_cost_amount numeric,
  shipping_margin_amount numeric,
  reversal_resolved_at timestamptz,
  reversal_resolution_reference text,
  reversal_resolution_note text,
  supplier_name text,
  dropshipper_name text,
  supplier_gross_amount numeric,
  platform_commission_amount numeric,
  supplier_net_amount numeric,
  dropshipper_profit_amount numeric,
  supplier_payout_status text,
  dropshipper_payout_status text,
  supplier_paid_at timestamptz,
  dropshipper_paid_at timestamptz,
  supplier_payout_method text,
  supplier_payout_reference text,
  supplier_payout_note text,
  dropshipper_payout_method text,
  dropshipper_payout_reference text,
  dropshipper_payout_note text,
  supplier_reversal_resolution text,
  supplier_reversal_reference text,
  supplier_reversal_note text,
  supplier_reversal_resolved_at timestamptz,
  dropshipper_reversal_resolution text,
  dropshipper_reversal_reference text,
  dropshipper_reversal_note text,
  dropshipper_reversal_resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public','private'
as $function$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    o.id,
    i.order_item_id,
    o.external_order_ref,
    o.created_at,
    o.status,
    o.payment_status,
    os.settlement_status,
    os.cod_remittance_status,
    os.expected_cod_amount,
    os.customer_collected_amount,
    os.cod_remitted_amount,
    os.remittance_difference,
    os.remittance_reference,
    os.remittance_note,
    os.customer_shipping_fee_amount,
    os.courier_cost_amount,
    os.shipping_margin_amount,
    os.reversal_resolved_at,
    os.reversal_resolution_reference,
    os.reversal_resolution_note,
    s.business_name,
    d.business_name,
    i.supplier_gross_amount,
    i.platform_commission_amount,
    i.supplier_net_amount,
    i.dropshipper_profit_amount,
    i.supplier_payout_status,
    i.dropshipper_payout_status,
    i.supplier_paid_at,
    i.dropshipper_paid_at,
    i.supplier_payout_method,
    i.supplier_payout_reference,
    i.supplier_payout_note,
    i.dropshipper_payout_method,
    i.dropshipper_payout_reference,
    i.dropshipper_payout_note,
    i.supplier_reversal_resolution,
    i.supplier_reversal_reference,
    i.supplier_reversal_note,
    i.supplier_reversal_resolved_at,
    i.dropshipper_reversal_resolution,
    i.dropshipper_reversal_reference,
    i.dropshipper_reversal_note,
    i.dropshipper_reversal_resolved_at
  from public.order_item_settlements i
  join public.order_settlements os on os.order_id=i.order_id
  join public.orders o on o.id=i.order_id
  join public.suppliers s on s.id=i.supplier_id
  join public.dropshippers d on d.id=i.dropshipper_id
  order by o.created_at desc,i.order_item_id;
end;
$function$;

revoke all on function public.admin_settlements() from public,anon;
grant execute on function public.admin_settlements() to authenticated;
