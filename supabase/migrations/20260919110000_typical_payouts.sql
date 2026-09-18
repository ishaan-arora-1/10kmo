-- payout_typical: what an ordinary claimant actually receives, as opposed to payout_max,
-- which is often a "documented losses" cap only a few people reach (theft, identity fraud).
-- The apps add these up for the estimated total, so the headline number stays realistic.
-- null means "use payout_max"; 0 means the amount varies or is reimbursement-only.
-- Added 2026-09-19.

alter table public.settlements
  add column if not exists payout_typical numeric(10, 2) check (payout_typical is null or payout_typical >= 0);

comment on column public.settlements.payout_typical is
  'Typical per-person payout. null = use payout_max. Used for estimated totals.';

update public.settlements set payout_typical = v.typical
from (values
  -- base cash payment; the $5,000 is for documented identity-theft losses
  ('Data breach', 'Lands'' End', 60),
  -- reimbursement only, for people whose car was actually stolen or damaged
  ('Car theft (no immobilizer)', 'Hyundai', 0),
  ('Car theft (no immobilizer)', 'Kia', 0),
  -- $40 without receipts; more only with repair receipts
  ('Window regulators', 'Kia', 40),
  -- reimbursement of an actual repair
  ('Airbag control units', 'Kia', 0),
  ('Airbag control units', 'Hyundai', 0),
  ('Airbag control units', 'Toyota', 0),
  -- flat no-proof amounts, so the typical payment is the low end
  ('Website & app privacy', 'CVS', 5),
  ('Apple Intelligence & Siri claims', 'Apple', 25)
) as v(title, company, typical)
where settlements.title = v.title and settlements.company = v.company;
