-- Claim reminder emails, added 2026-10-15. These are account emails about the settlements a
-- person matched (the companies they picked, plus the ones the app shows everyone), as promised
-- on the "Your reminder schedule" step: a reminder 7 days and 1 day before a claim closes, the
-- day an announced claim opens, new settlements for their companies, payout windows for claims
-- they filed, and a weekly list of the claims they can still file. No sales content.
--
-- The reminder-email function (service role) asks for the day's items, sends one email per
-- person through Resend and logs every item, so nothing is sent twice. Sending stays off until
-- REMINDER_EMAILS_ENABLED=true. Nothing here is visible to the website.

create table private.reminder_email_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- deadline:<settlement>:<7|1>, opens:<settlement>, new:<settlement>, payout:<settlement>, weekly:<date>
  item text not null,
  email text not null,
  resend_id text,
  sent_at timestamptz not null default now(),
  primary key (user_id, item)
);

create index reminder_email_log_sent_idx on private.reminder_email_log (user_id, sent_at desc);

grant select, insert on private.reminder_email_log to service_role;

-- Reminders are on for every account. Until now nobody could change this setting (the switch
-- was hidden and the column was false for all), so no one's choice is overridden. The link in
-- each email turns them off.
alter table public.profiles alter column email_reminders set default true;
update public.profiles set email_reminders = true where not email_reminders;

-- An unsubscribe link in any email stops all of them: marketing and reminders.
create or replace function public.marketing_unsubscribe(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.marketing_unsubscribes (user_id)
  select p_user_id where exists (select 1 from auth.users where id = p_user_id)
  on conflict (user_id) do nothing;
  update public.profiles set email_reminders = false where user_id = p_user_id;
$$;

-- Today's reminder items, one row per item and settlement (a weekly list has a row for each
-- claim on it, all with the same item key). Same people as the marketing emails: US accounts
-- (a US state on file or a US time zone), not test accounts, with reminders on. "Today" is US
-- Eastern. Items already logged are left out.
create or replace function public.reminder_email_batch(
  p_today date default (now() at time zone 'America/New_York')::date,
  p_weekly_days integer default 7
)
returns table (
  user_id uuid,
  email text,
  kind text,
  item text,
  settlement_id uuid,
  company text,
  title text,
  qualifies_summary text,
  payout_min numeric,
  payout_max numeric,
  deadline date,
  days_left integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select u.id, u.email, u.created_at, coalesce(p.state_codes, '{}') as state_codes
    from auth.users u
    join public.profiles p on p.user_id = u.id
    where p.email_reminders
      and u.email is not null
      and u.email not ilike 'ishaana61%'
      and (
        cardinality(coalesce(p.state_codes, '{}')) > 0
        or exists (
          select 1 from public.funnel_events f
          where f.user_id = u.id
            and (f.time_zone like 'America/%' or f.time_zone like 'US/%' or f.time_zone = 'Pacific/Honolulu')
        )
      )
  ),
  open_settlements as (
    select s.*
    from public.settlements s
    where s.status = 'verified' and not s.is_sample and s.deadline >= p_today
  ),
  -- What the app shows each person: their companies' settlements plus the featured ones,
  -- within their states, minus what they've filed. Featured ones they didn't pick only appear
  -- in the weekly list; the other reminders are for companies they picked.
  matches as (
    select pe.id as user_id, pe.email, pe.created_at as joined_at, s.id, s.deadline, s.opens_on, s.published_at,
           exists (select 1 from public.profile_brands pb where pb.user_id = pe.id and pb.brand_id = s.brand_id) as picked
    from people pe
    cross join open_settlements s
    where (
        s.is_featured
        or exists (select 1 from public.profile_brands pb where pb.user_id = pe.id and pb.brand_id = s.brand_id)
      )
      and (cardinality(s.eligible_state_codes) = 0 or s.eligible_state_codes && pe.state_codes)
      and not exists (
        select 1 from public.claims c
        where c.user_id = pe.id and c.settlement_id = s.id and c.status in ('Filed', 'Approved', 'Paid')
      )
  ),
  items as (
    -- 7 days and 1 day before a claim closes.
    select m.user_id, m.email, 'deadline' as kind,
           'deadline:' || m.id || ':' || (m.deadline - p_today) as item, m.id as settlement_id
    from matches m
    where m.picked
      and m.deadline - p_today in (7, 1)
      and (m.opens_on is null or m.opens_on <= p_today)
    union all
    -- The day an announced claim opens.
    select m.user_id, m.email, 'opens', 'opens:' || m.id, m.id
    from matches m
    where m.picked and m.opens_on = p_today
    union all
    -- A settlement published in the last two days.
    select m.user_id, m.email, 'new', 'new:' || m.id, m.id
    from matches m
    where m.picked
      and m.published_at > now() - interval '2 days'
      and m.published_at > m.joined_at
      and (m.opens_on is null or m.opens_on <= p_today)
    union all
    -- Payments start for a claim they filed.
    select pe.id, pe.email, 'payout', 'payout:' || s.id, s.id
    from people pe
    join public.claims c on c.user_id = pe.id and c.status in ('Filed', 'Approved')
    join public.settlements s on s.id = c.settlement_id
    where s.payout_window_start = p_today
    union all
    -- Every p_weekly_days days: every claim they can still file, however far off the deadline.
    -- New accounts wait two days for their first one.
    select m.user_id, m.email, 'weekly', 'weekly:' || p_today, m.id
    from matches m
    where (m.opens_on is null or m.opens_on <= p_today)
      and m.joined_at < now() - interval '2 days'
      and not exists (
        select 1 from private.reminder_email_log l
        where l.user_id = m.user_id and l.item like 'weekly:%'
          and l.sent_at > now() - make_interval(days => p_weekly_days) + interval '6 hours'
      )
  )
  select i.user_id, i.email, i.kind, i.item, s.id, s.company, s.title, s.qualifies_summary, s.payout_min, s.payout_max,
         s.deadline, s.deadline - p_today
  from items i
  join public.settlements s on s.id = i.settlement_id
  where not exists (
    select 1 from private.reminder_email_log l where l.user_id = i.user_id and l.item = i.item
  )
  order by i.user_id, i.kind, s.deadline, s.company;
$$;

-- Logs a sent email's items (parallel arrays, one entry per item).
create or replace function public.log_reminder_emails(
  p_user_ids uuid[],
  p_items text[],
  p_emails text[],
  p_resend_ids text[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.reminder_email_log (user_id, item, email, resend_id)
  select * from unnest(p_user_ids, p_items, p_emails, p_resend_ids)
  on conflict (user_id, item) do nothing;
$$;

revoke all on function public.reminder_email_batch(date, integer) from public, anon, authenticated;
revoke all on function public.log_reminder_emails(uuid[], text[], text[], text[]) from public, anon, authenticated;
grant execute on function public.reminder_email_batch(date, integer) to service_role;
grant execute on function public.log_reminder_emails(uuid[], text[], text[], text[]) to service_role;

-- Every day at 14:00 UTC (10 AM Eastern). The function does nothing until
-- REMINDER_EMAILS_ENABLED=true. Uses the same Vault key as the marketing emails.
select cron.schedule(
  'reminder-emails',
  '0 14 * * *',
  $job$
  select net.http_post(
    url := 'https://szwsghcqdcubkynzsxpo.supabase.co/functions/v1/reminder-email',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-marketing-key', (select decrypted_secret from vault.decrypted_secrets where name = 'marketing_secret')
    ),
    body := '{"mode":"send"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
