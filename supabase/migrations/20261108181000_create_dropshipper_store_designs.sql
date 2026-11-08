-- Persist per-store design settings for the native storefront builder.
create table if not exists public.dropshipper_store_designs (
  store_id uuid primary key references public.dropshipper_stores(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dropshipper_store_designs enable row level security;

revoke all privileges on table public.dropshipper_store_designs from public, anon, authenticated;
grant select, insert, update, delete on public.dropshipper_store_designs to authenticated;
grant select on public.dropshipper_store_designs to anon;

create or replace function private.is_published_dropshipper_store(_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dropshipper_stores s
    where s.id = _store_id
      and s.published is true
      and (to_jsonb(s)->>'closed_at') is null
  );
$$;

revoke all on function private.is_published_dropshipper_store(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_published_dropshipper_store(uuid) to anon, authenticated;

drop policy if exists "Dropshippers manage their own store design" on public.dropshipper_store_designs;
create policy "Dropshippers manage their own store design"
on public.dropshipper_store_designs
for all
to authenticated
using (
  exists (
    select 1
    from public.dropshipper_stores s
    join public.dropshippers d on d.id = s.dropshipper_id
    where s.id = dropshipper_store_designs.store_id
      and d.profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.dropshipper_stores s
    join public.dropshippers d on d.id = s.dropshipper_id
    where s.id = dropshipper_store_designs.store_id
      and d.profile_id = (select auth.uid())
  )
);

drop policy if exists "Public can read published store design" on public.dropshipper_store_designs;
create policy "Public can read published store design"
on public.dropshipper_store_designs
for select
to anon, authenticated
using (private.is_published_dropshipper_store(store_id));
