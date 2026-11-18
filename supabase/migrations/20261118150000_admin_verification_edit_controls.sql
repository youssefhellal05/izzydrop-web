-- Admin correction controls for submitted verification records.
-- Document blobs remain private and are viewed through expiring signed URLs.

begin;

create or replace function public.admin_update_supplier_verification_details(
  _supplier_id uuid,
  _legal_name text,
  _business_address text,
  _business_phone text,
  _business_maps_url text,
  _registration_status text,
  _registration_number text,
  _tax_registration_number text,
  _supplier_notes text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  before_row public.supplier_verification_applications%rowtype;
  changed_fields text[]:='{}';
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _supplier_id is null then raise exception 'Supplier is required'; end if;
  if length(btrim(coalesce(_legal_name,'')))<3 or length(_legal_name)>120 then raise exception 'Enter a valid legal name'; end if;
  if length(btrim(coalesce(_business_address,'')))<8 or length(_business_address)>400 then raise exception 'Enter a complete business address'; end if;
  if length(regexp_replace(coalesce(_business_phone,''),'[^0-9+]','','g'))<7 or length(_business_phone)>40 then raise exception 'Enter a valid business phone number'; end if;
  if _registration_status not in ('registered','in_progress','not_registered') or _registration_status is null then raise exception 'Choose a valid registration status'; end if;
  if length(coalesce(_registration_number,''))>100 or length(coalesce(_tax_registration_number,''))>100 or length(coalesce(_supplier_notes,''))>1500 then raise exception 'A verification field is too long'; end if;
  if _business_maps_url is not null and (
    length(_business_maps_url)>500 or
    _business_maps_url !~* '^https://(maps\.app\.goo\.gl/|www\.google\.[^/]+/maps|maps\.google\.[^/]+/)'
  ) then raise exception 'Use a valid Google Maps URL or leave it blank'; end if;

  select * into before_row from public.supplier_verification_applications
  where supplier_id=_supplier_id for update;
  if not found then raise exception 'Supplier verification record not found'; end if;

  if _registration_status='registered'
     and (nullif(btrim(_registration_number),'') is null or nullif(btrim(before_row.registration_document_path),'') is null) then
    raise exception 'Registered businesses must retain a commercial registration number and document';
  end if;
  if (nullif(btrim(_tax_registration_number),'') is null) <> (nullif(btrim(before_row.tax_document_path),'') is null) then
    raise exception 'Tax registration number and document must be supplied together';
  end if;

  if before_row.legal_name is distinct from btrim(_legal_name) then changed_fields:=array_append(changed_fields,'legal_name'); end if;
  if before_row.business_address is distinct from btrim(_business_address) then changed_fields:=array_append(changed_fields,'business_address'); end if;
  if before_row.business_phone is distinct from btrim(_business_phone) then changed_fields:=array_append(changed_fields,'business_phone'); end if;
  if before_row.business_maps_url is distinct from nullif(btrim(_business_maps_url),'') then changed_fields:=array_append(changed_fields,'business_maps_url'); end if;
  if before_row.registration_status is distinct from _registration_status then changed_fields:=array_append(changed_fields,'registration_status'); end if;
  if before_row.registration_number is distinct from nullif(btrim(_registration_number),'') then changed_fields:=array_append(changed_fields,'registration_number'); end if;
  if before_row.tax_registration_number is distinct from nullif(btrim(_tax_registration_number),'') then changed_fields:=array_append(changed_fields,'tax_registration_number'); end if;
  if before_row.supplier_notes is distinct from nullif(btrim(_supplier_notes),'') then changed_fields:=array_append(changed_fields,'supplier_notes'); end if;

  update public.supplier_verification_applications
  set legal_name=btrim(_legal_name),
      business_address=btrim(_business_address),
      business_phone=btrim(_business_phone),
      business_maps_url=nullif(btrim(_business_maps_url),''),
      registration_status=_registration_status,
      registration_number=nullif(btrim(_registration_number),''),
      tax_registration_number=nullif(btrim(_tax_registration_number),''),
      supplier_notes=nullif(btrim(_supplier_notes),''),
      updated_at=now()
  where supplier_id=_supplier_id;

  if cardinality(changed_fields)>0 then
    insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'admin_supplier_verification_details_updated','supplier_verification_applications',_supplier_id::text,
      jsonb_build_object('changed_fields',changed_fields));
  end if;
  return jsonb_build_object('supplier_id',_supplier_id,'changed_fields',changed_fields);
end;
$function$;

revoke all on function public.admin_update_supplier_verification_details(uuid,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.admin_update_supplier_verification_details(uuid,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.admin_update_dropshipper_verification_details(
  _dropshipper_id uuid,
  _legal_name text,
  _residential_address text,
  _residential_maps_url text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  before_row public.dropshipper_identity_verifications%rowtype;
  changed_fields text[]:='{}';
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;
  if _dropshipper_id is null then raise exception 'Dropshipper is required'; end if;
  if length(btrim(coalesce(_legal_name,'')))<3 or length(_legal_name)>120 then raise exception 'Enter a valid legal name'; end if;
  if length(btrim(coalesce(_residential_address,'')))<8 or length(_residential_address)>500 then raise exception 'Enter a complete residential address'; end if;
  if _residential_maps_url is not null and (
    length(_residential_maps_url)>500 or
    _residential_maps_url !~* '^https://(maps\.app\.goo\.gl/|www\.google\.[^/]+/maps|maps\.google\.[^/]+/)'
  ) then raise exception 'Use a valid Google Maps URL or leave it blank'; end if;

  select * into before_row from public.dropshipper_identity_verifications
  where dropshipper_id=_dropshipper_id for update;
  if not found then raise exception 'Dropshipper identity record not found'; end if;

  if before_row.legal_name is distinct from btrim(_legal_name) then changed_fields:=array_append(changed_fields,'legal_name'); end if;
  if before_row.residential_address is distinct from btrim(_residential_address) then changed_fields:=array_append(changed_fields,'residential_address'); end if;
  if before_row.residential_maps_url is distinct from nullif(btrim(_residential_maps_url),'') then changed_fields:=array_append(changed_fields,'residential_maps_url'); end if;

  update public.dropshipper_identity_verifications
  set legal_name=btrim(_legal_name),
      residential_address=btrim(_residential_address),
      residential_maps_url=nullif(btrim(_residential_maps_url),''),
      updated_at=now()
  where dropshipper_id=_dropshipper_id;

  if cardinality(changed_fields)>0 then
    insert into public.audit_log(actor_id,action,target_table,target_id,details)
    values(auth.uid(),'admin_dropshipper_verification_details_updated','dropshipper_identity_verifications',_dropshipper_id::text,
      jsonb_build_object('changed_fields',changed_fields));
  end if;
  return jsonb_build_object('dropshipper_id',_dropshipper_id,'changed_fields',changed_fields);
end;
$function$;

revoke all on function public.admin_update_dropshipper_verification_details(uuid,text,text,text) from public,anon;
grant execute on function public.admin_update_dropshipper_verification_details(uuid,text,text,text) to authenticated;

commit;
