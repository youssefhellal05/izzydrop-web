begin;
create policy "manual order requests are internal only" on public.manual_order_requests
for all to anon,authenticated using (false) with check (false);
commit;
