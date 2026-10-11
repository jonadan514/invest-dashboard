-- 기존 가구 데이터 조회의 FK 인덱스와 RLS 평가 비용을 최적화한다.

create index if not exists idx_accounts_user_id on public.accounts (user_id);
create index if not exists idx_assets_user_id on public.assets (user_id);
create index if not exists idx_balances_user_id on public.balances (user_id);
create index if not exists idx_transactions_user_id on public.transactions (user_id);

drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own assets" on public.assets;
create policy "own assets" on public.assets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own balances" on public.balances;
create policy "own balances" on public.balances
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own" on public.monthly_budgets;
create policy "own" on public.monthly_budgets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 이 테이블은 서버의 service_role로만 사용하며 일반 클라이언트에는 권한을 주지 않는다.
drop policy if exists "service role only" on public.dashboard_access_attempts;
create policy "service role only" on public.dashboard_access_attempts
  for all to service_role
  using (true)
  with check (true);
