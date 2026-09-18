-- Featured settlements are shown to everyone, whatever companies they picked.
-- opens_on marks a settlement whose claim site isn't live yet: it is shown, but not filable.
-- Added 2026-09-19 for the Apple Intelligence / Siri settlement (claims open 2026-09-21).
-- The row starts as 'draft' so it stays hidden until the website code that handles it ships;
-- flip it to 'verified' (and set the real claim_url) once the administrator's site is live.

alter table public.settlements
  add column if not exists opens_on date,
  add column if not exists is_featured boolean not null default false;

comment on column public.settlements.opens_on is
  'Claims cannot be filed before this date; the claim link stays hidden until then.';
comment on column public.settlements.is_featured is
  'Shown to every user, not only those who picked the company.';

insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  opens_on, is_featured, proof_required, qualifies_summary, eligibility_details, claim_url,
  expected_payout_date, official_notice_url, source_checked_at, status, is_sample
)
select
  '0e0a8a5e-4a3f-5d52-9a1e-9b2a1f0d7c31',
  'Apple Intelligence & Siri claims',
  'Apple',
  brands.id,
  array[]::text[],
  25, 95,
  '2026-12-21',
  '2026-09-21',
  true,
  false,
  'People in the US who bought an iPhone 15 Pro, 15 Pro Max, or any iPhone 16 model (including 16e) between June 10, 2024 and March 29, 2025. Apple settled claims that it advertised Apple Intelligence Siri features before they were ready. Each device is worth $25, and up to $95 if few people claim.',
  array[
    'I live in the United States',
    'I bought an iPhone 15 Pro, 15 Pro Max, or an iPhone 16 model between June 10, 2024 and March 29, 2025'
  ],
  'https://www.classaction.org/news/250m-iphone-16-settlement-resolves-apple-lawsuit-over-allegedly-misrepresented-ai-features',
  'After the Feb 24, 2027 approval hearing',
  'https://www.classaction.org/news/250m-iphone-16-settlement-resolves-apple-lawsuit-over-allegedly-misrepresented-ai-features',
  '2026-09-19 12:00:00+00',
  'draft',
  false
from public.brands where brands.name = 'Apple'
on conflict (id) do update set
  title = excluded.title, payout_min = excluded.payout_min, payout_max = excluded.payout_max,
  deadline = excluded.deadline, opens_on = excluded.opens_on, is_featured = excluded.is_featured,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at;
