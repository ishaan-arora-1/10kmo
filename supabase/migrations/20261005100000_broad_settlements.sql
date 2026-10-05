-- Settlements most US adults can claim, shown to everyone whatever companies they picked,
-- so every visitor has claims to file. Approved by the owner 2026-10-05.
--
-- These notices set no per-person amount (payments are split pro rata among claimants), so
-- payout_max holds the high end of the published estimate and payout_min stays 0 ("Up to $X"):
--   Non-bank ATM fees: $15–$25 flat payment expected without receipts
--     (cnbc.com/select/visa-mastercard-167-million-dollar-atm-fee-settlement,
--      openclassactions.com/settlements/burke-visa-mastercard-atm-fees-settlement.php)
--   Pork price-fixing: typical household $25–$100
--     (openclassactions.com/settlements/pork-price-fixing-class-action-settlement.php)
--   RealPage rent: estimated $20–$50
--     (claimdepot.com/settlements/realpage-rental-settlement)

update public.settlements
set payout_max = v.payout_max, is_featured = true
from (values
  ('13ad194f-c4b3-5071-8afc-59248754e7e4'::uuid, 25),  -- Visa & Mastercard · Non-bank ATM fees
  ('38714408-60ba-59e6-959d-0d0e4d77626f'::uuid, 100), -- Pork producers · Pork price-fixing
  ('72debd1c-8a4c-5a74-81c0-5eadb2b591ec'::uuid, 50)   -- RealPage · Apartment rent pricing
) as v(id, payout_max)
where settlements.id = v.id and settlements.payout_max = 0;

-- CVS already has court-set amounts ($5–$10); it only becomes visible to everyone.
update public.settlements
set is_featured = true
where id = '988e6c93-a552-536c-b3aa-e6807cafe4c6';
