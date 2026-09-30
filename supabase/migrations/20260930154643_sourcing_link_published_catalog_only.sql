-- Sourcing records progress and links products; normal catalog creation remains unchanged.
alter table public.sourcing_responses drop constraint if exists sourced_final_information;

create or replace function private.sourcing_catalog_product(_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('id',p.id,'name',p.name,'public_slug',p.public_slug,'currency',p.currency,
 'image_url',coalesce((select i.url from public.product_images i where i.product_id=p.id order by i.position,i.created_at limit 1),
 (select v.variant_image_url from public.product_variants v where v.product_id=p.id and v.is_enabled and v.variant_image_url is not null order by v.created_at,v.id limit 1)),
 'variants',(select jsonb_agg(jsonb_build_object('id',v.id,'name',v.variant_name,'options',v.option_values,
 'image_url',v.variant_image_url,'supplier_price',coalesce(v.cost_price,p.cost_price),
 'suggested_retail',coalesce(v.suggested_retail_price,p.suggested_retail_price),'stock',v.stock_quantity) order by v.created_at,v.id)
 from public.product_variants v where v.product_id=p.id and v.is_enabled))
from public.supplier_products p join public.suppliers s on s.id=p.supplier_id
where p.id=_id and p.status='active' and s.status='approved' and private.sourcing_member()
and exists(select 1 from public.product_variants v where v.product_id=p.id and v.is_enabled
 and coalesce(v.cost_price,p.cost_price)>=0 and v.stock_quantity>=0)
and not exists(select 1 from public.product_variants v where v.product_id=p.id and v.is_enabled
 and (coalesce(v.cost_price,p.cost_price) is null or coalesce(v.cost_price,p.cost_price)<0 or v.stock_quantity is null or v.stock_quantity<0));
$$;
revoke all on function private.sourcing_catalog_product(uuid) from public,anon;
grant execute on function private.sourcing_catalog_product(uuid) to authenticated;

create or replace function private.sourcing_eligible_products() returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(product order by product->>'name'),'[]'::jsonb)
from (select private.sourcing_catalog_product(p.id) product from public.supplier_products p
 where p.supplier_id=private.sourcing_supplier()) x where product is not null;
$$;
revoke all on function private.sourcing_eligible_products() from public,anon;
grant execute on function private.sourcing_eligible_products() to authenticated;

-- Old clients fail safely: no response field can manufacture catalog/variant/stock rows.
create or replace function private.sourcing_save_response(_response_id uuid,_data jsonb,_mark_sourced boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Create and publish the product in Products, then use Link sourced product on your sourcing response.';
end $$;
drop trigger if exists sourcing_catalog_publication on public.supplier_products;
drop function if exists private.sourcing_catalog_published();
drop function if exists private.sourcing_publish_catalog(uuid);

create or replace function private.sourcing_validate_link() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Do not rewrite legacy records, or obstruct normal ON DELETE SET NULL catalog cleanup.
 if (tg_op='INSERT' and (new.status='sourced' or new.catalog_product_id is not null))
 or (tg_op='UPDATE' and ((new.status='sourced' and old.status is distinct from new.status)
 or (new.catalog_product_id is not null and old.catalog_product_id is distinct from new.catalog_product_id))) then
   if new.status<>'sourced' or new.catalog_product_id is null or new.sourced_at is null then
     raise exception 'Sourced requires a linked published product';
   end if;
   if not exists(select 1 from public.supplier_products p join public.suppliers s on s.id=p.supplier_id
    where p.id=new.catalog_product_id and p.supplier_id=new.supplier_id and p.status='active' and s.status='approved')
    or not exists(select 1 from public.product_variants v join public.supplier_products p on p.id=v.product_id
      where v.product_id=new.catalog_product_id and v.is_enabled and coalesce(v.cost_price,p.cost_price)>=0 and v.stock_quantity>=0)
    then raise exception 'Choose this supplier''s active published product with valid enabled variants'; end if;
 end if;
 return new;
end $$;
revoke all on function private.sourcing_validate_link() from public,anon,authenticated;
create trigger sourcing_validate_link before insert or update on public.sourcing_responses
for each row execute function private.sourcing_validate_link();

create or replace function private.sourcing_link_catalog(_response_id uuid,_product_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.sourcing_supplier(); o public.sourcing_responses; rid uuid;
begin
 if sid is null then raise exception 'Approved supplier required'; end if;
 select request_id into rid from public.sourcing_responses where id=_response_id and supplier_id=sid;
 if rid is null then raise exception 'Your sourcing response is required'; end if;
 -- Same lock order as Start sourcing/interest, so independent suppliers serialize only this request.
 perform 1 from public.product_requests where id=rid and status in ('open','sourcing','sourced') for update;
 if not found then raise exception 'Request is closed or unavailable'; end if;
 select * into o from public.sourcing_responses where id=_response_id and supplier_id=sid for update;
 if o.status not in ('sourcing','sourced') then raise exception 'Start sourcing first'; end if;
 if _product_id is null then raise exception 'Choose your published product'; end if;
 perform 1 from public.supplier_products where id=_product_id and supplier_id=sid and status='active' for share;
 if not found then raise exception 'Choose your own active published product'; end if;
 perform 1 from public.product_variants where product_id=_product_id and is_enabled for share;
 if private.sourcing_catalog_product(_product_id) is null then raise exception 'Product requires valid enabled variants'; end if;
 if o.catalog_product_id is not null and o.catalog_product_id<>_product_id then raise exception 'This response already links a product'; end if;
 if o.catalog_product_id=_product_id and o.status='sourced' then return; end if;
 update public.sourcing_responses set status='sourced',catalog_product_id=_product_id,
 sourced_at=coalesce(sourced_at,now()),updated_at=now() where id=_response_id;
 perform private.sourcing_sync_request(rid);
 perform private.sourcing_notify(_response_id,'sourcing_available');
end $$;

CREATE OR REPLACE FUNCTION private.sourcing_notify(_id uuid, _type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 insert into public.dropshipper_alerts(
   dropshipper_id,
   supplier_product_id,
   alert_type,
   title,
   message,
   metadata,
   sourcing_response_id
 )
 select
   d.id,
   o.catalog_product_id,
   _type,
   case
     when _type='sourcing_available' then 'Sourced product is available to sell'
     else 'Your requested product has been sourced'
   end,
   'A supplier sourced ' || r.title || '. It is now available in Products.',
   jsonb_build_object(
     'request_id',r.id,
     'response_id',o.id,
     'view','sourced',
     'catalog_product_id',o.catalog_product_id
   ),
   o.id
 from public.sourcing_responses o
 join public.product_requests r on r.id=o.request_id
 join public.dropshippers d
   on d.status='active'
  and (
    d.id=r.dropshipper_id
    or exists(
      select 1
      from public.sourcing_request_interests i
      where i.request_id=r.id and i.dropshipper_id=d.id
    )
    or exists(
      select 1
      from public.sourcing_response_interests i
      where i.response_id=o.id and i.dropshipper_id=d.id
    )
  )
 where o.id=_id
   and o.status='sourced'
   and private.sourcing_supplier_approved(o.supplier_id)
   and _type='sourcing_available'
   and private.sourcing_catalog_product(o.catalog_product_id) is not null
 on conflict(dropshipper_id,sourcing_response_id,alert_type)
 where sourcing_response_id is not null
 do nothing;
end;
$function$;


CREATE OR REPLACE FUNCTION public.sourcing_board()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
 'eligible_products',private.sourcing_eligible_products(),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object(
 'is_mine',r.dropshipper_id=private.sourcing_dropshipper(),
 'interest_count',(select count(*) from public.sourcing_request_interests i where i.request_id=r.id),
 'interested',exists(select 1 from public.sourcing_request_interests i where i.request_id=r.id and i.dropshipper_id=private.sourcing_dropshipper())
 ) order by r.created_at desc) from public.product_requests r),'[]'::jsonb),
 'responses',coalesce((select jsonb_agg((to_jsonb(o)-array['supplier_price','recommended_retail','estimated_margin','available_quantity','moq','lead_time_days','origin_country','image_url','supplier_notes','sourcing_details'])||jsonb_build_object(
 'supplier_name',private.sourcing_supplier_name(o.supplier_id),
 'is_mine',o.supplier_id=private.sourcing_supplier(),
 'catalog_slug',private.sourcing_catalog_slug(o.catalog_product_id),
 'catalog_product',private.sourcing_catalog_product(o.catalog_product_id),
 'interest_count',(select count(*) from public.sourcing_response_interests i where i.response_id=o.id),
 'interested',exists(select 1 from public.sourcing_response_interests i where i.response_id=o.id and i.dropshipper_id=private.sourcing_dropshipper())
 ) order by o.created_at desc) from public.sourcing_responses o),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('is_mine',c.dropshipper_id=private.sourcing_dropshipper()) order by c.created_at) from public.sourcing_comments c),'[]'::jsonb));
$function$;

comment on column public.sourcing_responses.catalog_product_id is 'Real product created/published through the normal supplier flow, explicitly linked by its owner. Never auto-created by sourcing.';
comment on function private.sourcing_save_response(uuid,jsonb,boolean) is 'Deprecated: sourcing commercial forms and automatic publication are disabled. Use sourcing_link_catalog.';
notify pgrst,'reload schema';
