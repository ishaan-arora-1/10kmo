drop policy if exists "Users can read tracked settlements"
on public.settlements;

create policy "Users can read tracked settlements"
on public.settlements for select
to authenticated
using (
  exists (
    select 1
    from public.claims
    where claims.settlement_id = settlements.id
      and claims.user_id = (select auth.uid())
  )
);
