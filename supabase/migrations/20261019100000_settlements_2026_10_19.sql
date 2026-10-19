-- Weekly settlement check, 2026-10-19. Approved by the owner ("do the weekly check").
-- One new national settlement with no receipts needed: Elanco and pet retailers over flea and
-- tick treatment prices ($9.275M). Preliminarily approved Sep 17, 2026; the claim website is due
-- by Jan 8, 2027 and claims close Feb 25, 2027, so it goes in as upcoming (opens_on): shown to
-- people who picked Chewy, Petco or PetSmart, not filable until it opens. The reminder emails
-- send an "it's open" note on opens_on.
-- Source: court order, S.D. Indiana 1:25-cv-00168 (govinfo), summarized by openclassactions.com.
-- Others found this week were left out: state-only (Neutrogena IL, Venetian CA, High 5 WA,
-- Costa FL, Schnucks MO), notice-ID-only or narrow (Navy Federal, TransUnion bankruptcy,
-- Safe Fleet, Telmate, Innovative Renal Care, ConnectOnCall), or closing within days.

insert into public.brands (id, name, category, aliases, monogram_color)
values
  ('e3aaacad-bf49-5a46-aa4e-b57c5b1232d8', 'Petco', 'Shopping', array[]::text[], '#00539F'),
  ('380decc9-695f-5451-a434-d7d7c0a8a0ea', 'PetSmart', 'Shopping', array[]::text[], '#E31837')
on conflict do nothing;

insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, deadline, opens_on,
  is_featured, proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select v.id::uuid, 'Flea & tick treatment prices', v.company, brands.id, array[]::text[], 0, 40, '2027-02-25', '2027-01-08',
       false, false,
       'People in the US who bought K9 Advantix II, Advantage II or other imidacloprid flea and tick treatments for a dog or cat at Chewy, Petco, PetSmart, PetMed Express or Petsense between January 1, 2016 and September 17, 2026. The retailers and Elanco are accused of keeping prices high. $10 per purchase, up to $40 per household without receipts (more with receipts), adjusted by how many people file. Claims open once the settlement website launches, expected by January 8, 2027.',
       v.eligibility_details,
       'https://www.govinfo.gov/app/details/USCOURTS-insd-1_25-cv-00168', 'After the Apr 1, 2027 approval hearing',
       'https://www.govinfo.gov/app/details/USCOURTS-insd-1_25-cv-00168', '2026-10-19 12:00:00+00', 'verified', false
from (values

  (
    '46b3f2e9-9ce0-5fbd-a2d0-f4a5edaaf168', 'Chewy',
    array[
      'I live in the United States',
      'I bought K9 Advantix II or Advantage II flea and tick treatment at Chewy, Petco, PetSmart, PetMed Express or Petsense between Jan 1, 2016 and Sep 17, 2026'
    ]
  ),
  (
    '2e526d0c-6cf3-5288-b99a-17cde82e44ac', 'Petco',
    array[
      'I live in the United States',
      'I bought K9 Advantix II or Advantage II flea and tick treatment at Chewy, Petco, PetSmart, PetMed Express or Petsense between Jan 1, 2016 and Sep 17, 2026'
    ]
  ),
  (
    '23410b46-b5ff-5962-a2c9-d7d98e93fb33', 'PetSmart',
    array[
      'I live in the United States',
      'I bought K9 Advantix II or Advantage II flea and tick treatment at Chewy, Petco, PetSmart, PetMed Express or Petsense between Jan 1, 2016 and Sep 17, 2026'
    ]
  )
) as v(id, company, eligibility_details)
join public.brands on brands.name = v.company
on conflict (id) do update set
  payout_min = excluded.payout_min, payout_max = excluded.payout_max, deadline = excluded.deadline,
  opens_on = excluded.opens_on, qualifies_summary = excluded.qualifies_summary,
  eligibility_details = excluded.eligibility_details, claim_url = excluded.claim_url,
  expected_payout_date = excluded.expected_payout_date, official_notice_url = excluded.official_notice_url,
  status = excluded.status;
