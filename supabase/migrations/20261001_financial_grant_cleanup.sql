begin;
-- These are signed-in operational/accounting APIs. Their bodies retain
-- ownership/admin checks; anon should not reach them at all.
revoke all on function public.admin_settlements() from public,anon;
grant execute on function public.admin_settlements() to authenticated,service_role;
revoke all on function public.dropshipper_settlements() from public,anon;
grant execute on function public.dropshipper_settlements() to authenticated,service_role;
revoke all on function public.supplier_settlements() from public,anon;
grant execute on function public.supplier_settlements() to authenticated,service_role;
revoke all on function public.dropshipper_cancel_order(uuid) from public,anon;
grant execute on function public.dropshipper_cancel_order(uuid) to authenticated,service_role;
revoke all on function public.supplier_receive_return(uuid,text) from public,anon;
grant execute on function public.supplier_receive_return(uuid,text) to authenticated,service_role;
revoke all on function public.link_product_to_web(uuid,numeric) from public,anon;
grant execute on function public.link_product_to_web(uuid,numeric) to authenticated,service_role;
commit;
