-- Independent community sourcing. Normal catalog, variants, links and orders are untouched.
alter table public.product_requests add column description text, add column expected_quantity integer;
alter table public.product_requests add constraint sourcing_description_length check (description is null or length(description)<=5000),
 add constraint sourcing_expected_quantity check (expected_quantity is null or expected_quantity>0),
 add constraint sourcing_target_cost check (target_cost is null or target_cost>=0);
alter table public.product_requests drop constraint product_requests_status_check;
-- Legacy states remain valid for historical records; new requests use open/sourcing/sourced/closed/archived.
alter table public.product_requests add constraint product_requests_status_check check(status in ('open','sourcing','sourced','closed','archived','matched','accepted'));

create table public.sourcing_responses (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.product_requests(id) on delete cascade,
 supplier_id uuid not null references public.suppliers(id),
 status text not null default 'sourcing' check(status in ('sourcing','sourced','withdrawn')),
 supplier_price numeric(14,2) check(supplier_price>=0),
 recommended_retail numeric(14,2) check(recommended_retail>=0),
 estimated_margin numeric(14,2) generated always as (recommended_retail-supplier_price) stored,
 available_quantity integer check(available_quantity>=0),
 moq integer check(moq>0),
 lead_time_days integer check(lead_time_days>=0),
 origin_country text check(length(origin_country)<=120),
 image_url text check(image_url is null or image_url ~* '^https?://'),
 supplier_notes text check(length(supplier_notes)<=5000),
 sourcing_details text check(length(sourcing_details)<=5000),
 catalog_product_id uuid references public.supplier_products(id) on delete set null,
 sourced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(request_id,supplier_id),
 constraint sourced_final_information check(status<>'sourced' or (
 supplier_price is not null and recommended_retail is not null and lead_time_days is not null
 and image_url is not null and length(btrim(image_url))>0
 and supplier_notes is not null and length(btrim(supplier_notes))>0 and sourced_at is not null))
);
create index sourcing_responses_supplier on public.sourcing_responses(supplier_id);
create index sourcing_responses_catalog on public.sourcing_responses(catalog_product_id) where catalog_product_id is not null;
create table public.sourcing_comments (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.product_requests(id) on delete cascade,
 dropshipper_id uuid not null references public.dropshippers(id),
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index sourcing_comments_request on public.sourcing_comments(request_id,created_at);
create index sourcing_comments_author on public.sourcing_comments(dropshipper_id);
create table public.sourcing_request_interests (
 request_id uuid not null references public.product_requests(id) on delete cascade,
 dropshipper_id uuid not null references public.dropshippers(id),
 created_at timestamptz not null default now(),
 primary key(request_id,dropshipper_id)
);
create index sourcing_request_interests_dropshipper on public.sourcing_request_interests(dropshipper_id);
create table public.sourcing_response_interests (
 response_id uuid not null references public.sourcing_responses(id) on delete cascade,
 dropshipper_id uuid not null references public.dropshippers(id),
 created_at timestamptz not null default now(),
 primary key(response_id,dropshipper_id)
);
create index sourcing_response_interests_dropshipper on public.sourcing_response_interests(dropshipper_id);

create function private.sourcing_dropshipper() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.dropshippers where profile_id=auth.uid() and status='active' limit 1;
$$;
create function private.sourcing_supplier() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.suppliers where profile_id=auth.uid() and status='approved' limit 1;
$$;
create function private.sourcing_member() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.sourcing_dropshipper() is not null or private.sourcing_supplier() is not null or private.has_role(auth.uid(),'admin'::public.app_role));
$$;
create function private.sourcing_supplier_name(_id uuid) returns text language sql stable security definer set search_path='' as $$
 select case when business_name like '%@%' or btrim(business_name)='' then 'IzzyDrop Supplier' else business_name end
 from public.suppliers where id=_id and private.sourcing_member();
$$;
create function private.sourcing_supplier_approved(_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.suppliers where id=_id and status='approved');
$$;
create function private.sourcing_catalog_slug(_id uuid) returns text language sql stable security definer set search_path='' as $$
 select p.public_slug from public.supplier_products p join public.suppliers s on s.id=p.supplier_id
 where p.id=_id and p.status='active' and s.status='approved' and private.sourcing_member();
$$;

-- Replace recursive legacy access rules with member reads and admin-only direct writes.
do $$ declare p record; begin
 for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('product_requests','product_request_quotes')
 loop execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['product_requests','product_request_quotes','sourcing_responses','sourcing_comments','sourcing_request_interests','sourcing_response_interests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy sourcing_admin on public.%I for all to authenticated using (private.has_role((select auth.uid()),''admin''::public.app_role)) with check (private.has_role((select auth.uid()),''admin''::public.app_role))',t);
 end loop;
end $$;
create policy sourcing_board_read on public.product_requests for select to authenticated using ((select private.sourcing_member()));
create policy sourcing_response_read on public.sourcing_responses for select to authenticated using (
 (select private.sourcing_member()) and (private.sourcing_supplier_approved(supplier_id) or supplier_id=(select private.sourcing_supplier())));
create policy sourcing_comment_read on public.sourcing_comments for select to authenticated using ((select private.sourcing_member()));
create policy sourcing_request_demand_read on public.sourcing_request_interests for select to authenticated using ((select private.sourcing_member()));
create policy sourcing_response_demand_read on public.sourcing_response_interests for select to authenticated using ((select private.sourcing_member()));
create policy sourcing_legacy_quote_read on public.product_request_quotes for select to authenticated using (
 private.is_product_request_owner(request_id) or supplier_id=(select private.sourcing_supplier()));

-- Extend the existing alert system; deduplication is enforced by a unique index, including after read.
alter table public.dropshipper_alerts drop constraint dropshipper_alerts_alert_type_check;
alter table public.dropshipper_alerts add constraint dropshipper_alerts_alert_type_check
 check(alert_type in ('low_stock','out_of_stock','price_change','sourcing_sourced','sourcing_available'));
alter table public.dropshipper_alerts add column sourcing_response_id uuid references public.sourcing_responses(id) on delete cascade;
create unique index sourcing_alert_once on public.dropshipper_alerts(dropshipper_id,sourcing_response_id,alert_type) where sourcing_response_id is not null;

create function private.sourcing_notify(_id uuid, _type text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.dropshipper_alerts(dropshipper_id,supplier_product_id,alert_type,title,message,metadata,sourcing_response_id)
 select d.id,case when _type='sourcing_available' then o.catalog_product_id else null end,_type,
 case when _type='sourcing_available' then 'Sourced product is available to sell' else 'Your requested product has been sourced' end,
 r.title||case when _type='sourcing_available' then ' is now published in Products.' else ' has been sourced. Review the supplier offer and lead time.' end,
 jsonb_build_object('request_id',r.id,'response_id',o.id,'view','sourced','catalog_product_id',o.catalog_product_id),o.id
 from public.sourcing_responses o join public.product_requests r on r.id=o.request_id
 join public.dropshippers d on d.status='active' and (
 d.id=r.dropshipper_id or exists(select 1 from public.sourcing_request_interests i where i.request_id=r.id and i.dropshipper_id=d.id)
 or exists(select 1 from public.sourcing_response_interests i where i.response_id=o.id and i.dropshipper_id=d.id))
 where o.id=_id and o.status='sourced' and private.sourcing_supplier_approved(o.supplier_id)
 and (_type='sourcing_sourced' or (_type='sourcing_available' and exists(select 1 from public.supplier_products p where p.id=o.catalog_product_id and p.supplier_id=o.supplier_id and p.status='active')))
 on conflict(dropshipper_id,sourcing_response_id,alert_type) where sourcing_response_id is not null do nothing;
end $$;
-- Aggregate status derives from all supplier responses; one supplier never closes another's work.
create function private.sourcing_sync_request(_id uuid) returns void language sql security definer set search_path='' as $$
 update public.product_requests r set status=case
 when exists(select 1 from public.sourcing_responses o where o.request_id=r.id and o.status='sourced') then 'sourced'
 when exists(select 1 from public.sourcing_responses o where o.request_id=r.id and o.status='sourcing') then 'sourcing'
 else 'open' end, updated_at=now()
 where r.id=_id and r.status not in ('closed','archived','accepted','matched');
$$;

-- Guarded write implementation, private schema; public endpoints below are invoker wrappers.
create function private.sourcing_create_request(_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare did uuid:=private.sourcing_dropshipper(); rid uuid;
begin
 if did is null then raise exception 'Active dropshipper required'; end if;
 if length(btrim(coalesce(_data->>'title',''))) not between 3 and 200 then raise exception 'Product title must be 3–200 characters'; end if;
 if length(btrim(coalesce(_data->>'description',''))) not between 1 and 5000 then raise exception 'Describe the product requirements'; end if;
 if nullif(_data->>'source_url','') is not null and not (_data->>'source_url' ~* '^https?://') then raise exception 'Use an http or https product link'; end if;
 if nullif(_data->>'image_url','') is not null and not (_data->>'image_url' ~* '^https?://') then raise exception 'Use an http or https image link'; end if;
 if length(coalesce(_data->>'notes',''))>5000 then raise exception 'Notes too long'; end if;
 insert into public.product_requests(dropshipper_id,title,description,source_url,image_url,notes,target_cost,expected_quantity,status)
 values(did,btrim(_data->>'title'),btrim(_data->>'description'),nullif(_data->>'source_url',''),nullif(_data->>'image_url',''),
 nullif(_data->>'notes',''),nullif(_data->>'target_cost','')::numeric,nullif(_data->>'expected_quantity','')::integer,'open') returning id into rid;
 return rid;
end $$;
create function private.sourcing_comment(_request_id uuid,_body text,_comment_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare did uuid:=private.sourcing_dropshipper(); cid uuid;
begin
 if did is null then raise exception 'Active dropshipper required'; end if;
 perform 1 from public.product_requests where id=_request_id and status not in ('closed','archived') for update;
 if not found then raise exception 'Request is closed or unavailable'; end if;
 if _comment_id is null then
 insert into public.sourcing_comments(request_id,dropshipper_id,body) values(_request_id,did,btrim(_body)) returning id into cid;
 else
 update public.sourcing_comments set body=btrim(_body) where id=_comment_id and request_id=_request_id and dropshipper_id=did returning id into cid;
 if cid is null then raise exception 'You may only edit your own comments'; end if;
 end if;
 return cid;
end $$;
create function private.sourcing_interest(_request_id uuid default null,_response_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare did uuid:=private.sourcing_dropshipper(); rid uuid; n int;
begin
 if did is null then raise exception 'Active dropshipper required'; end if;
 if (_request_id is null)=(_response_id is null) then raise exception 'Choose one request or sourced offer'; end if;
 if _response_id is not null then
 select request_id into rid from public.sourcing_responses where id=_response_id and status='sourced' and private.sourcing_supplier_approved(supplier_id);
 if rid is null then raise exception 'Sourced offer unavailable'; end if;
 else rid:=_request_id; end if;
 -- Same lock as completion: interest cannot slip between audience selection and completion.
 perform 1 from public.product_requests where id=rid and status not in ('closed','archived') for update;
 if not found then raise exception 'Request is closed or unavailable'; end if;
 insert into public.sourcing_request_interests(request_id,dropshipper_id) values(rid,did) on conflict do nothing;
 if _response_id is not null then
 insert into public.sourcing_response_interests(response_id,dropshipper_id) values(_response_id,did) on conflict do nothing;
 end if;
 select count(*) into n from public.sourcing_request_interests where request_id=rid;
 return jsonb_build_object('request_id',rid,'response_id',_response_id,'interested',true,'interest_count',n);
end $$;
create function private.sourcing_start(_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.sourcing_supplier(); oid uuid;
begin
 if sid is null then raise exception 'Approved supplier required'; end if;
 perform 1 from public.product_requests where id=_request_id and status in ('open','sourcing','sourced') for update;
 if not found then raise exception 'Request is closed or unavailable'; end if;
 insert into public.sourcing_responses(request_id,supplier_id) values(_request_id,sid)
 on conflict(request_id,supplier_id) do update set updated_at=public.sourcing_responses.updated_at returning id into oid;
 perform private.sourcing_sync_request(_request_id);
 return oid;
end $$;
create function private.sourcing_save_response(_response_id uuid,_data jsonb,_mark_sourced boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.sourcing_supplier(); rid uuid; old_status text;
begin
 if sid is null then raise exception 'Approved supplier required'; end if;
 select request_id into rid from public.sourcing_responses where id=_response_id and supplier_id=sid;
 if rid is null then raise exception 'You may only change your own sourcing response'; end if;
 perform 1 from public.product_requests where id=rid and status in ('open','sourcing','sourced') for update;
 if not found then raise exception 'Request is closed or unavailable'; end if;
 select status into old_status from public.sourcing_responses where id=_response_id for update;
 if old_status='withdrawn' then raise exception 'Withdrawn response is unavailable'; end if;
 update public.sourcing_responses set
 supplier_price=nullif(_data->>'supplier_price','')::numeric,
 recommended_retail=nullif(_data->>'recommended_retail','')::numeric,
 available_quantity=nullif(_data->>'available_quantity','')::integer,
 moq=nullif(_data->>'moq','')::integer,
 lead_time_days=nullif(_data->>'lead_time_days','')::integer,
 origin_country=nullif(btrim(_data->>'origin_country'),''),
 image_url=nullif(btrim(_data->>'image_url'),''),
 supplier_notes=nullif(btrim(_data->>'supplier_notes'),''),
 sourcing_details=nullif(btrim(_data->>'sourcing_details'),''),
 status=case when _mark_sourced or old_status='sourced' then 'sourced' else 'sourcing' end,
 sourced_at=case when _mark_sourced then coalesce(sourced_at,now()) else sourced_at end,updated_at=now()
 where id=_response_id;
 perform private.sourcing_sync_request(rid);
 if _mark_sourced then perform private.sourcing_notify(_response_id,'sourcing_sourced'); end if;
 return _response_id;
end $$;
create function private.sourcing_close_request(_request_id uuid,_archive boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(auth.uid(),'admin'::public.app_role) and private.sourcing_dropshipper() is null then raise exception 'Active dropshipper required'; end if;
 update public.product_requests set status=case when _archive then 'archived' else 'closed' end,updated_at=now()
 where id=_request_id and (dropshipper_id=private.sourcing_dropshipper() or private.has_role(auth.uid(),'admin'::public.app_role));
 if not found then raise exception 'You may only close your own request'; end if;
end $$;
create function private.sourcing_link_catalog(_response_id uuid,_product_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.sourcing_supplier();
begin
 if sid is null then raise exception 'Approved supplier required'; end if;
 perform 1 from public.sourcing_responses where id=_response_id and supplier_id=sid and status='sourced' for update;
 if not found then raise exception 'Your sourced response is required'; end if;
 if not exists(select 1 from public.supplier_products where id=_product_id and supplier_id=sid) then raise exception 'Choose your own published or draft product'; end if;
 if exists(select 1 from public.sourcing_responses where id=_response_id and catalog_product_id is not null and catalog_product_id<>_product_id) then raise exception 'Catalog relationship already exists'; end if;
 update public.sourcing_responses set catalog_product_id=_product_id,updated_at=now() where id=_response_id;
 perform private.sourcing_notify(_response_id,'sourcing_available');
end $$;
create function private.sourcing_catalog_published() returns trigger language plpgsql security definer set search_path='' as $$
declare o record;
begin
 if new.status='active' and old.status is distinct from new.status then
 for o in select id from public.sourcing_responses where catalog_product_id=new.id and supplier_id=new.supplier_id and status='sourced' loop
 perform private.sourcing_notify(o.id,'sourcing_available');
 end loop; end if;
 return new;
end $$;
create trigger sourcing_catalog_publication after update of status on public.supplier_products
 for each row execute function private.sourcing_catalog_published();

create function public.sourcing_create_request(_data jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.sourcing_create_request(_data); $$;
create function public.sourcing_comment(_request_id uuid,_body text,_comment_id uuid default null) returns uuid language sql security invoker set search_path='' as $$ select private.sourcing_comment(_request_id,_body,_comment_id); $$;
create function public.sourcing_interest(_request_id uuid default null,_response_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.sourcing_interest(_request_id,_response_id); $$;
create function public.sourcing_start(_request_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.sourcing_start(_request_id); $$;
create function public.sourcing_save_response(_response_id uuid,_data jsonb,_mark_sourced boolean default false) returns uuid language sql security invoker set search_path='' as $$ select private.sourcing_save_response(_response_id,_data,_mark_sourced); $$;
create function public.sourcing_close_request(_request_id uuid,_archive boolean default false) returns void language sql security invoker set search_path='' as $$ select private.sourcing_close_request(_request_id,_archive); $$;
create function public.sourcing_link_catalog(_response_id uuid,_product_id uuid) returns void language sql security invoker set search_path='' as $$ select private.sourcing_link_catalog(_response_id,_product_id); $$;

-- Read endpoint runs as caller: underlying tables are governed by RLS.
create function public.sourcing_board() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object(
 'is_mine',r.dropshipper_id=private.sourcing_dropshipper(),
 'interest_count',(select count(*) from public.sourcing_request_interests i where i.request_id=r.id),
 'interested',exists(select 1 from public.sourcing_request_interests i where i.request_id=r.id and i.dropshipper_id=private.sourcing_dropshipper())
 ) order by r.created_at desc) from public.product_requests r),'[]'::jsonb),
 'responses',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object(
 'supplier_name',private.sourcing_supplier_name(o.supplier_id),
 'is_mine',o.supplier_id=private.sourcing_supplier(),
 'catalog_slug',private.sourcing_catalog_slug(o.catalog_product_id),
 'interest_count',(select count(*) from public.sourcing_response_interests i where i.response_id=o.id),
 'interested',exists(select 1 from public.sourcing_response_interests i where i.response_id=o.id and i.dropshipper_id=private.sourcing_dropshipper())
 ) order by o.created_at desc) from public.sourcing_responses o),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('is_mine',c.dropshipper_id=private.sourcing_dropshipper()) order by c.created_at) from public.sourcing_comments c),'[]'::jsonb));
$$;

-- Old matching functions are intentionally disabled, not repurposed to silently mutate links.
create or replace function public.accept_product_request_quote(_quote_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin raise exception 'Catalog quote acceptance is retired. Use Sourcing Requests and Sourced Products.'; end $$;
create or replace function public.submit_product_request_quote(_request_id uuid,_offered_cost numeric,_available_quantity integer default null,_lead_time_days integer default null,_message text default null,_product_id uuid default null,_variant_id uuid default null)
 returns uuid language plpgsql security invoker set search_path='' as $$
begin raise exception 'Catalog matching is retired. Start an independent sourcing response.'; end $$;
create or replace function public.create_product_request(_title text,_source_url text default null,_image_url text default null,_notes text default null,_target_cost numeric default null)
 returns uuid language sql security invoker set search_path='' as $$
 select private.sourcing_create_request(jsonb_build_object('title',_title,'description',coalesce(nullif(_notes,''),_title),'source_url',_source_url,'image_url',_image_url,'notes',_notes,'target_cost',_target_cost));
$$;

-- Revoke default PUBLIC/anon function execution; grant exactly the member API and policy helpers.
do $$ declare f record; begin
 for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname like 'sourcing_%'
 loop
 execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',f.nspname,f.proname,f.args);
 if f.proname not in ('sourcing_notify','sourcing_sync_request','sourcing_catalog_published') then
 execute format('grant execute on function %I.%I(%s) to authenticated',f.nspname,f.proname,f.args); end if;
 end loop;
end $$;
revoke all on function public.create_product_request(text,text,text,text,numeric) from public,anon;
grant execute on function public.create_product_request(text,text,text,text,numeric) to authenticated;
revoke all on function public.accept_product_request_quote(uuid) from public,anon,authenticated;
revoke all on function public.submit_product_request_quote(uuid,numeric,integer,integer,text,uuid,uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
