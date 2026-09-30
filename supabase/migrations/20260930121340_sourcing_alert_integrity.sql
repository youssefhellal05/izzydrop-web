-- Sourcing-only alert integrity: reading an alert cannot erase its deduplication identity.
create index sourcing_alert_response_fk on public.dropshipper_alerts(sourcing_response_id) where sourcing_response_id is not null;
create function private.sourcing_protect_alert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not private.has_role(auth.uid(),'admin'::public.app_role)
 and (old.sourcing_response_id is not null or new.sourcing_response_id is not null)
 and (to_jsonb(new)-'read_at') is distinct from (to_jsonb(old)-'read_at') then
 raise exception 'Sourcing alerts may only be marked read';
 end if;
 return new;
end $$;
revoke all on function private.sourcing_protect_alert() from public,anon,authenticated;
create trigger sourcing_alert_identity before update on public.dropshipper_alerts for each row execute function private.sourcing_protect_alert();
-- Historical quotes remain in storage for admin/history. The catalog-matching read API is retired.
revoke all on function public.dropshipper_sourcing_quotes() from public,anon,authenticated;
notify pgrst,'reload schema';
