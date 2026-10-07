-- Claim links must go to the court-approved settlement site, never a news article,
-- and Apple becomes the one highlighted claim at the top of every list.
-- Added 2026-10-08.

-- Apple Siri / Apple Intelligence: was a classaction.org news article.
update public.settlements
set claim_url = 'https://www.smartphoneaisettlement.com/'
where id = '0e0a8a5e-4a3f-5d52-9a1e-9b2a1f0d7c31';

-- Bestway and Dr. Squatch: the court-approved domains named in their notices.
update public.settlements
set claim_url = 'https://www.poolsettlementbw.com/'
where claim_url = 'https://poolsettlementbw.pnclassaction.com/';

update public.settlements
set claim_url = 'https://www.personalcareproductssettlement.com/'
where claim_url = 'https://personalcareproductssettlement.pnclassaction.com/';

-- Bestway pays 10% of the purchase price with proof of purchase.
update public.settlements
set proof_required = true
where claim_url = 'https://www.poolsettlementbw.com/';

-- One settlement shown first and highlighted for everyone.
alter table public.settlements add column if not exists is_spotlight boolean not null default false;

update public.settlements
set is_spotlight = true
where id = '0e0a8a5e-4a3f-5d52-9a1e-9b2a1f0d7c31';
