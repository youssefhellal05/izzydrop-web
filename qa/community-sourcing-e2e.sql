-- Run once against production. Exactly one QA request; all rejected-write tests use subtransactions.
begin;
create temporary table qa_results(label text primary key,detail jsonb);
grant all on qa_results to authenticated;
create function pg_temp.qa_assert(_label text,_ok boolean,_detail jsonb default '{}'::jsonb) returns void language plpgsql as $$
begin
 if _ok is distinct from true then raise exception 'QA FAILED: % (%)',_label,_detail; end if;
 insert into qa_results values(_label,_detail||'{"result":"PASS"}'::jsonb);
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7bca2af4-5d9e-413a-a0c7-ea69fb82e958","role":"authenticated"}',true);
do $$ declare rid uuid; denied boolean:=false; begin
 perform pg_temp.qa_assert('Non-admin active requester',private.sourcing_dropshipper() is not null and not private.has_role(auth.uid(),'admin'::public.app_role));
 rid:=public.sourcing_create_request('{"title":"QA Community Sourcing — Fold-flat Solar Desk Beacon — 2026-09-30","description":"FAKE QA product not in IzzyDrop. Fold-flat solar desk beacon with removable amber lens. Do not fulfill or import.","notes":"QA ONLY: independent sourcing, community demand and notifications test. Not a customer order.","target_cost":125,"expected_quantity":40}'::jsonb);
 perform set_config('qa.request',rid::text,true);
 perform pg_temp.qa_assert('One request created without catalog product',exists(select 1 from public.product_requests where id=rid and status='open' and description like 'FAKE QA%'),jsonb_build_object('request_id',rid));
 perform public.sourcing_interest(rid,null);perform public.sourcing_interest(rid,null);
 perform pg_temp.qa_assert('Duplicate request interest prevented',(select count(*)=1 from public.sourcing_request_interests where request_id=rid));
 begin perform public.sourcing_start(rid); exception when others then denied:=true; end;
 perform pg_temp.qa_assert('Dropshipper cannot act as supplier',denied);
 end $$;

-- Existing second dropshipper: community read, comment and demand.
select set_config('request.jwt.claims','{"sub":"d495f242-8589-4e16-94cf-765a8002a568","role":"authenticated"}',true);
do $$ declare rid uuid:=current_setting('qa.request')::uuid; cid uuid; begin
 perform pg_temp.qa_assert('Another dropshipper sees request',exists(select 1 from public.product_requests where id=rid));
 cid:=public.sourcing_comment(rid,'QA demand: interested in 40 amber units; removable lens required.');
 perform set_config('qa.comment',cid::text,true);
 perform public.sourcing_comment(rid,'QA demand: interested in 40 amber units; removable lens required. Edited by author.',cid);
 perform pg_temp.qa_assert('Comment created and author can edit',exists(select 1 from public.sourcing_comments where id=cid and body like '%Edited by author.'));
 perform public.sourcing_interest(rid,null);perform public.sourcing_interest(rid,null);
 perform pg_temp.qa_assert('Two distinct interested dropshippers',(select count(*)=2 from public.sourcing_request_interests where request_id=rid));
 end $$;

-- Non-admin approved supplier. Research contains no catalog or variant reference.
select set_config('request.jwt.claims','{"sub":"28bb8582-65ac-4c72-a34f-c85e245d35ea","role":"authenticated"}',true);
do $$ declare rid uuid:=current_setting('qa.request')::uuid; oid uuid; rejected boolean:=false; data jsonb; begin
 perform pg_temp.qa_assert('Approved supplier sees community request',private.sourcing_supplier() is not null and exists(select 1 from public.product_requests where id=rid));
 oid:=public.sourcing_start(rid);perform set_config('qa.offer',oid::text,true);
 perform pg_temp.qa_assert('Begin sourcing without catalog match',exists(select 1 from public.sourcing_responses where id=oid and status='sourcing' and catalog_product_id is null));
 perform pg_temp.qa_assert('Repeated start uses same response',public.sourcing_start(rid)=oid);
 perform pg_temp.qa_assert('Request aggregates sourcing state',(select status='sourcing' from public.product_requests where id=rid));
 perform public.sourcing_save_response(oid,'{"supplier_price":120,"supplier_notes":"QA researching local and China manufacturers."}',false);
 perform pg_temp.qa_assert('Optional research estimates saved',exists(select 1 from public.sourcing_responses where id=oid and status='sourcing' and supplier_price=120 and recommended_retail is null));
 begin perform public.sourcing_save_response(oid,'{"supplier_price":125}',true); exception when check_violation then rejected:=true; end;
 perform pg_temp.qa_assert('Incomplete completion rejected',rejected);
 data:='{"supplier_price":125,"recommended_retail":200,"available_quantity":250,"moq":10,"lead_time_days":14,"origin_country":"China","image_url":"https://youssefhellal05.github.io/izzydrop-web/favicon.svg","supplier_notes":"QA ONLY: fictitious supplier found this test beacon. Never fulfill.","sourcing_details":"Expected margin is guidance, before shipping and fees. MOQ 10. Fake QA offer."}'::jsonb;
 perform public.sourcing_save_response(oid,data,true);perform public.sourcing_save_response(oid,data,true);
 perform pg_temp.qa_assert('Sourced final values correct',exists(select 1 from public.sourcing_responses where id=oid and status='sourced' and supplier_price=125 and recommended_retail=200 and estimated_margin=75 and available_quantity=250 and moq=10 and lead_time_days=14 and catalog_product_id is null));
 perform pg_temp.qa_assert('Supplier cannot close requester post',not exists(select 1 from public.product_requests where id=rid and status='closed'));
 end $$;

-- Requester: notification, sourced board, and negative ownership/direct-write checks.
select set_config('request.jwt.claims','{"sub":"7bca2af4-5d9e-413a-a0c7-ea69fb82e958","role":"authenticated"}',true);
do $$ declare rid uuid:=current_setting('qa.request')::uuid; oid uuid:=current_setting('qa.offer')::uuid; denied boolean; n int; begin
 perform pg_temp.qa_assert('Requester gets one actionable notification',(select count(*)=1 from public.dropshipper_alerts where sourcing_response_id=oid and alert_type='sourcing_sourced' and metadata->>'response_id'=oid::text));
 perform pg_temp.qa_assert('Sourced offer visible under requester RLS',exists(select 1 from jsonb_array_elements(public.sourcing_board()->'responses') o where o->>'id'=oid::text and o->>'status'='sourced' and (o->>'supplier_price')::numeric=125 and (o->>'recommended_retail')::numeric=200));
 perform pg_temp.qa_assert('Request aggregates sourced state',(select status='sourced' from public.product_requests where id=rid));
 denied:=false;begin perform public.sourcing_comment(rid,'Unauthorized edit',current_setting('qa.comment')::uuid); exception when others then denied:=true; end;
 perform pg_temp.qa_assert('Cannot edit another dropshipper comment',denied);
 update public.sourcing_comments set body='Unauthorized direct edit' where id=current_setting('qa.comment')::uuid;get diagnostics n=row_count;
 perform pg_temp.qa_assert('RLS blocks direct cross-user comment update',n=0);
 update public.sourcing_responses set supplier_price=1 where id=oid;get diagnostics n=row_count;
 perform pg_temp.qa_assert('RLS blocks direct cross-supplier response update',n=0);
 update public.product_requests set dropshipper_id='315ac9c0-99bd-465b-8829-a808956829b4' where id=rid;get diagnostics n=row_count;
 perform pg_temp.qa_assert('Direct request ownership reassignment blocked',n=0);
 denied:=false;begin insert into public.sourcing_responses(request_id,supplier_id) values(rid,'9541edba-600a-4172-9858-bde5f7b954ff'); exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.qa_assert('RLS blocks direct forged supplier response',denied);
 denied:=false;begin perform public.accept_product_request_quote('33ed8130-6826-47a7-8a83-9bf077253083'); exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.qa_assert('Old accept-and-add path retired',denied);
 end $$;

select set_config('request.jwt.claims','{"sub":"d495f242-8589-4e16-94cf-765a8002a568","role":"authenticated"}',true);
do $$ declare oid uuid:=current_setting('qa.offer')::uuid; begin
 perform pg_temp.qa_assert('Interested second dropshipper notified',(select count(*)=1 from public.dropshipper_alerts where sourcing_response_id=oid and alert_type='sourcing_sourced' and dropshipper_id='2f30084c-2e67-48cd-b6a9-9a10de7a53c2'));
 end $$;

-- A third dropshipper records offer-specific demand AFTER sourcing; also a second approved supplier investigates.
select set_config('request.jwt.claims','{"sub":"a268b093-ce46-4532-9152-a0dd21b5aa16","role":"authenticated"}',true);
do $$ declare rid uuid:=current_setting('qa.request')::uuid; oid uuid:=current_setting('qa.offer')::uuid; second uuid; begin
 perform public.sourcing_interest(null,oid);perform public.sourcing_interest(null,oid);
 perform pg_temp.qa_assert('Another dropshipper requests sourced offer without duplicates',(select count(*)=1 from public.sourcing_response_interests where response_id=oid));
 perform pg_temp.qa_assert('Offer demand rolls into request demand',(select count(*)=3 from public.sourcing_request_interests where request_id=rid));
 second:=public.sourcing_start(rid);perform set_config('qa.second_offer',second::text,true);
 perform pg_temp.qa_assert('Multiple suppliers work independently',second<>oid and exists(select 1 from public.sourcing_responses where id=second and status='sourcing'));
 perform pg_temp.qa_assert('Another supplier not declined or closed',(select status='sourced' from public.product_requests where id=rid) and (select count(*)=2 from public.sourcing_responses where request_id=rid));
 end $$;

select set_config('request.jwt.claims','{"sub":"28bb8582-65ac-4c72-a34f-c85e245d35ea","role":"authenticated"}',true);
do $$ declare denied boolean:=false; begin
 begin perform public.sourcing_save_response(current_setting('qa.second_offer')::uuid,'{"supplier_price":1}',false); exception when others then denied:=true; end;
 perform pg_temp.qa_assert('Supplier cannot change another supplier offer via RPC',denied);
 denied:=false;begin perform public.sourcing_close_request(current_setting('qa.request')::uuid,false); exception when others then denied:=true; end;
 perform pg_temp.qa_assert('Supplier cannot close another user request via RPC',denied);
 end $$;

-- All checks use real SQL grants/RLS with authenticated role, not postgres-only reads.
reset role;
do $$ declare rid uuid:=current_setting('qa.request')::uuid; oid uuid:=current_setting('qa.offer')::uuid; begin
 perform pg_temp.qa_assert('Fake requested product absent from normal catalog',not exists(select 1 from public.supplier_products where name='QA Community Sourcing — Fold-flat Solar Desk Beacon — 2026-09-30'));
 perform pg_temp.qa_assert('Exactly two completion alerts despite repeat completion',(select count(*)=2 from public.dropshipper_alerts where sourcing_response_id=oid));
 perform pg_temp.qa_assert('No sourcing response auto-added to My Products',not exists(select 1 from public.dropshipper_product_links where sourcing_quote_id=oid));
 perform pg_temp.qa_assert('Recommended price is independent commercial guidance',exists(select 1 from public.sourcing_responses where id=oid and recommended_retail=200 and catalog_product_id is null));
 perform pg_temp.qa_assert('QA request final state',exists(select 1 from public.product_requests where id=rid and status='sourced'),jsonb_build_object('request_id',rid,'response_id',oid,'second_response_id',current_setting('qa.second_offer'),'comment_id',current_setting('qa.comment')));
 end $$;
set local role anon;
do $$ declare denied boolean:=false; begin
 begin perform public.sourcing_board(); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anon can call sourcing board'; end if;
 end $$;
reset role;
insert into qa_results values('Anonymous API access denied','{"result":"PASS"}');
commit;
select jsonb_agg(jsonb_build_object('test',label,'detail',detail) order by label) as qa_results from qa_results;
