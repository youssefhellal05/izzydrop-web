-- Optional map coordinates for supplier verification applications.
alter table public.supplier_verification_applications
  add column if not exists business_latitude double precision,
  add column if not exists business_longitude double precision;

alter table public.supplier_verification_applications
  drop constraint if exists supplier_verification_location_coordinates_check;
alter table public.supplier_verification_applications
  add constraint supplier_verification_location_coordinates_check
  check (
    (business_latitude is null and business_longitude is null)
    or
    (business_latitude between -90 and 90 and business_longitude between -180 and 180)
  );

create or replace function public.supplier_set_verification_location(_latitude double precision, _longitude double precision)
returns jsonb
language plpgsql security definer set search_path to 'public','private'
as $function$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into sid from public.suppliers
    where profile_id=auth.uid() and status in ('pending','approved') for update;
  if sid is null then raise exception 'An active supplier account is required'; end if;
  if (_latitude is null) <> (_longitude is null) then
    raise exception 'Both map coordinates must be supplied together';
  end if;
  if _latitude is not null and (
    _latitude < -90 or _latitude > 90 or _longitude < -180 or _longitude > 180
  ) then raise exception 'Invalid map coordinates'; end if;
  update public.supplier_verification_applications
    set business_latitude=_latitude,business_longitude=_longitude,updated_at=now()
    where supplier_id=sid;
  if not found then raise exception 'Submit the verification form before saving a map location'; end if;
  return jsonb_build_object('supplier_id',sid,'location_saved',_latitude is not null);
end;
$function$;

revoke all on function public.supplier_set_verification_location(double precision,double precision) from public;
grant execute on function public.supplier_set_verification_location(double precision,double precision) to authenticated;
