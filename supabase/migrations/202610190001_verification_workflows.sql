-- Verification workflow for suppliers and dropshippers.
-- Private identity documents are only available to the account owner and authorized admins.

create table if not exists public.dropshipper_identity_verifications (
  dropshipper_id uuid primary key references public.dropshippers(id) on delete cascade,
  id_document_path text not null,
  review_status text not null default 'submitted'
    check (review_status in ('submitted','needs_changes','approved','rejected')),
  review_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submission_count integer not null default 1
);

alter table public.dropshipper_identity_verifications enable row level security;
grant select on public.dropshipper_identity_verifications to authenticated;
drop policy if exists dropshipper_identity_owner_or_admin_read on public.dropshipper_identity_verifications;
create policy dropshipper_identity_owner_or_admin_read
  on public.dropshipper_identity_verifications for select to authenticated
  using (
    exists (select 1 from public.dropshippers d
      where d.id = dropshipper_identity_verifications.dropshipper_id
        and d.profile_id = auth.uid())
    or private.has_role(auth.uid(),'admin'::public.app_role)
  );

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('dropshipper-identity-documents','dropshipper-identity-documents',false,5242880,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=5242880,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists "dropshipper identity: admin full access" on storage.objects;
create policy "dropshipper identity: admin full access" on storage.objects
  for all to authenticated
  using (bucket_id='dropshipper-identity-documents' and private.has_role(auth.uid(),'admin'::public.app_role))
  with check (bucket_id='dropshipper-identity-documents' and private.has_role(auth.uid(),'admin'::public.app_role));

drop policy if exists "dropshipper identity: owner reads own folder" on storage.objects;
create policy "dropshipper identity: owner reads own folder" on storage.objects
  for select to authenticated
  using (bucket_id='dropshipper-identity-documents' and exists (
    select 1 from public.dropshippers d
    where d.profile_id=auth.uid() and (storage.foldername(name))[1]=d.id::text
  ));

drop policy if exists "dropshipper identity: owner uploads own folder" on storage.objects;
create policy "dropshipper identity: owner uploads own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id='dropshipper-identity-documents' and exists (
    select 1 from public.dropshippers d
    where d.profile_id=auth.uid() and (storage.foldername(name))[1]=d.id::text
  ));

create or replace function public.dropshipper_submit_identity_verification(_id_document_path text)
returns jsonb
language plpgsql security definer set search_path to 'public','private'
as $function$
declare did uuid; current_row public.dropshipper_identity_verifications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into did from public.dropshippers where profile_id=auth.uid() for update;
  if did is null then raise exception 'Dropshipper account not found'; end if;
  if coalesce(btrim(_id_document_path),'')='' or length(_id_document_path)>300
     or left(_id_document_path,length(did::text)+1)<>did::text||'/'
     or not exists(select 1 from storage.objects where bucket_id='dropshipper-identity-documents' and name=_id_document_path) then
    raise exception 'Upload a valid ID document to your private folder first';
  end if;
  insert into public.dropshipper_identity_verifications(dropshipper_id,id_document_path)
    values(did,_id_document_path)
  on conflict (dropshipper_id) do update set
    id_document_path=excluded.id_document_path,
    review_status='submitted',review_reason=null,reviewed_by=null,reviewed_at=null,
    submitted_at=now(),updated_at=now(),
    submission_count=public.dropshipper_identity_verifications.submission_count+1
  returning * into current_row;
  insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'dropshipper_identity_submitted','dropshipper_identity_verifications',did::text,
      jsonb_build_object('submission_count',current_row.submission_count));
  return jsonb_build_object('dropshipper_id',did,'review_status',current_row.review_status);
end;
$function$;

create or replace function public.admin_review_dropshipper_identity(_dropshipper_id uuid,_decision text,_reason text default null)
returns jsonb
language plpgsql security definer set search_path to 'public','private'
as $function$
declare v public.dropshipper_identity_verifications%rowtype; next_status text;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role)
    then raise exception 'Admin access required'; end if;
  select * into v from public.dropshipper_identity_verifications
    where dropshipper_id=_dropshipper_id for update;
  if not found then raise exception 'No identity verification submitted'; end if;
  if _decision='approve' then next_status:='approved';
  elsif _decision='request_changes' then next_status:='needs_changes';
  elsif _decision='reject' then next_status:='rejected';
  else raise exception 'Unknown verification decision'; end if;
  if next_status in ('needs_changes','rejected') and length(btrim(coalesce(_reason,'')))<8
    then raise exception 'A clear reason is required'; end if;
  update public.dropshipper_identity_verifications set review_status=next_status,
    review_reason=nullif(btrim(_reason),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    where dropshipper_id=_dropshipper_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'dropshipper_identity_reviewed','dropshipper_identity_verifications',_dropshipper_id::text,
      jsonb_build_object('decision',next_status,'reason',left(coalesce(_reason,''),500)));
  return jsonb_build_object('dropshipper_id',_dropshipper_id,'review_status',next_status);
end;
$function$;

-- Permit suppliers to submit their verification application after signup.
-- Existing approved suppliers remain active while the application is reviewed.
create or replace function public.supplier_submit_verification(
  _business_address text,
  _business_phone text,
  _registration_status text,
  _registration_number text default null,
  _tax_registration_number text default null,
  _registration_document_path text default null,
  _tax_document_path text default null,
  _supplier_notes text default null
) returns jsonb
language plpgsql security definer set search_path to 'public','private'
as $function$
declare sid uuid; changed public.supplier_verification_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into sid from public.suppliers
    where profile_id=auth.uid() and status in ('pending','approved') for update;
  if sid is null then raise exception 'An active supplier account is required to submit verification'; end if;
  if length(btrim(coalesce(_business_address,'')))<8 or length(_business_address)>400
    then raise exception 'Enter a complete business or warehouse address'; end if;
  if length(btrim(coalesce(_business_phone,'')))<7 or length(_business_phone)>40
    then raise exception 'Enter a valid contact number'; end if;
  if _registration_status not in ('registered','in_progress','not_registered') or _registration_status is null
    then raise exception 'Select a registration status'; end if;
  if length(coalesce(_registration_number,''))>100 or length(coalesce(_tax_registration_number,''))>100
     or length(coalesce(_registration_document_path,''))>300 or length(coalesce(_tax_document_path,''))>300
     or length(coalesce(_supplier_notes,''))>1500 then raise exception 'One or more fields are too long'; end if;
  if _registration_status='registered' and
    (coalesce(btrim(_registration_document_path),'')='' or coalesce(btrim(_tax_document_path),'')='')
    then raise exception 'Upload commercial registration and tax documents before submitting'; end if;
  if _registration_document_path is not null and
    (left(_registration_document_path,length(sid::text)+1)<>sid::text||'/' or
     not exists(select 1 from storage.objects where bucket_id='supplier-documents' and name=_registration_document_path))
    then raise exception 'Commercial registration document was not found in your private folder'; end if;
  if _tax_document_path is not null and
    (left(_tax_document_path,length(sid::text)+1)<>sid::text||'/' or
     not exists(select 1 from storage.objects where bucket_id='supplier-documents' and name=_tax_document_path))
    then raise exception 'Tax document was not found in your private folder'; end if;
  insert into public.supplier_verification_applications
    (supplier_id,business_address,business_phone,registration_status,registration_number,tax_registration_number,
     registration_document_path,tax_document_path,supplier_notes)
  values (sid,btrim(_business_address),btrim(_business_phone),_registration_status,
    nullif(btrim(_registration_number),''),nullif(btrim(_tax_registration_number),''),
    nullif(btrim(_registration_document_path),''),nullif(btrim(_tax_document_path),''),nullif(btrim(_supplier_notes),''))
  on conflict (supplier_id) do update set
    business_address=excluded.business_address,business_phone=excluded.business_phone,
    registration_status=excluded.registration_status,registration_number=excluded.registration_number,
    tax_registration_number=excluded.tax_registration_number,
    registration_document_path=excluded.registration_document_path,tax_document_path=excluded.tax_document_path,
    supplier_notes=excluded.supplier_notes,review_status='submitted',review_reason=null,reviewed_by=null,
    reviewed_at=null,submitted_at=now(),updated_at=now(),
    submission_count=public.supplier_verification_applications.submission_count+1
  returning * into changed;
  insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'supplier_verification_submitted','supplier_verification_applications',sid::text,
      jsonb_build_object('submission_count',changed.submission_count));
  return jsonb_build_object('supplier_id',sid,'review_status',changed.review_status);
end;
$function$;

-- Review applications from approved legacy suppliers without changing their marketplace status.
create or replace function public.admin_review_supplier_verification(_supplier_id uuid,_decision text,_reason text default null)
returns jsonb
language plpgsql security definer set search_path to 'public','private'
as $function$
declare a public.supplier_verification_applications%rowtype; next_status text; current_supplier_status public.supplier_status;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role)
    then raise exception 'Admin access required'; end if;
  select status into current_supplier_status from public.suppliers where id=_supplier_id for update;
  if not found or current_supplier_status not in ('pending','approved') then
    raise exception 'Supplier account is not eligible for verification review'; end if;
  select * into a from public.supplier_verification_applications where supplier_id=_supplier_id for update;
  if not found then raise exception 'No verification submitted'; end if;
  if _decision='request_changes' then next_status:='needs_changes';
  elsif _decision='reject' then next_status:='rejected';
  elsif _decision='approve' then
    if a.review_status<>'submitted' then raise exception 'Only submitted applications may be approved'; end if;
    if a.registration_status<>'registered' or coalesce(btrim(a.registration_number),'')='' or
       coalesce(btrim(a.tax_registration_number),'')='' or coalesce(btrim(a.registration_document_path),'')='' or
       coalesce(btrim(a.tax_document_path),'')='' then
      raise exception 'Commercial registration and tax details and uploaded documents must be complete for approval'; end if;
    next_status:='approved';
  else raise exception 'Unknown verification decision'; end if;
  if next_status in ('needs_changes','rejected') and length(btrim(coalesce(_reason,'')))<8
    then raise exception 'A clear reason is required'; end if;
  update public.supplier_verification_applications set review_status=next_status,
    review_reason=nullif(btrim(_reason),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    where supplier_id=_supplier_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'supplier_verification_reviewed','supplier_verification_applications',_supplier_id::text,
      jsonb_build_object('decision',next_status,'reason',left(coalesce(_reason,''),500)));
  if next_status='approved' and current_supplier_status='pending' then perform public.admin_review_supplier(_supplier_id,'approve');
  elsif next_status='rejected' and current_supplier_status='pending' then perform public.admin_review_supplier(_supplier_id,'reject'); end if;
  return jsonb_build_object('supplier_id',_supplier_id,'review_status',next_status);
end;
$function$;

-- Enforce verification server-side at the moment a supplier publishes a new product.
create or replace function public.require_supplier_verification_for_publish()
returns trigger language plpgsql security definer set search_path to 'public','private'
as $function$
begin
  if auth.uid() is not null and private.has_role(auth.uid(),'admin'::public.app_role) then return new; end if;
  if not exists(select 1 from public.supplier_verification_applications a
    where a.supplier_id=new.supplier_id and a.review_status='approved') then
    raise exception 'Supplier verification is required before publishing new products. Open Settings → Verification to submit your documents.';
  end if;
  return new;
end;
$function$;

drop trigger if exists require_supplier_verification_before_publish on public.supplier_products;
create trigger require_supplier_verification_before_publish
  before insert on public.supplier_products for each row execute function public.require_supplier_verification_for_publish();

-- Defense in depth: no dropshipper payout can be newly marked paid until identity is approved.
create or replace function public.guard_dropshipper_payout_identity()
returns trigger language plpgsql security definer set search_path to 'public','private'
as $function$
begin
  if new.dropshipper_payout_status='paid' and
     (tg_op='INSERT' or old.dropshipper_payout_status is distinct from 'paid') and
     not exists(select 1 from public.dropshipper_identity_verifications v
       where v.dropshipper_id=new.dropshipper_id and v.review_status='approved') then
    raise exception 'Dropshipper identity verification must be approved before payout';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_dropshipper_payout_identity on public.order_item_settlements;
create trigger guard_dropshipper_payout_identity
  before insert or update of dropshipper_payout_status on public.order_item_settlements
  for each row execute function public.guard_dropshipper_payout_identity();

grant execute on function public.dropshipper_submit_identity_verification(text) to authenticated;
grant execute on function public.admin_review_dropshipper_identity(uuid,text,text) to authenticated;
grant execute on function public.supplier_submit_verification(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_review_supplier_verification(uuid,text,text) to authenticated;
