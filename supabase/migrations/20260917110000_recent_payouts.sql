-- Settlements that closed or paid out in the last 12 months, used to show
-- "what people who used these companies could get in the past year".
-- These are history only: they are never shown as claimable.
-- Drafted by Claude on 2026-09-16 from administrator notices and press coverage (source noted per row).
-- amount_max is the per-person maximum or top of the published estimate, never an invented number.

create table public.recent_payouts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  company text not null,
  title text not null,
  amount_min numeric(10, 2) not null default 0 check (amount_min >= 0),
  amount_max numeric(10, 2) not null check (amount_max > 0),
  amount_note text not null,
  event text not null check (event in ('claims_closed', 'paid')),
  event_on date not null,
  source_url text not null,
  created_at timestamptz not null default now()
);

create index recent_payouts_brand_id_idx on public.recent_payouts (brand_id);
create unique index recent_payouts_brand_title_key on public.recent_payouts (brand_id, title);

alter table public.recent_payouts enable row level security;

create policy "Public can read recent payouts"
on public.recent_payouts for select
to anon, authenticated
using (true);

revoke all on public.recent_payouts from anon, authenticated;
grant select on public.recent_payouts to anon, authenticated;

insert into public.recent_payouts (brand_id, company, title, amount_min, amount_max, amount_note, event, event_on, source_url)
select brands.id, v.company, v.title, v.amount_min, v.amount_max, v.amount_note, v.event, v.event_on::date, v.source_url
from (values
  -- source=press (Kroll administrator site COPPAPrivacyClassAction.com); estimate $40–$200 after fees
  ('Google', 'Google', 'Google Play kids’ app privacy', 40, 200, 'Estimated per family, no proof needed', 'claims_closed', '2026-09-14', 'https://www.coppaprivacyclassaction.com/'),
  -- source=press; administrator says final amount unknown, press estimates $18–$56 per device
  ('Google', 'Google', 'Google Assistant recordings', 18, 56, 'Estimated per Google Home, Nest or Pixel device', 'claims_closed', '2026-08-27', 'https://topclassactions.com/lawsuit-settlements/closed-settlements/68m-google-assistant-privacy-class-action-settlement/'),
  -- source=press; final approval Jan 13, 2026, estimates $20–$30 per claim
  ('YouTube', 'YouTube', 'Kids’ video privacy', 20, 30, 'Estimated per claim', 'claims_closed', '2026-01-21', 'https://youtubeprivacysettlement.com/faqs/'),
  -- source=press (FTC settlement); up to $51 per member
  ('Amazon', 'Amazon', 'Prime sign-up & cancellation refunds', 0, 51, 'Up to $51 per Prime member', 'claims_closed', '2026-07-27', 'https://www.cnbc.com/select/amazon-prime-settlement/'),
  -- source=press; checks sent Jan 23–26, 2026, up to $20 per device, 5 devices max
  ('Apple', 'Apple', 'Siri privacy', 0, 100, 'Up to $20 per device, 5 devices', 'paid', '2026-01-26', 'https://www.npr.org/2025/01/03/g-s1-40940/apple-settle-lawsuit-siri-privacy'),
  -- source=press; first payments averaged about $30 (fall 2025), second round $4.67–$7.32 (June 2026)
  ('Facebook', 'Facebook', 'User privacy ($725M)', 30, 37, 'About $30 in fall 2025 plus $5–$7 in June 2026', 'paid', '2026-06-09', 'https://facebookuserprivacysettlement.com/'),
  -- source=press; up to $5,000 for documented losses (up to $7,500 if in both breaches)
  ('AT&T', 'AT&T', 'Customer data breaches', 0, 5000, 'Up to $5,000 with documented losses', 'claims_closed', '2025-12-18', 'https://www.nbcconnecticut.com/news/national-international/att-data-breach-settlement-deadline-december-18/3677371/'),
  -- source=press; pro-rata payments of about $88–$147 sent in the first half of 2026
  ('Cash App', 'Cash App', 'Account security breach', 88, 147, 'Typical payment, sent in 2026', 'paid', '2026-06-30', 'https://cashappsecuritysettlement.com/')
) as v(brand_name, company, title, amount_min, amount_max, amount_note, event, event_on, source_url)
join public.brands on brands.name = v.brand_name
on conflict (brand_id, title) do update set
  amount_min = excluded.amount_min, amount_max = excluded.amount_max, amount_note = excluded.amount_note,
  event = excluded.event, event_on = excluded.event_on, source_url = excluded.source_url;
