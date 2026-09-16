-- Real, currently open settlements for launch. Drafted by Claude on 2026-09-16.
-- source=official: confirmed on the settlement administrator's website.
-- source=press: the official site blocked automated access, so details were cross-checked
--   against news coverage and claim trackers that cite the official notice.
-- Payout conventions: payout_max = 0 -> "Amount varies"; payout_min = 0 -> "Up to $X".
-- Expired settlements disappear from the apps automatically after their deadline.

insert into public.brands (id, name, category, aliases, monogram_color)
values
  ('e0ebc9c8-2ca1-5981-8886-d01fb145cd00', 'Flo', 'Health', array['Flo Health', 'period tracker'], '#CC4A57'),
  ('46d7cd91-62d3-5fd9-aa99-c45efe8a4169', 'HireVue', 'Tech', array['video interview'], '#1F61A6'),
  ('bff97071-8072-5e7e-8cb0-47f5cd6c034f', 'VSL#3', 'Health', array['VSL', 'probiotic'], '#0F766E'),
  ('6c6bf775-8e52-5637-bbce-2879c6696e56', 'Lands'' End', 'Shopping', array['Lands End'], '#176084'),
  ('f6de5f15-eb86-5e02-a946-878b839c8c24', 'TED', 'Entertainment', array['TED Talks', 'TED.com'], '#B91C1C'),
  ('f524b42c-cfc3-5b12-a17b-5e0b03d14b59', 'Home purchase (real estate agent)', 'Finance', array['realtor', 'real estate', 'bought a home', 'MLS', 'NAR'], '#5B4B8A'),
  ('5dcbf226-35da-5fe6-95e5-1c009f6240c0', 'Pork & bacon (grocery)', 'Food', array['Tyson', 'Hormel', 'bacon', 'pork', 'Seaboard'], '#9A3412'),
  ('74f6b690-f623-5ce0-9777-1426fdfe435b', 'Bestway', 'Shopping', array['Coleman pool', 'above-ground pool', 'Power Steel'], '#2777C5'),
  ('3ad4aa7d-97e8-566b-b667-a222c9350f89', 'LiveHealth Online', 'Health', array['Anthem', 'Amwell', 'telehealth'], '#168A4B'),
  ('210ec8d4-78c0-5319-8994-772ca2df1391', 'Whirlpool', 'Shopping', array['Maytag', 'KitchenAid', 'JennAir', 'refrigerator'], '#374151'),
  ('bafbcf7f-29fd-5912-aa84-0da1e83f4c9b', 'Levoit', 'Shopping', array['Vesync', 'air purifier'], '#0F766E'),
  ('a8ac8058-5bbf-5348-b65e-6716914e9feb', 'Raging Waters', 'Entertainment', array['water park'], '#2777C5'),
  ('e1227422-3409-5e01-84e7-ea3b9411a303', 'Dr. Squatch', 'Shopping', array['Dr Squatch', 'soap', 'deodorant'], '#4D7C0F'),
  ('17185d80-7eed-5e8b-b432-1c4e83c77896', 'John Deere', 'Auto', array['Deere', 'tractor', 'farm equipment'], '#4D7C0F'),
  ('fc4c6aef-c4ec-53b1-999e-d3adc3347f13', 'Apartment rent (RealPage)', 'Finance', array['RealPage', 'apartment', 'rent', 'renter', 'landlord'], '#606862'),
  ('a7b507c7-b003-530e-867b-13dc7bf7493b', 'Non-bank ATMs', 'Finance', array['ATM', 'ATM fee', 'Allpoint', 'Cardtronics'], '#1E2B24')
on conflict do nothing;

-- Flo · Period tracker privacy (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  'adcf8fe3-a1ca-58e3-ac28-2cbda0391f61', 'Period tracker privacy', 'Flo', brands.id, array[]::text[], 0, 0, '2026-10-15',
  false, 'People in the US who used the Flo app between November 1, 2016 and February 28, 2019 and entered period or pregnancy information. Payments are shared among valid claims.',
  array['I used the Flo app in the US between November 2016 and February 2019', 'I entered period or pregnancy information in the app'],
  'https://www.periodtrackerdataprivacylitigation.com/', 'After final approval',
  'https://www.periodtrackerdataprivacylitigation.com/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Flo'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- HireVue · Video interview biometrics (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '662befbf-7652-5717-b9a2-de9583f5d75b', 'Video interview biometrics', 'HireVue', brands.id, array['IL'], 0, 0, '2026-10-13',
  false, 'Illinois residents who did a HireVue video interview between January 27, 2017 and June 25, 2026 that may have used voice or face analysis.',
  array['I lived in Illinois when I did a HireVue video interview', 'The interview was between January 2017 and June 2026'],
  'https://www.videointerviewbipasettlement.com/form/claim/', 'After Oct 28, 2026 approval',
  'https://cw.simpluris.com/docs/public/downloads/HDC4/LONG_FORM_NOTICE', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'HireVue'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- VSL#3 · Probiotic labeling (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  'ce3f0b46-0864-59ed-aec5-28ccfa48b106', 'Probiotic labeling', 'VSL#3', brands.id, array[]::text[], 0, 0, '2026-10-20',
  false, 'People who bought VSL#3 probiotics between June 1, 2016 and June 19, 2019.',
  array['I bought VSL#3 probiotics', 'I bought them between June 2016 and June 2019'],
  'https://www.vsl3lawsuit.com/', 'After Jan 6, 2027 approval',
  'https://angeion-public.s3.amazonaws.com/www.vsl3lawsuit.com/docs/Notice.pdf', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'VSL#3'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Lands' End · Data breach (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '4880caac-00ab-506b-ab98-9ebce3ce7fa7', 'Data breach', 'Lands'' End', brands.id, array[]::text[], 60, 5000, '2026-10-22',
  false, 'People Lands'' End notified that their information may have been exposed in its December 2024 data incident. About $60 without proof, or up to $5,000 for documented losses.',
  array['I received a notice from Lands'' End about the December 2024 data incident', 'I haven''t already filed this claim'],
  'https://www.landsenddatasettlement.com/', 'After Nov 6, 2026 approval',
  'https://cw.simpluris.com/docs/public/downloads/LJC/LONG_FORM_NOTICE', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Lands'' End'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- TED · Video privacy (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '4c15d649-1dbb-5459-9071-3c6cd73379aa', 'Video privacy', 'TED', brands.id, array[]::text[], 5, 5, '2026-10-26',
  false, 'US TED account holders who watched a pre-recorded video on TED.com or the TED apps between October 19, 2021 and July 14, 2026. $5 cash, reduced if claims exceed the fund.',
  array['I had a TED account and watched a video on TED.com or the TED app', 'I watched between October 2021 and July 2026, in the US'],
  'https://www.tedvppasettlement.com/#your-claim', 'After Nov 12, 2026 approval',
  'https://www.tedvppasettlement.com/assets/uploads/ted_long_form_notice_1787325759.pdf', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'TED'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Real estate brokerages · Homebuyer commissions (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  'baf69d58-f6f0-5724-98d0-8fcb62de7eb1', 'Homebuyer commissions', 'Real estate brokerages', brands.id, array[]::text[], 0, 0, '2026-10-27',
  true, 'People who bought a home in the US that was listed on a Multiple Listing Service (MLS), where a broker commission was paid. Your closing statement showing the commission is required.',
  array['I bought a home in the US that was listed on an MLS', 'I have my closing statement showing a commission was paid'],
  'https://www.homebuyersettlement.com/en', 'After Nov 2, 2026 approval',
  'https://www.homebuyersettlement.com/en/Home/FAQ', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Home purchase (real estate agent)'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Pork producers · Pork price-fixing (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '38714408-60ba-59e6-959d-0d0e4d77626f', 'Pork price-fixing', 'Pork producers', brands.id, array[]::text[], 0, 0, '2026-10-29',
  false, 'People who bought raw pork or bacon at a grocery store in one of 24 covered states between June 28, 2014 and June 30, 2018. Check the state list on the official site before filing.',
  array['I bought raw pork or bacon at a grocery store between June 2014 and June 2018', 'I lived in one of the covered states listed on the official site'],
  'https://www.overchargedforpork.com/', 'After Dec 11, 2026 approval',
  'https://www.overchargedforpork.com/Home/FAQ', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Pork & bacon (grocery)'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Bestway · Above-ground pool straps (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '2a3b8cd0-5ccd-5af4-b614-ff7ca2833460', 'Above-ground pool straps', 'Bestway', brands.id, array[]::text[], 40, 40, '2026-10-30',
  false, 'People in the US who bought a Bestway Power Steel, Steel Pro, or Coleman Power Steel pool 48 inches or taller (straps outside the poles) for personal use, 2008–2024. $40 without a receipt, or 10% of the price with one.',
  array['I bought an eligible Bestway or Coleman above-ground pool for personal use', 'I bought it between 2008 and 2024'],
  'https://poolsettlementbw.pnclassaction.com/', 'After final approval',
  'https://www.poolsettlementbw.com/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Bestway'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- LiveHealth Online · Appointment booking privacy (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '9e986480-c0c4-5e24-9ab4-9078655c5d43', 'Appointment booking privacy', 'LiveHealth Online', brands.id, array[]::text[], 0, 0, '2026-10-30',
  false, 'People who used the Appointment Booking Tool on LiveHealth Online. Payments are shared among valid claims from a $2 million fund.',
  array['I booked an appointment using LiveHealth Online', 'I haven''t already filed this claim'],
  'https://www.livehealthonlinesettlement.com/form/claim', 'After final approval',
  'https://cw.simpluris.com/docs/public/downloads/APC3/NOTICE', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'LiveHealth Online'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Whirlpool · Refrigerator wire harness (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '8d6273e3-0f49-5673-8b44-41288c7f40ee', 'Refrigerator wire harness', 'Whirlpool', brands.id, array[]::text[], 0, 0, '2026-11-02',
  true, 'Owners of side-by-side refrigerators made 2018–2021 under Whirlpool, Maytag, KitchenAid, or JennAir whose ice maker, water dispenser, or door controls failed from broken wires. Free repair or partial cash reimbursement; repair records needed.',
  array['I own a 2018–2021 side-by-side Whirlpool, Maytag, KitchenAid, or JennAir fridge', 'Its ice maker, dispenser, or door controls failed and I have repair records'],
  'https://www.refrigeratorsettlement.com/', 'After final approval',
  'https://www.refrigeratorsettlement.com/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Whirlpool'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Levoit · Air purifier HEPA claims (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '09d32bb7-2556-579b-b4ea-cee564ef8e2d', 'Air purifier HEPA claims', 'Levoit', brands.id, array[]::text[], 10, 10, '2026-11-03',
  true, 'People in the US who bought a Levoit Core or EverestAir air purifier or filter labeled HEPA between August 29, 2019 and August 4, 2023 (not directly from Levoit/Vesync). $10; proof of purchase with the date is required.',
  array['I bought a Levoit Core or EverestAir purifier or filter from a store like Amazon', 'I bought it between August 2019 and August 2023 and have proof'],
  'https://lapsettlement.com/submit-a-claim.html', 'After Feb 17, 2027 approval',
  'https://lapsettlement.com/index.html', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Levoit'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- CVS · Website & app privacy (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '988e6c93-a552-536c-b3aa-e6807cafe4c6', 'Website & app privacy', 'CVS', brands.id, array[]::text[], 5, 10, '2026-11-16',
  false, 'People who used the CVS website or app in the US before July 27, 2026. $5 without proof, $10 with proof such as browser history or email receipts. One claim per household.',
  array['I used the CVS website or app in the US before July 27, 2026', 'No one else in my household has filed this claim'],
  'https://www.cvsdigitalprivacysettlement.com/form/open', 'After Dec 1, 2026 approval',
  'https://www.cvsdigitalprivacysettlement.com/faq', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'CVS'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Kia · Window regulators (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '9831b3d0-f92a-54cd-a9cc-2e4df08894f5', 'Window regulators', 'Kia', brands.id, array[]::text[], 40, 400, '2026-11-23',
  true, 'Current or past owners and lessees of a 2016–2017 Kia Optima or 2017 Kia Sportage. Up to $400 per window regulator repair with receipts, or a $40 dealer service card.',
  array['I own or owned (or leased) a 2016–2017 Kia Optima or a 2017 Kia Sportage', 'I paid for a window regulator repair, or want the $40 service card'],
  'https://kiawindowregulatorsettlement.com/', 'After Jan 7, 2027 approval',
  'https://kiawindowregulatorsettlement.com/faq', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Kia'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Raging Waters · Ticket processing fees (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  'ad6579a3-ae44-5c10-8d73-45e549c8483e', 'Ticket processing fees', 'Raging Waters', brands.id, array[]::text[], 0, 0, '2026-11-24',
  false, 'US residents who bought tickets on ragingwaters.com and paid a processing fee between June 1, 2020 and June 22, 2026. Payments depend on the fees you paid and the number of claims.',
  array['I bought Raging Waters tickets on ragingwaters.com and paid a processing fee', 'I bought them between June 2020 and June 2026'],
  'https://www.ragingwaterssettlement.com/', 'After Nov 9, 2026 approval',
  'https://angeion-public.s3.amazonaws.com/www.ragingwaterssettlement.com/docs/Long+Notice.pdf', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Raging Waters'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Dr. Squatch · “All natural” labeling (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  'fd27ebe9-16a1-5ab8-ad59-0118da487a54', '“All natural” labeling', 'Dr. Squatch', brands.id, array[]::text[], 0, 0, '2026-11-27',
  false, 'People who bought covered Dr. Squatch products in the US between November 1, 2018 and August 29, 2026. Small payments per product, shared among valid claims.',
  array['I bought Dr. Squatch products in the US', 'I bought them between November 2018 and August 2026'],
  'https://personalcareproductssettlement.pnclassaction.com/', 'After Mar 2, 2027 approval',
  'https://www.personalcareproductssettlement.com/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Dr. Squatch'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Toyota · Airbag control units (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  'd4c60729-e937-50f4-a837-19b8da135bf9', 'Airbag control units', 'Toyota', brands.id, array[]::text[], 0, 250, '2026-12-16',
  false, 'People who owned or leased, as of July 31, 2023, a 2011–2019 Corolla, 2011–2013 Corolla Matrix, 2012–2018 Avalon or Avalon Hybrid, 2012–2019 Tacoma, or 2012–2017 Tundra or Sequoia. Up to $250; you''ll need your VIN.',
  array['I owned or leased one of the listed Toyota models as of July 31, 2023', 'I have the vehicle''s VIN'],
  'https://www.airbagcontrolunitsettlement.com/', 'Rolling payments',
  'https://www.airbagcontrolunitsettlement.com/home/documents/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Toyota'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Kroger · Pharmacy Savings Club prices (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  'a3d7e844-dfed-5361-a9c0-39716b11f211', 'Pharmacy Savings Club prices', 'Kroger', brands.id, array[]::text[], 0, 0, '2026-12-21',
  false, 'People who paid for prescriptions at a Kroger pharmacy using insurance during the class period (December 2018 to August 2026). No documents needed unless you claim $8,000 or more.',
  array['I filled a prescription at a Kroger pharmacy using insurance', 'It was between December 2018 and August 2026'],
  'https://www.krogersavingsclubsettlement.com/', 'After final approval',
  'https://angeion-public.s3.amazonaws.com/www.krogersavingsclubsettlement.com/docs/Kirkbride%20v%20Kroger%20-%20Long-Form%20Notice_Final.pdf', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Kroger'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- John Deere · Farm equipment repairs (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '0f285c3a-5bbd-5b06-92e2-95c18ba583c1', 'Farm equipment repairs', 'John Deere', brands.id, array[]::text[], 0, 0, '2026-12-31',
  false, 'People and businesses in the US who paid John Deere or an authorized dealer for repairs to Deere large agricultural equipment between January 10, 2018 and May 18, 2026.',
  array['I paid John Deere or a Deere dealer to repair large farm equipment', 'The repairs were between January 2018 and May 2026, in the US'],
  'https://www.deererepairsettlement.com/submit-claim', 'After Jan 19, 2027 approval',
  'https://www.deererepairsettlement.com/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'John Deere'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- RealPage · Apartment rent pricing (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '72debd1c-8a4c-5a74-81c0-5eadb2b591ec', 'Apartment rent pricing', 'RealPage', brands.id, array[]::text[], 0, 0, '2027-01-29',
  true, 'People who paid rent on a multifamily apartment lease in the US between October 18, 2018 and November 21, 2025 at a property using RealPage pricing software. Without a notice ID you''ll need proof of rent paid.',
  array['I rented an apartment in a multifamily building between October 2018 and November 2025', 'I have my notice ID or proof of the rent I paid'],
  'https://www.realpagerentalsettlement.com/', 'After final approval',
  'https://angeion-public.s3.amazonaws.com/www.realpagerentalsettlement.com/docs/RealPage-Summary%20Notice.pdf', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Apartment rent (RealPage)'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Visa & Mastercard · Non-bank ATM fees (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '13ad194f-c4b3-5071-8afc-59248754e7e4', 'Non-bank ATM fees', 'Visa & Mastercard', brands.id, array[]::text[], 0, 0, '2027-02-10',
  false, 'People in the US charged a surcharge to withdraw cash at an independent (non-bank) ATM between October 24, 2007 and August 14, 2026, and not fully reimbursed by their bank. No receipts required.',
  array['I paid a fee at an independent ATM (not my bank''s) in the US since 2007', 'My bank didn''t fully refund that fee'],
  'https://www.nonbankatmsurchargesettlement.com/file', 'After Feb 17, 2027 approval',
  'https://www.nonbankatmsurchargesettlement.com/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Non-bank ATMs'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Hyundai · Car theft (no immobilizer) (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '62058d44-237c-5842-bd3a-e9e08044aae1', 'Car theft (no immobilizer)', 'Hyundai', brands.id, array[]::text[], 0, 4500, '2027-03-31',
  true, 'Owners of a 2011–2022 Hyundai or Kia without a factory engine immobilizer that had the anti-theft software upgrade (or an appointment) when it was stolen or broken into on or after April 29, 2025. Up to $375 for expenses, $2,250 partial loss, or $4,500 total loss, while funds last.',
  array['I own a 2011–2022 Hyundai without a factory immobilizer that had the theft software upgrade', 'It was stolen or broken into on or after April 29, 2025'],
  'https://www.hkmultistateimmobilizersettlement.com/', 'Rolling, while funds last',
  'https://www.hkmultistateimmobilizersettlement.com/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Hyundai'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Hyundai · Airbag control units (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '567edac4-f3a0-5049-b45e-69fb2b9d8f0f', 'Airbag control units', 'Hyundai', brands.id, array[]::text[], 0, 350, '2027-04-08',
  false, 'People who, on April 14, 2025, owned or leased (or previously owned or leased) certain 2010–2023 Hyundai Sonata, Kona, or Veloster or Kia Forte, Optima, or Sedona models sold in the US. Up to $350 for recalled vehicles or $150 otherwise, plus documented expenses.',
  array['I own or owned an eligible Sonata, Kona, or Veloster (2010–2023)', 'The vehicle was originally sold or leased in the US'],
  'https://www.acusettlement.com/hyundaikia/claim', 'After final approval',
  'https://www.acusettlement.com/hyundaikia', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Hyundai'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Kia · Car theft (no immobilizer) (source=press)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '166cf546-956a-5acb-9110-7fcbf686e2ab', 'Car theft (no immobilizer)', 'Kia', brands.id, array[]::text[], 0, 4500, '2027-03-31',
  true, 'Owners of a 2011–2022 Hyundai or Kia without a factory engine immobilizer that had the anti-theft software upgrade (or an appointment) when it was stolen or broken into on or after April 29, 2025. Up to $375 for expenses, $2,250 partial loss, or $4,500 total loss, while funds last.',
  array['I own a 2011–2022 Kia without a factory immobilizer that had the theft software upgrade', 'It was stolen or broken into on or after April 29, 2025'],
  'https://www.hkmultistateimmobilizersettlement.com/', 'Rolling, while funds last',
  'https://www.hkmultistateimmobilizersettlement.com/', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Kia'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;

-- Kia · Airbag control units (source=official)
insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '87783b9e-4c3d-5feb-a72e-61b4b97dfbda', 'Airbag control units', 'Kia', brands.id, array[]::text[], 0, 350, '2027-04-08',
  false, 'People who, on April 14, 2025, owned or leased (or previously owned or leased) certain 2010–2023 Hyundai Sonata, Kona, or Veloster or Kia Forte, Optima, or Sedona models sold in the US. Up to $350 for recalled vehicles or $150 otherwise, plus documented expenses.',
  array['I own or owned an eligible Forte, Optima, or Sedona (2010–2023)', 'The vehicle was originally sold or leased in the US'],
  'https://www.acusettlement.com/hyundaikia/claim', 'After final approval',
  'https://www.acusettlement.com/hyundaikia', '2026-09-16 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Kia'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;
