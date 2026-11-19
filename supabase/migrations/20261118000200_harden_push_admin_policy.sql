-- The existing admin_users RLS policy already lets each signed-in admin read
-- their own row, so this predicate does not need SECURITY DEFINER privileges.
create or replace function public.is_mk_admin_for_push()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users as admins
    where admins.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_mk_admin_for_push() from public, anon;
grant execute on function public.is_mk_admin_for_push() to authenticated;
