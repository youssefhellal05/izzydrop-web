begin;
create or replace function public.prevent_supplier_admin_block_bypass()
returns trigger language plpgsql security invoker
set search_path='public','private' as $$
declare uid uuid:=auth.uid();
begin
  if old.admin_blocked
     and (new.status is distinct from old.status or new.admin_blocked is distinct from old.admin_blocked)
     and (uid is null or not private.has_role(uid,'admin'::public.app_role))
     and current_user <> 'service_role' then
    raise exception 'Product is blocked by IzzyDrop administration';
  end if;
  return new;
end; $$;
revoke all on function public.prevent_supplier_admin_block_bypass() from public,anon,authenticated;
commit;
