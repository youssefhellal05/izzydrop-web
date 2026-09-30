-- Transactional production RPC/RLS QA. Creates only rollback-scoped records.
begin;
create temporary table qa_results(label text primary key,detail jsonb);
grant all on qa_results to authenticated;
create function pg_temp.qa_assert(label text,ok boolean,detail jsonb default '{}'::jsonb) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'QA FAILED: % %',label,detail; end if;
insert into qa_results values(label,detail||'{"result":"PASS"}'); end $$;
create function pg_temp.qa_denied(label text,statement text) returns void language plpgsql as $$
declare rejected boolean:=false; msg text; begin
begin execute statement; exception when others then rejected:=true; msg:=sqlerrm; end;
perform pg_temp.qa_assert(label,rejected,jsonb_build_object('error',msg));
end $$;
select set_config('qa.orders',(select count(*)::text from public.orders),true);
select set_config('qa.links',(select count(*)::text from public.dropshipper_product_links),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7bca2af4-5d9e-413a-a0c7-ea69fb82e958","role":"authenticated"}',true);

do $$ declare rid uuid; begin
rid:=public.sourcing_create_request('{"title":"QA ROLLBACK Catalog Link Beacon 2026-09-30","description":"FAKE test only; rollback, do not fulfill.","image_url":"https://example.com/qa.png","source_url":"https://example.com/reference","target_cost":100,"expected_quantity":42}');
perform set_config('qa.request',rid::text,true);
perform pg_temp.qa_assert('Active dropshipper creates community request',exists(select 1 from product_requests where id=rid and status='open' and expected_quantity=42));
perform pg_temp.qa_denied('Dropshipper cannot start sourcing',format('select sourcing_start(%L)',rid));
end $$;
select set_config('request.jwt.claims','{"sub":"d495f242-8589-4e16-94cf-765a8002a568","role":"authenticated"}',true);

do $$ declare rid uuid:=current_setting('qa.request')::uuid; cid uuid; begin
perform pg_temp.qa_assert('Second active dropshipper views request',exists(select 1 from product_requests where id=rid));
cid:=sourcing_comment(rid,'QA community demand');
perform set_config('qa.comment',cid::text,true);
perform sourcing_interest(rid,null);perform sourcing_interest(rid,null);
perform pg_temp.qa_assert('Community comments and deduplicated interest',(select count(*)=1 from sourcing_request_interests where request_id=rid) and exists(select 1 from sourcing_comments where id=cid));
end $$;
select set_config('request.jwt.claims','{"sub":"28bb8582-65ac-4c72-a34f-c85e245d35ea","role":"authenticated"}',true);

do $$ declare rid uuid:=current_setting('qa.request')::uuid; oid uuid; p jsonb; begin
oid:=sourcing_start(rid);perform set_config('qa.a',oid::text,true);
perform pg_temp.qa_assert('Supplier A starts without price/product/stock',exists(select 1 from sourcing_responses where id=oid and status='sourcing' and supplier_price is null and catalog_product_id is null));
perform pg_temp.qa_assert('Start sourcing is idempotent',sourcing_start(rid)=oid);
perform pg_temp.qa_denied('Old automatic Mark Sourced disabled',format('select sourcing_save_response(%L,%L,true)',oid,'{"supplier_price":100,"recommended_retail":200,"available_quantity":30}'));
perform pg_temp.qa_denied('Cannot source without real product',format('select sourcing_link_catalog(%L,null)',oid));
p:=supplier_create_product_v2(_name_en=>'QA ROLLBACK Beacon A',_cost=>100,_retail=>150,_variants=>'[{"name":"Small","cost":100,"retail":150,"stock":12},{"name":"Large","cost":120,"retail":180,"stock":8},{"name":"Disabled","cost":1,"retail":2,"stock":99,"enabled":false}]');
perform set_config('qa.pa',p->>'product_id',true);
perform pg_temp.qa_assert('Normal supplier flow creates multiple published variants',(p->>'variant_count')::int=3 and p->>'status'='active');
end $$;
select set_config('request.jwt.claims','{"sub":"a268b093-ce46-4532-9152-a0dd21b5aa16","role":"authenticated"}',true);

do $$ declare oid uuid; p jsonb; begin
oid:=sourcing_start(current_setting('qa.request')::uuid);perform set_config('qa.b',oid::text,true);
perform pg_temp.qa_assert('Supplier B independently starts',oid<>current_setting('qa.a')::uuid and exists(select 1 from sourcing_responses where id=oid and status='sourcing'));
p:=supplier_create_product_v2(_name_en=>'QA ROLLBACK Beacon B',_cost=>90,_retail=>160,_variants=>'[{"name":"Alternative","cost":90,"retail":160,"stock":7}]');
perform set_config('qa.pb',p->>'product_id',true);
perform pg_temp.qa_denied('Supplier B cannot complete A response',format('select sourcing_link_catalog(%L,%L)',current_setting('qa.a'),current_setting('qa.pb')));
end $$;
select set_config('request.jwt.claims','{"sub":"28bb8582-65ac-4c72-a34f-c85e245d35ea","role":"authenticated"}',true);

do $$ declare oid uuid:=current_setting('qa.a')::uuid; pid uuid:=current_setting('qa.pa')::uuid; n int; begin
perform pg_temp.qa_denied('Supplier A cannot link B product',format('select sourcing_link_catalog(%L,%L)',oid,current_setting('qa.pb')));
perform pg_temp.qa_denied('Supplier A cannot modify B response through RPC',format('select sourcing_link_catalog(%L,%L)',current_setting('qa.b'),pid));
update sourcing_responses set status='withdrawn' where id=current_setting('qa.b')::uuid;get diagnostics n=row_count;
perform pg_temp.qa_assert('Direct response UPDATE blocked by RLS',n=0);
update product_requests set title='unauthorized' where id=current_setting('qa.request')::uuid;get diagnostics n=row_count;
perform pg_temp.qa_assert('Direct other request UPDATE blocked by RLS',n=0);
update sourcing_comments set body='unauthorized' where id=current_setting('qa.comment')::uuid;get diagnostics n=row_count;
perform pg_temp.qa_assert('Direct other comment UPDATE blocked by RLS',n=0);
update supplier_products set status='draft' where id=pid;
perform pg_temp.qa_denied('Draft product rejected',format('select sourcing_link_catalog(%L,%L)',oid,pid));
update supplier_products set status='active' where id=pid;
update product_variants set is_enabled=false where product_id=pid;
perform pg_temp.qa_denied('Product without enabled variants rejected',format('select sourcing_link_catalog(%L,%L)',oid,pid));
update product_variants set is_enabled=true where product_id=pid and variant_name<>'Disabled';
perform sourcing_link_catalog(oid,pid);
perform pg_temp.qa_assert('A links own real product and becomes Sourced',exists(select 1 from sourcing_responses where id=oid and catalog_product_id=pid and status='sourced' and supplier_price is null));
perform pg_temp.qa_assert('B remains Sourcing',exists(select 1 from sourcing_responses where id=current_setting('qa.b')::uuid and status='sourcing' and catalog_product_id is null));
perform pg_temp.qa_assert('Request stays visible and sourced',exists(select 1 from product_requests where id=current_setting('qa.request')::uuid and status='sourced'));
perform sourcing_link_catalog(oid,pid);
update product_variants set cost_price=105 where product_id=pid and variant_name='Small';
perform pg_temp.qa_assert('Catalog edits appear live without copying into sourcing',private.sourcing_catalog_product(pid)->'variants' @> '[{"name":"Small","supplier_price":105}]');
update product_variants set cost_price=100 where product_id=pid and variant_name='Small';
perform pg_temp.qa_assert('Stock unchanged after repeated link',(select sum(stock_quantity)=119 from product_variants where product_id=pid));
perform pg_temp.qa_denied('Replacing linked product prevented',format('select sourcing_link_catalog(%L,%L)',oid,(select id from supplier_products where supplier_id=private.sourcing_supplier() and id<>pid and status='active' limit 1)));
end $$;
select set_config('request.jwt.claims','{"sub":"7bca2af4-5d9e-413a-a0c7-ea69fb82e958","role":"authenticated"}',true);

do $$ declare b jsonb:=sourcing_board(); p jsonb; n int; begin
select value->'catalog_product' into p from jsonb_array_elements(b->'responses') where value->>'id'=current_setting('qa.a');
perform pg_temp.qa_assert('Sourced page receives real product',p->>'id'=current_setting('qa.pa'));
perform pg_temp.qa_assert('Live prices retail stock and enabled variants',jsonb_array_length(p->'variants')=2 and (p->'variants' @> '[{"name":"Small","supplier_price":100,"suggested_retail":150,"stock":12}]'));
perform pg_temp.qa_assert('Normal Products includes linked product',exists(select 1 from marketplace_catalog_v3() where product_id=current_setting('qa.pa')::uuid));
perform pg_temp.qa_assert('Requester notified exactly once',(select count(*)=1 from dropshipper_alerts where sourcing_response_id=current_setting('qa.a')::uuid and supplier_product_id=current_setting('qa.pa')::uuid));
perform pg_temp.qa_denied('Dropshipper cannot complete supplier response',format('select sourcing_link_catalog(%L,%L)',current_setting('qa.b'),current_setting('qa.pb')));
perform pg_temp.qa_denied('Cannot edit another dropshipper comment',format('select sourcing_comment(%L,%L,%L)',current_setting('qa.request'),'unauthorized',current_setting('qa.comment')));
perform sourcing_interest(null,current_setting('qa.a')::uuid);perform sourcing_interest(null,current_setting('qa.a')::uuid);
perform pg_temp.qa_assert('Sourced product interest is deduplicated',(select count(*)=1 from sourcing_response_interests where response_id=current_setting('qa.a')::uuid and dropshipper_id=private.sourcing_dropshipper()));
end $$;
select set_config('request.jwt.claims','{"sub":"d495f242-8589-4e16-94cf-765a8002a568","role":"authenticated"}',true);

do $$ begin
perform pg_temp.qa_assert('Interested dropshipper notified exactly once',(select count(*)=1 from dropshipper_alerts where sourcing_response_id=current_setting('qa.a')::uuid));
end $$;
select set_config('request.jwt.claims','{"sub":"a268b093-ce46-4532-9152-a0dd21b5aa16","role":"authenticated"}',true);

do $$ begin
perform sourcing_link_catalog(current_setting('qa.b')::uuid,current_setting('qa.pb')::uuid);
perform pg_temp.qa_assert('B can later link different product',(select count(*)=2 from sourcing_responses where request_id=current_setting('qa.request')::uuid and status='sourced' and catalog_product_id is not null));
perform pg_temp.qa_assert('Admin control retained',private.has_role(auth.uid(),'admin') and exists(select 1 from pg_policies where tablename='sourcing_responses' and policyname='sourcing_admin'));
end $$;
reset role;
do $$ begin
perform pg_temp.qa_assert('No My Products links created',(select count(*)::text from dropshipper_product_links)=current_setting('qa.links'));
perform pg_temp.qa_assert('No customer orders created',(select count(*)::text from orders)=current_setting('qa.orders'));
perform pg_temp.qa_assert('Each supplier sends exactly one alert per recipient',(select count(*)=4 from dropshipper_alerts where sourcing_response_id in(current_setting('qa.a')::uuid,current_setting('qa.b')::uuid)));
perform pg_temp.qa_assert('Automatic publishing function removed',to_regprocedure('private.sourcing_publish_catalog(uuid)') is null);
perform pg_temp.qa_assert('Automatic catalog publication trigger removed',not exists(select 1 from pg_trigger where tgname='sourcing_catalog_publication'));
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
perform pg_temp.qa_denied('Unapproved user cannot start',format('select sourcing_start(%L)',current_setting('qa.request')));
perform pg_temp.qa_assert('Nonmember board has no community or catalog data',sourcing_board() = '{"eligible_products":[],"requests":[],"responses":[],"comments":[]}'::jsonb);
end $$;
reset role;
select jsonb_agg(jsonb_build_object('test',label)||detail order by label) results from qa_results;
rollback;
