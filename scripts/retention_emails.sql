-- People for scripts/retention_emails.py: paying Paddle members, people on a free trial, and
-- trials whose first charge failed, each with the open claims they can file (same matching as
-- the app: their companies plus the claims open to everyone, within their states, not yet filed).
with people as (
  select distinct on (u.id) u.id, u.email,
    case
      when s.status = 'active' and s.ever_paid then 'member'
      when s.status = 'trialing' then 'trial'
      when s.status = 'past_due' and not s.ever_paid then 'failed'
    end as grp,
    coalesce(p.state_codes, '{}') as state_codes
  from private.paddle_subscriptions s
  join auth.users u on u.id = s.user_id
  join public.profiles p on p.user_id = u.id
  where u.email not ilike 'ishaana61%'
  order by u.id, s.created_at desc
),
claims as (
  select pe.id as user_id, s.id, s.company, s.title, s.payout_min, s.payout_max, s.deadline, s.proof_required,
    row_number() over (partition by pe.id order by s.proof_required, s.deadline, s.company) as n,
    count(*) over (partition by pe.id) as total
  from people pe
  join public.settlements s
    on s.status = 'verified' and not s.is_sample and s.deadline >= current_date
   and (s.opens_on is null or s.opens_on <= current_date)
   and (s.is_featured or exists (select 1 from public.profile_brands pb where pb.user_id = pe.id and pb.brand_id = s.brand_id))
   and (cardinality(s.eligible_state_codes) = 0 or s.eligible_state_codes && pe.state_codes)
   and not exists (select 1 from public.claims c where c.user_id = pe.id and c.settlement_id = s.id and c.status in ('Filed', 'Approved', 'Paid'))
)
select json_agg(json_build_object(
  'user_id', pe.id, 'email', pe.email, 'group', pe.grp,
  'total', coalesce((select max(total) from claims c where c.user_id = pe.id), 0),
  'claims', (select json_agg(c order by c.n) from claims c where c.user_id = pe.id )
)) as people
from people pe
where pe.grp is not null;
