-- Settlement check, 2026-11-27. Asked for by the owner ("update the app with new settlements").
-- Prepared locally; not pushed until the owner says so.
--
-- Added: the $400M Sandoz generic-drug price-fixing settlement with state attorneys general
-- (State of Connecticut v. Aurobindo Pharma USA, Inc., No. 3:20-cv-00802-MPS, D. Conn.).
-- People who bought a generic prescription drug on the settlement's drug list between May 2009 and
-- December 2019 may be eligible; claims are due March 8, 2027. The coalition covers 43 to 48 states
-- and territories (the CT and NY press releases list different counts), so the summary tells people
-- to check the list rather than limiting it by state here. No per-person amount is published, so
-- payout_max stays 0 ("Amount varies") and it adds nothing to anyone's total. The press releases
-- don't say what proof the claim form asks for, so it is marked proof_required to be safe.
-- Sources: portal.ct.gov/ag/press-releases/2026-press-releases/settlement-with-sandoz-over-conspiracy-
-- to-inflate-prices-and-limit-competition (Oct 1, 2026); ag.ny.gov/press-release/2026/attorney-general-
-- james-secures-400-million-sandoz-illegal-scheme-inflate-drug (Oct 1, 2026).
-- Shown to people who pick "Generic prescription drugs" or say yes to the app's onboarding question.
--
-- Left out this week: Family Dollar's $40M FTC refund (claim form not open yet; expected around
-- January 2027, add it with real dates once the form is live), Equifax/Upgrade/Thinkware/Amazon
-- (need a notice ID or PIN, or close within days), Hyundai Sonata plug-in battery (narrow),
-- Glenn Beck cruise (proof + notice codes), and state-only, securities, wage and data-breach cases.

insert into public.brands (id, name, category, aliases, monogram_color)
values
  ('ec50dbf4-53f3-5e26-ba4f-0f33de981653', 'Generic prescription drugs', 'Health',
   array['Sandoz', 'generic drugs', 'prescriptions', 'pharmacy']::text[], '#0F6E56')
on conflict do nothing;

insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline,
  is_featured, proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select
  '2c2f44af-60c6-54a8-8f0f-0d17db257201', 'Generic drug prices', 'Sandoz', brands.id, array[]::text[], 0, 0, '2027-03-08',
  false, true,
  'People who bought a generic prescription drug on the settlement''s drug list between May 2009 and December 2019, in one of the participating states. Sandoz settled with state attorneys general over claims it conspired to raise generic drug prices ($400 million). Check the drug and state lists on the official site; the amount depends on how many people file.',
  array[
    'I bought a generic prescription drug between May 2009 and December 2019',
    'The drug is on the settlement''s drug list and I lived in a participating state'
  ],
  'https://aggenericdrugsclaims.com/english/file-a-claim/PageControl/InformationPage', 'After court approval',
  'https://ag.ny.gov/press-release/2026/attorney-general-james-secures-400-million-sandoz-illegal-scheme-inflate-drug',
  '2026-11-27 12:00:00+00', 'verified', false
from public.brands where brands.name = 'Generic prescription drugs'
on conflict (id) do update set
  title = excluded.title, company = excluded.company, brand_id = excluded.brand_id,
  eligible_state_codes = excluded.eligible_state_codes, payout_min = excluded.payout_min,
  payout_max = excluded.payout_max, deadline = excluded.deadline, proof_required = excluded.proof_required,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, source_checked_at = excluded.source_checked_at,
  status = excluded.status, is_sample = excluded.is_sample;
