-- Runs the marketing-email function three times a week (Tue, Thu, Sat at 14:30 UTC:
-- 10:30 AM Eastern / 7:30 AM Pacific; an hour earlier in winter). Each run emails only people
-- who haven't heard about the current settlement yet, so mostly new sign-ups after the first run.
-- The function's key lives in Vault as 'marketing_secret' (added outside git). The function
-- itself refuses to send unless MARKETING_EMAILS_ENABLED=true and a postal address is set.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'marketing-emails',
  '30 14 * * 2,4,6',
  $job$
  select net.http_post(
    url := 'https://szwsghcqdcubkynzsxpo.supabase.co/functions/v1/marketing-email',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-marketing-key', (select decrypted_secret from vault.decrypted_secrets where name = 'marketing_secret')
    ),
    body := '{"mode": "send", "limit": 500}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
