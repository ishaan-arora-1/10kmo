-- Older payouts for the big social apps, shown when a company has nothing in the last 12 months.
-- Drafted by Claude on 2026-09-16 from press coverage of the settlements (source noted per row).

insert into public.recent_payouts (brand_id, company, title, amount_min, amount_max, amount_note, event, event_on, source_url)
select brands.id, v.company, v.title, v.amount_min, v.amount_max, v.amount_note, v.event, v.event_on::date, v.source_url
from (values
  -- source=press; checks sent June 7, 2024, averaging $32.56 (Illinois users)
  ('Instagram', 'Instagram', 'Face filter privacy ($68.5M)', 0, 32.56, 'Average payment to Illinois users', 'paid', '2024-06-07', 'https://www.cbsnews.com/chicago/news/illinois-instagram-privacy-settlement-checks/'),
  -- source=press; claims closed March 1, 2022; about $28 nationwide, about $167 for Illinois users
  ('TikTok', 'TikTok', 'User data privacy ($92M)', 28, 167, 'About $28 nationwide, up to $167 in Illinois', 'claims_closed', '2022-03-01', 'https://www.nbcchicago.com/news/local/judge-approves-92-million-tiktok-settlement-with-illinois-claimants-receiving-biggest-share/2921881/'),
  -- source=press; estimated $58–$117 per Illinois claimant at approval
  ('Snapchat', 'Snapchat', 'Lenses & filters privacy ($35M)', 58, 117, 'Estimated per Illinois user', 'claims_closed', '2022-11-07', 'https://petapixel.com/2022/08/24/snap-reaches-35m-settlement-in-privacy-lawsuit-over-lenses/')
) as v(brand_name, company, title, amount_min, amount_max, amount_note, event, event_on, source_url)
join public.brands on brands.name = v.brand_name
on conflict (brand_id, title) do update set
  amount_min = excluded.amount_min, amount_max = excluded.amount_max, amount_note = excluded.amount_note,
  event = excluded.event, event_on = excluded.event_on, source_url = excluded.source_url;
