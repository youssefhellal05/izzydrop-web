-- Pre-release verification and administrative controls.
-- Staged only: review and apply to a disposable Supabase database before production.

begin;

alter table public.supplier_verification_applications
  add column if not exists legal_name text,
  add column if not exists identity_document_path text,
  add column if not exists business_maps_url text;

alter table public.dropshipper_identity_verifications
  add column if not exists legal_name text,
  add column if not exists residential_address text,
  add column if not exists residential_maps_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='supplier_verification_business_maps_url_check'
      and conrelid='public.supplier_verification_applications'::regclass
  ) then
    alter table public.supplier_verification_applications
      add constraint supplier_verification_business_maps_url_check
      check (business_maps_url is null or business_maps_url ~* '^https://(maps\.app\.goo\.gl/|www\.google\.[^/]+/maps|maps\.google\.[^/]+/)');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='dropshipper_identity_maps_url_check'
      and conrelid='public.dropshipper_identity_verifications'::regclass
  ) then
    alter table public.dropshipper_identity_verifications
      add constraint dropshipper_identity_maps_url_check
      check (residential_maps_url is null or residential_maps_url ~* '^https://(maps\.app\.goo\.gl/|www\.google\.[^/]+/maps|maps\.google\.[^/]+/)');
  end if;
end $$;

create or replace function public.supplier_submit_verification_v2(
  _legal_name text,
  _business_address text,
  _business_phone text,
  _business_maps_url text,
  _registration_status text,
  _registration_number text default null,
  _tax_registration_number text default null,
  _registration_document_path text default null,
  _tax_document_path text default null,
  _identity_document_path text default null,
  _supplier_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  sid uuid;
  changed public.supplier_verification_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Confirm your email address before submitting supplier verification';
  end if;

  select id into sid
  from public.suppliers
  where profile_id=auth.uid() and status in ('pending','approved')
  for update;
  if sid is null then raise exception 'An active supplier account is required to submit verification'; end if;

  if length(btrim(coalesce(_legal_name,'')))<3 or length(_legal_name)>120 then
    raise exception 'Enter your full legal name';
  end if;
  if length(btrim(coalesce(_business_address,'')))<8 or length(_business_address)>400 then
    raise exception 'Enter a complete business or warehouse address';
  end if;
  if length(btrim(coalesce(_business_phone,'')))<7 or length(_business_phone)>40 then
    raise exception 'Enter a valid business contact number';
  end if;
  if _registration_status not in ('registered','in_progress','not_registered') or _registration_status is null then
    raise exception 'Select a business registration status';
  end if;
  if length(coalesce(_registration_number,''))>100
     or length(coalesce(_tax_registration_number,''))>100
     or length(coalesce(_registration_document_path,''))>300
     or length(coalesce(_tax_document_path,''))>300
     or length(coalesce(_identity_document_path,''))>300
     or length(coalesce(_supplier_notes,''))>1500 then
    raise exception 'One or more fields are too long';
  end if;
  if _registration_status='registered'
     and (coalesce(btrim(_registration_number),'')='' or coalesce(btrim(_registration_document_path),'')='') then
    raise exception 'Registered businesses must provide their commercial registration number and document';
  end if;
  if (nullif(btrim(_tax_registration_number),'') is null) <> (nullif(btrim(_tax_document_path),'') is null) then
    raise exception 'Provide both the tax registration number and its document, or leave both blank';
  end if;
  if coalesce(btrim(_identity_document_path),'')='' then
    raise exception 'Upload your national ID document';
  end if;
  if _business_maps_url is not null and (
    length(_business_maps_url)>500 or
    _business_maps_url !~* '^https://(maps\.app\.goo\.gl/|www\.google\.[^/]+/maps|maps\.google\.[^/]+/)'
  ) then raise exception 'Use a valid Google Maps link or leave it blank'; end if;

  if not exists(select 1 from storage.objects where bucket_id='supplier-documents' and name=_identity_document_path
    and left(name,length(sid::text)+1)=sid::text||'/') then
    raise exception 'Upload your ID document to your private supplier folder first';
  end if;
  if _registration_document_path is not null and not exists(
    select 1 from storage.objects where bucket_id='supplier-documents' and name=_registration_document_path
      and left(name,length(sid::text)+1)=sid::text||'/'
  ) then raise exception 'Commercial registration document was not found in your private folder'; end if;
  if _tax_document_path is not null and not exists(
    select 1 from storage.objects where bucket_id='supplier-documents' and name=_tax_document_path
      and left(name,length(sid::text)+1)=sid::text||'/'
  ) then raise exception 'Tax document was not found in your private folder'; end if;

  insert into public.supplier_verification_applications(
    supplier_id,legal_name,identity_document_path,business_address,business_phone,business_maps_url,
    registration_status,registration_number,tax_registration_number,
    registration_document_path,tax_document_path,supplier_notes
  ) values (
    sid,btrim(_legal_name),btrim(_identity_document_path),btrim(_business_address),btrim(_business_phone),
    nullif(btrim(_business_maps_url),''),_registration_status,
    nullif(btrim(_registration_number),''),nullif(btrim(_tax_registration_number),''),
    nullif(btrim(_registration_document_path),''),nullif(btrim(_tax_document_path),''),
    nullif(btrim(_supplier_notes),'')
  )
  on conflict(supplier_id) do update set
    legal_name=excluded.legal_name,
    identity_document_path=excluded.identity_document_path,
    business_address=excluded.business_address,
    business_phone=excluded.business_phone,
    business_maps_url=excluded.business_maps_url,
    registration_status=excluded.registration_status,
    registration_number=excluded.registration_number,
    tax_registration_number=excluded.tax_registration_number,
    registration_document_path=excluded.registration_document_path,
    tax_document_path=excluded.tax_document_path,
    supplier_notes=excluded.supplier_notes,
    review_status='submitted',
    review_reason=null,
    reviewed_by=null,
    reviewed_at=null,
    submitted_at=now(),
    updated_at=now(),
    submission_count=public.supplier_verification_applications.submission_count+1
  returning * into changed;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'supplier_verification_submitted_v2','supplier_verification_applications',sid::text,
    jsonb_build_object('submission_count',changed.submission_count));
  return jsonb_build_object('supplier_id',sid,'review_status',changed.review_status);
end;
$function$;

revoke all on function public.supplier_submit_verification_v2(text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.supplier_submit_verification_v2(text,text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.dropshipper_submit_identity_verification_v2(
  _legal_name text,
  _residential_address text,
  _residential_maps_url text,
  _id_document_path text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  did uuid;
  current_row public.dropshipper_identity_verifications%rowtype;
  account_phone text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Confirm your email address before submitting identity verification';
  end if;
  select id into did from public.dropshippers where profile_id=auth.uid() for update;
  if did is null then raise exception 'Dropshipper account not found'; end if;

  select phone into account_phone from public.profiles where id=auth.uid();
  if length(btrim(coalesce(_legal_name,'')))<3 or length(_legal_name)>120 then
    raise exception 'Enter your full legal name';
  end if;
  if length(regexp_replace(coalesce(account_phone,''),'[^0-9+]','','g'))<8 then
    raise exception 'Add a contact phone number in your account profile first';
  end if;
  if length(btrim(coalesce(_residential_address,'')))<8 or length(_residential_address)>500 then
    raise exception 'Enter your residential delivery address';
  end if;
  if _residential_maps_url is not null and (
    length(_residential_maps_url)>500 or
    _residential_maps_url !~* '^https://(maps\.app\.goo\.gl/|www\.google\.[^/]+/maps|maps\.google\.[^/]+/)'
  ) then raise exception 'Use a valid Google Maps link or leave it blank'; end if;
  if coalesce(btrim(_id_document_path),'')='' or length(_id_document_path)>300
     or left(_id_document_path,length(did::text)+1)<>did::text||'/'
     or not exists(select 1 from storage.objects where bucket_id='dropshipper-identity-documents' and name=_id_document_path) then
    raise exception 'Upload a valid ID document to your private folder first';
  end if;

  insert into public.dropshipper_identity_verifications(
    dropshipper_id,legal_name,residential_address,residential_maps_url,id_document_path
  ) values(did,btrim(_legal_name),btrim(_residential_address),nullif(btrim(_residential_maps_url),''),_id_document_path)
  on conflict(dropshipper_id) do update set
    legal_name=excluded.legal_name,
    residential_address=excluded.residential_address,
    residential_maps_url=excluded.residential_maps_url,
    id_document_path=excluded.id_document_path,
    review_status='submitted',
    review_reason=null,
    reviewed_by=null,
    reviewed_at=null,
    submitted_at=now(),
    updated_at=now(),
    submission_count=public.dropshipper_identity_verifications.submission_count+1
  returning * into current_row;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'dropshipper_identity_submitted_v2','dropshipper_identity_verifications',did::text,
    jsonb_build_object('submission_count',current_row.submission_count));
  return jsonb_build_object('dropshipper_id',did,'review_status',current_row.review_status);
end;
$function$;

revoke all on function public.dropshipper_submit_identity_verification_v2(text,text,text,text) from public,anon;
grant execute on function public.dropshipper_submit_identity_verification_v2(text,text,text,text) to authenticated;

create or replace function public.admin_review_dropshipper_identity(
  _dropshipper_id uuid,
  _decision text,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  v public.dropshipper_identity_verifications%rowtype;
  next_status text;
  owner_id uuid;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  select * into v from public.dropshipper_identity_verifications
  where dropshipper_id=_dropshipper_id for update;
  if not found then raise exception 'No identity verification submitted'; end if;

  if _decision='approve' then
    select profile_id into owner_id from public.dropshippers where id=_dropshipper_id;
    if not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then
      raise exception 'The dropshipper must confirm their email address before identity approval';
    end if;
    if coalesce(btrim(v.legal_name),'')='' or length(btrim(coalesce(v.residential_address,'')))<8
       or coalesce(btrim(v.id_document_path),'')='' then
      raise exception 'Full legal name, residential address and ID document are required';
    end if;
    if not exists(select 1 from public.profiles p where p.id=owner_id
      and length(regexp_replace(coalesce(p.phone,''),'[^0-9+]','','g'))>=8) then
      raise exception 'A contact phone number is required';
    end if;
    if not exists(select 1 from public.dropshipper_payout_details pd
      where pd.dropshipper_id=_dropshipper_id
        and nullif(btrim(pd.payout_method),'') is not null
        and nullif(btrim(pd.payout_details->>'beneficiary_name'),'') is not null
        and nullif(btrim(pd.payout_details->>'destination'),'') is not null) then
      raise exception 'Complete the dropshipper payout details before approving identity';
    end if;
    next_status:='approved';
  elsif _decision='request_changes' then next_status:='needs_changes';
  elsif _decision='reject' then next_status:='rejected';
  else raise exception 'Unknown verification decision';
  end if;

  if next_status in ('needs_changes','rejected') and length(btrim(coalesce(_reason,'')))<8 then
    raise exception 'A clear reason is required';
  end if;

  update public.dropshipper_identity_verifications
  set review_status=next_status,review_reason=nullif(btrim(_reason),''),reviewed_by=auth.uid(),
      reviewed_at=now(),updated_at=now()
  where dropshipper_id=_dropshipper_id;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'dropshipper_identity_reviewed','dropshipper_identity_verifications',_dropshipper_id::text,
    jsonb_build_object('decision',next_status,'reason',left(coalesce(_reason,''),500)));
  return jsonb_build_object('dropshipper_id',_dropshipper_id,'review_status',next_status);
end;
$function$;

revoke all on function public.admin_review_dropshipper_identity(uuid,text,text) from public,anon;
grant execute on function public.admin_review_dropshipper_identity(uuid,text,text) to authenticated;

create or replace function public.admin_review_supplier_verification(
  _supplier_id uuid,
  _decision text,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  a public.supplier_verification_applications%rowtype;
  next_status text;
  current_supplier_status public.supplier_status;
  owner_id uuid;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;

  select status,profile_id into current_supplier_status,owner_id
  from public.suppliers where id=_supplier_id for update;
  if not found or current_supplier_status not in ('pending','approved') then
    raise exception 'Supplier account is not eligible for verification review';
  end if;
  select * into a from public.supplier_verification_applications
  where supplier_id=_supplier_id for update;
  if not found then raise exception 'No verification submitted'; end if;

  if _decision='request_changes' then next_status:='needs_changes';
  elsif _decision='reject' then next_status:='rejected';
  elsif _decision='approve' then
    if not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then
      raise exception 'The supplier must confirm their email address before verification approval';
    end if;
    if a.review_status<>'submitted' then raise exception 'Only submitted applications may be approved'; end if;
    if coalesce(btrim(a.legal_name),'')='' or coalesce(btrim(a.identity_document_path),'')=''
       or length(btrim(coalesce(a.business_address,'')))<8
       or length(regexp_replace(coalesce(a.business_phone,''),'[^0-9+]','','g'))<7 then
      raise exception 'Full legal name, ID document, business address and contact phone are required';
    end if;
    if a.registration_status='registered'
       and (coalesce(btrim(a.registration_number),'')='' or coalesce(btrim(a.registration_document_path),'')='') then
      raise exception 'Registered suppliers must provide commercial registration details and the document';
    end if;
    if (nullif(btrim(a.tax_registration_number),'') is null) <> (nullif(btrim(a.tax_document_path),'') is null) then
      raise exception 'Tax registration number and document must be supplied together';
    end if;
    if not exists(select 1 from public.supplier_payout_details pd
      where pd.supplier_id=_supplier_id
        and nullif(btrim(pd.payout_method),'') is not null
        and nullif(btrim(pd.payout_details->>'beneficiary_name'),'') is not null
        and nullif(btrim(pd.payout_details->>'destination'),'') is not null) then
      raise exception 'Complete the supplier payout details before approval';
    end if;
    if a.registration_status in ('not_registered','in_progress') and length(btrim(coalesce(_reason,'')))<8 then
      raise exception 'Add an admin approval note explaining the registration exception';
    end if;
    next_status:='approved';
  else
    raise exception 'Unknown verification decision';
  end if;

  if next_status in ('needs_changes','rejected') and length(btrim(coalesce(_reason,'')))<8 then
    raise exception 'A clear reason is required';
  end if;

  update public.supplier_verification_applications
  set review_status=next_status,review_reason=nullif(btrim(_reason),''),reviewed_by=auth.uid(),
      reviewed_at=now(),updated_at=now()
  where supplier_id=_supplier_id;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'supplier_verification_reviewed_v2','supplier_verification_applications',_supplier_id::text,
    jsonb_build_object('decision',next_status,'reason',left(coalesce(_reason,''),500)));

  if next_status='approved' and current_supplier_status='pending' then
    perform public.admin_review_supplier(_supplier_id,'approve');
  elsif next_status='rejected' and current_supplier_status='pending' then
    perform public.admin_review_supplier(_supplier_id,'reject');
  end if;

  return jsonb_build_object('supplier_id',_supplier_id,'review_status',next_status);
end;
$function$;

revoke all on function public.admin_review_supplier_verification(uuid,text,text) from public,anon;
grant execute on function public.admin_review_supplier_verification(uuid,text,text) to authenticated;

create or replace function public.admin_list_operational_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','auth'
as $function$
declare result jsonb;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into result
  from (
    select
      p.id as user_id,
      au.email,
      (au.email_confirmed_at is not null) as email_verified,
      p.full_name,
      p.phone,
      p.business_name,
      p.address,
      p.created_at,
      coalesce((select jsonb_agg(ur.role::text order by ur.role::text)
        from public.user_roles ur where ur.user_id=p.id),'[]'::jsonb) as roles,
      s.id as supplier_id,
      s.status as supplier_status,
      sva.review_status as supplier_verification_status,
      d.id as dropshipper_id,
      d.status as dropshipper_status,
      div.review_status as dropshipper_verification_status,
      exists(select 1 from public.supplier_payout_details spd
        where spd.supplier_id=s.id and nullif(btrim(spd.payout_method),'') is not null
          and nullif(btrim(spd.payout_details->>'destination'),'') is not null) as supplier_payout_saved,
      exists(select 1 from public.dropshipper_payout_details dpd
        where dpd.dropshipper_id=d.id and nullif(btrim(dpd.payout_method),'') is not null
          and nullif(btrim(dpd.payout_details->>'destination'),'') is not null) as dropshipper_payout_saved
    from public.profiles p
    join auth.users au on au.id=p.id
    left join public.suppliers s on s.profile_id=p.id
    left join public.supplier_verification_applications sva on sva.supplier_id=s.id
    left join public.dropshippers d on d.profile_id=p.id
    left join public.dropshipper_identity_verifications div on div.dropshipper_id=d.id
    where exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role in ('supplier','dropshipper'))
    order by p.created_at desc
    limit 500
  ) x;

  return result;
end;
$function$;

revoke all on function public.admin_list_operational_accounts() from public,anon,authenticated;
grant execute on function public.admin_list_operational_accounts() to authenticated;

create or replace function public.admin_update_operational_profile(
  _user_id uuid,
  _full_name text,
  _phone text,
  _business_name text,
  _address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  before_row public.profiles%rowtype;
  changed_fields text[]:='{}';
  normalized_business text;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _user_id is null then raise exception 'User is required'; end if;
  if length(btrim(coalesce(_full_name,'')))<2 or length(_full_name)>120 then
    raise exception 'Full name must be between 2 and 120 characters';
  end if;
  if length(regexp_replace(coalesce(_phone,''),'[^0-9+]','','g'))<8 or length(_phone)>40 then
    raise exception 'Enter a valid contact phone number';
  end if;
  if length(coalesce(_business_name,''))>160 then raise exception 'Business name is too long'; end if;
  if _address is not null and (jsonb_typeof(_address)<>'object' or length(_address::text)>2000) then
    raise exception 'Address must be a small JSON object';
  end if;

  select * into before_row from public.profiles where id=_user_id for update;
  if not found then raise exception 'Account not found'; end if;
  if before_row.full_name is distinct from btrim(_full_name) then changed_fields:=array_append(changed_fields,'full_name'); end if;
  if before_row.phone is distinct from btrim(_phone) then changed_fields:=array_append(changed_fields,'phone'); end if;
  if before_row.business_name is distinct from nullif(btrim(_business_name),'') then changed_fields:=array_append(changed_fields,'business_name'); end if;
  if before_row.address is distinct from coalesce(_address,'{}'::jsonb) then changed_fields:=array_append(changed_fields,'address'); end if;

  normalized_business:=nullif(btrim(_business_name),'');
  update public.profiles
  set full_name=btrim(_full_name),
      phone=btrim(_phone),
      business_name=normalized_business,
      address=coalesce(_address,'{}'::jsonb)
  where id=_user_id;

  update public.suppliers set business_name=coalesce(normalized_business,business_name)
  where profile_id=_user_id;
  update public.dropshippers set business_name=coalesce(normalized_business,business_name)
  where profile_id=_user_id;

  if cardinality(changed_fields)>0 then
    insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'admin_operational_profile_updated','profiles',_user_id::text,
      jsonb_build_object('changed_fields',changed_fields));
  end if;
  return jsonb_build_object('user_id',_user_id,'changed_fields',changed_fields);
end;
$function$;

revoke all on function public.admin_update_operational_profile(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.admin_update_operational_profile(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.admin_set_dropshipper_status(
  _dropshipper_id uuid,
  _status text,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare old_status text;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _status not in ('active','suspended') then raise exception 'Choose active or suspended'; end if;
  if _status='suspended' and length(btrim(coalesce(_reason,'')))<8 then
    raise exception 'A clear suspension reason is required';
  end if;
  select status into old_status from public.dropshippers where id=_dropshipper_id for update;
  if not found then raise exception 'Dropshipper not found'; end if;
  update public.dropshippers set status=_status,updated_at=now() where id=_dropshipper_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'dropshipper_status_changed','dropshippers',_dropshipper_id::text,
    jsonb_build_object('from',old_status,'to',_status,'reason',left(coalesce(_reason,''),500)));
  return jsonb_build_object('dropshipper_id',_dropshipper_id,'status',_status);
end;
$function$;

revoke all on function public.admin_set_dropshipper_status(uuid,text,text) from public,anon;
grant execute on function public.admin_set_dropshipper_status(uuid,text,text) to authenticated;

create or replace function public.admin_update_payout_destination(
  _party text,
  _account_id uuid,
  _payout_method text,
  _beneficiary_name text,
  _destination text,
  _bank_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare old_method text; old_details jsonb; next_details jsonb;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _party not in ('supplier','dropshipper') then raise exception 'Choose a valid account type'; end if;
  if _payout_method not in ('instapay','bank_transfer','mobile_wallet') then raise exception 'Choose a valid payout method'; end if;
  if length(btrim(coalesce(_beneficiary_name,'')))<2 or length(_beneficiary_name)>120 then raise exception 'Enter the recipient name'; end if;
  if length(btrim(coalesce(_destination,'')))<4 or length(_destination)>160 then raise exception 'Enter the payout destination'; end if;
  if _payout_method='bank_transfer' and length(btrim(coalesce(_bank_name,'')))<2 then raise exception 'Bank name is required for bank transfers'; end if;

  next_details:=jsonb_build_object('beneficiary_name',btrim(_beneficiary_name),'destination',btrim(_destination));
  if _payout_method='bank_transfer' then next_details:=next_details||jsonb_build_object('bank_name',btrim(_bank_name)); end if;

  if _party='supplier' then
    select payout_method,payout_details into old_method,old_details
      from public.supplier_payout_details where supplier_id=_account_id for update;
    insert into public.supplier_payout_details(supplier_id,payout_method,payout_details,updated_at)
    values(_account_id,_payout_method,next_details,now())
    on conflict(supplier_id) do update set payout_method=excluded.payout_method,payout_details=excluded.payout_details,updated_at=now();
  else
    select payout_method,payout_details into old_method,old_details
      from public.dropshipper_payout_details where dropshipper_id=_account_id for update;
    insert into public.dropshipper_payout_details(dropshipper_id,payout_method,payout_details,updated_at)
    values(_account_id,_payout_method,next_details,now())
    on conflict(dropshipper_id) do update set payout_method=excluded.payout_method,payout_details=excluded.payout_details,updated_at=now();
  end if;

  insert into public.audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),'admin_payout_destination_updated',_party||'_payout_details',_account_id::text,
    jsonb_build_object('method_changed',old_method is distinct from _payout_method,
                       'destination_changed',old_details is distinct from next_details));
  return jsonb_build_object('party',_party,'account_id',_account_id,'payout_method',_payout_method,'updated',true);
end;
$function$;

revoke all on function public.admin_update_payout_destination(text,uuid,text,text,text,text) from public,anon;
grant execute on function public.admin_update_payout_destination(text,uuid,text,text,text,text) to authenticated;

create or replace function private.require_approved_dropshipper_identity(_dropshipper_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','private'
as $function$
begin
  if auth.role()='service_role' or private.has_role(auth.uid(),'admin'::public.app_role) then return; end if;
  if auth.uid() is null or not exists(
    select 1
    from public.dropshippers d
    join auth.users u on u.id=d.profile_id
    where d.id=_dropshipper_id and d.profile_id=auth.uid() and u.email_confirmed_at is not null
  ) or not exists(
    select 1
    from public.dropshipper_identity_verifications v
    where v.dropshipper_id=_dropshipper_id and v.review_status='approved'
  ) then
    raise exception 'Complete identity verification before linking or publishing products';
  end if;
end;
$function$;

create or replace function private.guard_dropshipper_product_link_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $function$
begin
  if tg_op='INSERT' or (new.status='active' and old.status is distinct from 'active') then
    perform private.require_approved_dropshipper_identity(new.dropshipper_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_require_dropshipper_identity_for_product_link on public.dropshipper_product_links;
create trigger trg_require_dropshipper_identity_for_product_link
before insert or update of status on public.dropshipper_product_links
for each row execute function private.guard_dropshipper_product_link_verification();

create or replace function private.guard_dropshipper_store_publish_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $function$
begin
  if new.published is true and (tg_op='INSERT' or old.published is distinct from true) then
    perform private.require_approved_dropshipper_identity(new.dropshipper_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_require_dropshipper_identity_for_store_publish on public.dropshipper_stores;
create trigger trg_require_dropshipper_identity_for_store_publish
before insert or update of published on public.dropshipper_stores
for each row execute function private.guard_dropshipper_store_publish_verification();

create or replace function private.guard_dropshipper_store_product_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare did uuid;
begin
  if tg_op='INSERT' or (new.is_published is true and old.is_published is distinct from true) then
    select dropshipper_id into did from public.dropshipper_stores where id=new.store_id;
    perform private.require_approved_dropshipper_identity(did);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_require_dropshipper_identity_for_store_product on public.dropshipper_store_products;
create trigger trg_require_dropshipper_identity_for_store_product
before insert or update of is_published,store_id,product_link_id on public.dropshipper_store_products
for each row execute function private.guard_dropshipper_store_product_verification();

create or replace function private.guard_dropshipper_store_variant_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare did uuid;
begin
  if tg_op='INSERT' or (new.enabled is true and old.enabled is distinct from true) then
    select ds.dropshipper_id into did
    from public.dropshipper_store_products dsp
    join public.dropshipper_stores ds on ds.id=dsp.store_id
    where dsp.id=new.store_product_id;
    perform private.require_approved_dropshipper_identity(did);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_require_dropshipper_identity_for_store_variant on public.dropshipper_store_product_variants;
create trigger trg_require_dropshipper_identity_for_store_variant
before insert or update of enabled,store_product_id,variant_id on public.dropshipper_store_product_variants
for each row execute function private.guard_dropshipper_store_variant_verification();

commit;
