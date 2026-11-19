-- Push endpoints belong to the authenticated MK Braids admin who enabled them.
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from service_role;
grant select, delete on public.push_subscriptions to service_role;

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

create policy "MK admins read their own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (public.is_mk_admin_for_push() and user_id = (select auth.uid()));

create policy "MK admins add their own push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (public.is_mk_admin_for_push() and user_id = (select auth.uid()));

create policy "MK admins update their own push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (public.is_mk_admin_for_push() and user_id = (select auth.uid()))
  with check (public.is_mk_admin_for_push() and user_id = (select auth.uid()));

create policy "MK admins delete their own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (public.is_mk_admin_for_push() and user_id = (select auth.uid()));

-- The browser never receives the webhook secret. The URL and secret are read
-- from Supabase Vault by this SECURITY DEFINER trigger function.
create or replace function public.enqueue_new_agendamento_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  function_url text;
  webhook_secret text;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets
  where name = 'push_function_url';

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret';

  if function_url is null or webhook_secret is null then
    raise warning 'Push notification secrets are not configured in Supabase Vault';
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    body := pg_catalog.jsonb_build_object(
      'schema', 'public',
      'table', 'agendamentos',
      'type', 'INSERT',
      'record', pg_catalog.jsonb_build_object('id', new.id)
    ),
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function public.enqueue_new_agendamento_push() from public, anon, authenticated;

drop trigger if exists send_push_after_customer_agendamento on public.agendamentos;
create trigger send_push_after_customer_agendamento
  after insert on public.agendamentos
  for each row execute function public.enqueue_new_agendamento_push();
