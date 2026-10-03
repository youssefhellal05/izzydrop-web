create or replace function public.admin_add_cod_remittance_evidence(
  _order_id uuid,
  _reference text,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  os public.order_settlements%rowtype;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if nullif(btrim(_reference),'') is null then
    raise exception 'Remittance reference is required';
  end if;

  select * into os
  from public.order_settlements
  where order_id=_order_id
  for update;
  if not found then raise exception 'Settlement not found'; end if;

  if os.cod_remittance_status not in ('remitted','reversal_required','reversed') then
    raise exception 'COD remittance has not been fully recorded';
  end if;

  update public.order_settlements
  set remittance_reference=btrim(_reference),
      remittance_note=coalesce(nullif(btrim(_note),''),remittance_note),
      updated_at=now()
  where order_id=_order_id
  returning * into os;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'cod_remittance_evidence_updated','order_settlements',_order_id::text,
    jsonb_build_object('reference',_reference,'note',_note,'status',os.cod_remittance_status));

  return jsonb_build_object(
    'order_id',_order_id,
    'cod_remittance_status',os.cod_remittance_status,
    'reference',os.remittance_reference,
    'note',os.remittance_note
  );
end;
$function$;

revoke all on function public.admin_add_cod_remittance_evidence(uuid,text,text) from public,anon;
grant execute on function public.admin_add_cod_remittance_evidence(uuid,text,text) to authenticated;
