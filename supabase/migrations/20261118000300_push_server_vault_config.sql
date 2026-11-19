-- Expose push secrets to the sender Edge Function only. This function is in
-- public for PostgREST RPC, but EXECUTE is restricted to service_role.
create or replace function public.get_push_server_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_object_agg(name, decrypted_secret),
    '{}'::jsonb
  )
  from vault.decrypted_secrets
  where name = any (array[
    'push_webhook_secret',
    'vapid_public_key',
    'vapid_private_key',
    'vapid_subject'
  ]::text[]);
$$;

revoke all on function public.get_push_server_config() from public, anon, authenticated;
grant execute on function public.get_push_server_config() to service_role;
