drop policy if exists "own financial plan settings" on financial_plan_settings;

create policy "own financial plan settings"
  on financial_plan_settings
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
