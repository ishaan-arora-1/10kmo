-- Apple reads "Up to $95" (it pays $25 per device, rising to $95 if fewer people claim),
-- and CVS ($5-$10) comes off the open-to-everyone list. People who picked CVS still match it.
-- Added 2026-10-09.

update public.settlements
set payout_min = 0
where id = '0e0a8a5e-4a3f-5d52-9a1e-9b2a1f0d7c31';

update public.settlements
set is_featured = false
where company = 'CVS' and title = 'Website & app privacy';
