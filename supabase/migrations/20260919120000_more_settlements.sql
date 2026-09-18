-- More real money for common picks: one open settlement tied to a brand people already choose,
-- plus three big settlements that closed in the last 12 months (shown as "you missed").
-- Drafted by Claude on 2026-09-19. source=press (openclassactions.com summaries of the official notices).

-- Bank of America customers caught in the 2023 MOVEit breach (notice sent by Ernst & Young).
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, payout_typical, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  'b2d4c1a6-3f77-5c8b-9d21-6e0f5a4b7c92',
  'MOVEit data breach', 'Bank of America', brands.id, array[]::text[],
  100, 10000, 100, '2026-10-08',
  false,
  'Bank of America customers who were notified by Ernst & Young that their information was exposed in the 2023 MOVEit breach. $100 without any paperwork, or more if you can document losses.',
  array[
    'I am a Bank of America customer',
    'I received a notice about the 2023 MOVEit data breach'
  ],
  'https://www.moveitsettlementeyboa.com/', 'After final approval',
  'https://www.moveitsettlementeyboa.com/', '2026-09-19 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Bank of America'
on conflict (id) do update set
  payout_min = excluded.payout_min, payout_max = excluded.payout_max,
  payout_typical = excluded.payout_typical, deadline = excluded.deadline,
  qualifies_summary = excluded.qualifies_summary, claim_url = excluded.claim_url,
  official_notice_url = excluded.official_notice_url, status = excluded.status;

-- Closed in the last 12 months, so people see what they missed.
insert into public.recent_payouts (brand_id, company, title, amount_min, amount_max, amount_note, event, event_on, source_url)
select brands.id, v.company, v.title, v.amount_min, v.amount_max, v.amount_note, v.event, v.event_on::date, v.source_url
from (values
  ('23andMe', '23andMe', 'DNA data breach ($46.75M)', 100, 10000, '$100 base, more with documented losses', 'claims_closed', '2026-02-17', 'https://www.23andmedatasettlement.com/faq'),
  ('Comcast Xfinity', 'Comcast Xfinity', 'Customer data breach ($117.5M)', 50, 10000, '$50 without paperwork', 'claims_closed', '2026-08-14', 'https://openclassactions.com/news/comcast-data-breach-class-action-settlement.php'),
  ('Labcorp', 'Labcorp', 'AMCA billing data breach', 50, 5000, '$50 without paperwork', 'claims_closed', '2026-09-03', 'https://openclassactions.com/settlements/labcorp-amca-data-breach-class-action-settlement.php')
) as v(brand_name, company, title, amount_min, amount_max, amount_note, event, event_on, source_url)
join public.brands on brands.name = v.brand_name
on conflict (brand_id, title) do update set
  amount_min = excluded.amount_min, amount_max = excluded.amount_max, amount_note = excluded.amount_note,
  event = excluded.event, event_on = excluded.event_on, source_url = excluded.source_url;
