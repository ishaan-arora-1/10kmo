-- Weekly settlement check, 2026-10-15. Approved by the owner. Three new open settlements for
-- brands already in the catalog; not featured (two need a notice ID, one has no set amount), so
-- they show to people who pick Equifax, GoodRx or Amazon.
--   GoodRx: official site checked (goodrxprivacysettlement.com).
--   Amazon: official site checked (returnsettlement.com).
--   Equifax: the official site blocks automated visits; terms from press citing the court notice
--     (openclassactions.com, settlementinsight.com, Yahoo Finance, ginsburglawgroup.com).
-- published_at stays null, as for earlier batches, so no "new settlement" pushes go out.

insert into public.settlements (
  id, title, company, brand_id, eligible_state_codes, payout_min, payout_max, payout_typical, deadline,
  proof_required, qualifies_summary, eligibility_details, claim_url, expected_payout_date,
  official_notice_url, source_checked_at, status, is_sample
)
select v.id::uuid, v.title, v.company, brands.id, array[]::text[], v.payout_min, v.payout_max, null, v.deadline::date,
       false, v.qualifies_summary, v.eligibility_details, v.claim_url, v.expected_payout_date,
       v.official_notice_url, '2026-10-15 12:00:00+00', 'verified', false
from (values
  (
    'd246434f-a115-56cd-9d02-ae5fd5ccd39d', 'Credit score errors', 'Equifax', 'Equifax',
    95, 280, '2026-12-28',
    'People whose credit score was miscalculated by an Equifax coding error and sent to a lender between March 17 and April 8, 2022 (about 4 million people). Estimated $95 to $280 each, depending on how many people file. You need the Claim ID and PIN from the notice sent by email or mail.',
    array[
      'Equifax sent a lender a miscalculated credit score about me between March 17 and April 8, 2022',
      'I got an email or letter about this settlement with a Claim ID and PIN'
    ],
    'https://www.equifaxfaircreditreportingsettlement.com/', 'After the Jan 22, 2027 approval hearing',
    'https://www.equifaxfaircreditreportingsettlement.com/'
  ),
  (
    'e7835de0-916a-566b-87b6-df3e95345b7c', 'Health data privacy', 'GoodRx', 'GoodRx',
    0, 0, '2026-12-29',
    'Anyone in the US who used the GoodRx website or app, including GoodRx Gold, HeyDoctor or GoodRx Care, before April 20, 2024. GoodRx is accused of sharing health data with advertisers. No proof needed; the $32 million fund is split among everyone who files.',
    array[
      'I live in the United States',
      'I used GoodRx (website, app, Gold, HeyDoctor or GoodRx Care) before April 20, 2024'
    ],
    'https://goodrxprivacysettlement.com/file-not-noticed', 'After the Feb 11, 2027 approval hearing',
    'https://goodrxprivacysettlement.com/'
  ),
  (
    'bcc0687d-afc9-510c-92be-f007eec41832', 'Late or missing return refunds', 'Amazon', 'Amazon',
    0, 0, '2026-12-01',
    'Amazon customers whose return refund was missing, late, wrong or later charged back, since September 5, 2017. Most people are paid automatically; only people who got a notice with a Notice ID need to file a claim.',
    array[
      'Amazon didn''t refund a return, refunded it late or wrong, or charged it back',
      'I got an email or letter about this settlement with a Notice ID'
    ],
    'https://www.returnsettlement.com/', 'After the Mar 16, 2027 approval hearing',
    'https://www.returnsettlement.com/'
  )
) as v(id, title, company, brand_name, payout_min, payout_max, deadline, qualifies_summary, eligibility_details,
       claim_url, expected_payout_date, official_notice_url)
join public.brands on brands.name = v.brand_name
on conflict (id) do update set
  payout_min = excluded.payout_min, payout_max = excluded.payout_max, deadline = excluded.deadline,
  qualifies_summary = excluded.qualifies_summary, eligibility_details = excluded.eligibility_details,
  claim_url = excluded.claim_url, expected_payout_date = excluded.expected_payout_date,
  official_notice_url = excluded.official_notice_url, status = excluded.status;
