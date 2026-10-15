-- reminder_email_batch: break ties on the settlement id so the reminder-email function can read
-- the day's items in pages without skipping or repeating rows. Otherwise unchanged.

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
  order by i.user_id, i.kind, s.deadline, s.company, s.id;
$$;
