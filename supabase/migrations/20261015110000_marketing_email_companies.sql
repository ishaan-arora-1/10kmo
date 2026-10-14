-- Marketing emails only for the settlements we choose (2026-10-15: Apple and Visa & Mastercard).
-- Same as 20261015100000 plus p_companies: when given, only those settlements are emailed,
-- ordered by how many people tapped them in the last 30 days.

drop function if exists public.marketing_email_batch(integer, integer, integer, integer);

create or replace function public.marketing_email_batch(
  p_limit integer default 500,
  p_top integer default 4,
  p_min_days_left integer default 5,
  p_min_days_between integer default 6,
  p_companies text[] default null
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
    left join public.funnel_events f
      on f.detail = s.company
     and f.name in ('file_locked_tap', 'paywall_seen')
     and f.created_at > now() - interval '30 days'
    where s.status = 'verified'
      and not s.is_sample
      and s.deadline >= current_date + p_min_days_left
      and (s.opens_on is null or s.opens_on <= current_date)
      and (p_companies is null or s.company = any (p_companies))
    group by s.id
    having p_companies is not null or count(f.user_id) > 0
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

revoke all on function public.marketing_email_batch(integer, integer, integer, integer, text[]) from public, anon, authenticated;
grant execute on function public.marketing_email_batch(integer, integer, integer, integer, text[]) to service_role;
