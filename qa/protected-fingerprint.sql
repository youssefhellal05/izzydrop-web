select jsonb_object_agg(name, jsonb_build_object('count',n,'hash',hash)) from (
select 'supplier_products' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) hash from public.supplier_products t union all
select 'product_variants',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.product_variants t union all
select 'product_images',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.product_images t union all
select 'orders',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.orders t union all
select 'order_items',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.order_items t union all
select 'order_settlements',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by order_id),'')) from public.order_settlements t union all
select 'order_item_settlements',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by order_item_id),'')) from public.order_item_settlements t union all
select 'supplier_payout_details',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by supplier_id),'')) from public.supplier_payout_details t union all
select 'suppliers',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.suppliers t union all
select 'dropshippers',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.dropshippers t union all
select 'storefront_integrations',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.storefront_integrations t union all
select 'storefront_integration_variants',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from public.storefront_integration_variants t union all
select 'dropshipper_product_links_except_verified_qa',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.dropshipper_product_links t where id<>'9cd7581d-a397-4330-9109-ca0469870082'
) fingerprints;
