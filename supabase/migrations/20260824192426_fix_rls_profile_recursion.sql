-- RLS policies need the current platform role/company, which live in
-- public.users. Reading public.users from a policy on public.users recursively
-- re-enters the same policy and Postgres aborts with 42P17. These narrowly
-- scoped helpers run outside RLS, accept no caller-controlled identifier, and
-- can only return data for the current auth.uid(). They live in a non-exposed
-- schema with an immutable search_path.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users as u
  where u.id = (select auth.uid())
$$;

create or replace function private.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.company_id
  from public.users as u
  where u.id = (select auth.uid())
$$;

revoke all on function private.current_user_role() from public;
revoke all on function private.current_user_company_id() from public;
grant execute on function private.current_user_role() to anon, authenticated;
grant execute on function private.current_user_company_id() to anon, authenticated;

-- Preserve the public helper signatures referenced by existing policies, but
-- make them security-invoker wrappers around the private identity lookups.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security invoker
set search_path = ''
as $$ select private.current_user_role() $$;

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$ select private.current_user_company_id() $$;

create or replace function public.is_zoppi_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_user_role() in ('zoppi_admin', 'zoppi_engineer')
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_company_id() from public;
revoke all on function public.is_zoppi_staff() from public;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.current_user_company_id() to anon, authenticated;
grant execute on function public.is_zoppi_staff() to anon, authenticated;

-- Profile mutations go through the API's service-role client and explicit
-- field allowlists. Do not let an authenticated browser update its own role,
-- company_id, or active flag directly through the Data API.
drop policy if exists users_update_self on public.users;
revoke all privileges on table public.users from anon;
revoke insert, update, delete, truncate, references, trigger on table public.users from authenticated;
grant select on table public.users to authenticated;

drop policy if exists users_select on public.users;
create policy users_select on public.users
for select
to authenticated
using (
  (select public.is_zoppi_staff())
  or company_id = (select public.current_user_company_id())
  or id = (select auth.uid())
);
