-- Guest checkout: people can pay on the website before they have an account. Paddle collects
-- the email; the webhook and the paddle-guest-session function find (or create) the account
-- for it. Server-only: the functions call this with the service role key.

create or replace function public.account_by_email(p_email text)
returns table (user_id uuid, created_at timestamptz, source text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.created_at, u.raw_app_meta_data ->> 'source'
  from auth.users as u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.account_by_email(text) from public, anon, authenticated;
grant execute on function public.account_by_email(text) to service_role;
