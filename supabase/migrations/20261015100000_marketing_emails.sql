-- Weekly "this settlement is open" emails to US accounts, added 2026-10-15.
-- Each email is about one popular settlement. The marketing-email function (service role)
-- asks for the next batch, sends through Resend and logs every send; email-unsubscribe
-- records opt-outs. Nothing here is visible to the website or to signed-in users.

create table private.marketing_email_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  email text not null,
  resend_id text,
  sent_at timestamptz not null default now(),
  -- Nobody hears about the same settlement twice.
  unique (user_id, settlement_id)
);

create index marketing_email_log_sent_idx on private.marketing_email_log (user_id, sent_at desc);

create table private.marketing_unsubscribes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

grant select, insert on private.marketing_email_log to service_role;
grant select, insert on private.marketing_unsubscribes to service_role;

-- The next email for each eligible person: one settlement each, at most one email per
-- p_min_days_between days. Eligible: US time zone or a US state on file, account older than a
-- day, not unsubscribed, not a test account. Settlements: verified, open now, closing no sooner
-- than p_min_days_left, among the p_top most tapped in the last 30 days. Each person gets the
-- one they showed interest in first (a started claim or a tap), then the most popular, skipping
-- any they filed or already heard about.
create or replace function public.marketing_email_batch(
  p_limit integer default 500,
  p_top integer default 4,
  p_min_days_left integer default 5,
  p_min_days_between integer default 6
)
returns table (
  user_id uuid,
  email text,
  settlement_id uuid,
  company text,
  title text,
  qualifies_summary text,
  payout_max numeric,
  proof_required boolean,
  deadline date
)
language sql
stable
security definer
set search_path = ''
as $$
  with popular as (
    select s.id, count(distinct f.user_id) as people
    from public.settlements s
    join public.funnel_events f
      on f.detail = s.company
     and f.name in ('file_locked_tap', 'paywall_seen')
     and f.created_at > now() - interval '30 days'
    where s.status = 'verified'
      and not s.is_sample
      and s.deadline >= current_date + p_min_days_left
      and (s.opens_on is null or s.opens_on <= current_date)
    group by s.id
    order by people desc, s.id
    limit p_top
  ),
  us_users as (
    select u.id, u.email
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email is not null
      and u.email not ilike 'ishaana61%'
      and u.created_at < now() - interval '1 day'
      and (
        cardinality(coalesce(p.state_codes, '{}')) > 0
        or exists (
          select 1 from public.funnel_events f
          where f.user_id = u.id
            and (f.time_zone like 'America/%' or f.time_zone like 'US/%' or f.time_zone = 'Pacific/Honolulu')
        )
      )
      and not exists (select 1 from private.marketing_unsubscribes m where m.user_id = u.id)
      and not exists (
        select 1 from private.marketing_email_log l
        where l.user_id = u.id and l.sent_at > now() - make_interval(days => p_min_days_between)
      )
  ),
  candidates as (
    select
      us.id as user_id,
      us.email,
      pop.id as settlement_id,
      row_number() over (
        partition by us.id
        order by
          (exists (
            select 1 from public.claims c where c.user_id = us.id and c.settlement_id = pop.id
          ) or exists (
            select 1 from public.funnel_events f
            join public.settlements s2 on s2.id = pop.id
            where f.user_id = us.id and f.detail = s2.company
              and f.name in ('file_locked_tap', 'paywall_seen')
          )) desc,
          pop.people desc,
          pop.id
      ) as pick
    from us_users us
    cross join popular pop
    where not exists (
        select 1 from public.claims c
        where c.user_id = us.id and c.settlement_id = pop.id
          and c.status in ('Filed', 'Approved', 'Paid')
      )
      and not exists (
        select 1 from private.marketing_email_log l
        where l.user_id = us.id and l.settlement_id = pop.id
      )
  )
  select c.user_id, c.email, s.id as settlement_id, s.company, s.title, s.qualifies_summary, s.payout_max,
         s.proof_required, s.deadline
  from candidates c
  join public.settlements s on s.id = c.settlement_id
  where c.pick = 1
  order by c.user_id
  limit p_limit;
$$;

create or replace function public.log_marketing_email(
  p_user_id uuid,
  p_settlement_id uuid,
  p_email text,
  p_resend_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.marketing_email_log (user_id, settlement_id, email, resend_id)
  values (p_user_id, p_settlement_id, p_email, p_resend_id)
  on conflict (user_id, settlement_id) do nothing;
$$;

create or replace function public.marketing_unsubscribe(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.marketing_unsubscribes (user_id)
  select p_user_id where exists (select 1 from auth.users where id = p_user_id)
  on conflict (user_id) do nothing;
$$;

revoke all on function public.marketing_email_batch(integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.log_marketing_email(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.marketing_unsubscribe(uuid) from public, anon, authenticated;
grant execute on function public.marketing_email_batch(integer, integer, integer, integer) to service_role;
grant execute on function public.log_marketing_email(uuid, uuid, text, text) to service_role;
grant execute on function public.marketing_unsubscribe(uuid) to service_role;
