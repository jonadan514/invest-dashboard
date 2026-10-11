-- ============================================================
-- invest-dashboard — shared personal-backend sync
-- This migration is intentionally additive/idempotent.
-- It reflects the investment tables used by the app after moving
-- from the standalone Supabase project to the shared backend.
-- ============================================================

-- Accounts gained savings/debt planning fields in the shared backend.
alter table public.accounts
  add column if not exists interest_rate numeric,
  add column if not exists monthly_payment numeric,
  add column if not exists maturity_date date,
  add column if not exists is_emergency_fund boolean not null default false;

-- Monthly household allocation history.
create table if not exists public.invest_monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  month text not null,
  joint_savings numeric not null default 0,
  bonus_total numeric not null default 0,
  bonus_to_plan numeric not null default 0,
  cash_balance numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  mortgage_interest numeric not null default 0,
  mortgage_principal numeric not null default 0,
  mortgage_extra_principal numeric not null default 0,
  constraint invest_monthly_budgets_user_id_month_key unique (user_id, month),
  constraint invest_monthly_budgets_month_check
    check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint invest_monthly_budgets_joint_savings_check check (joint_savings >= 0),
  constraint invest_monthly_budgets_bonus_total_check check (bonus_total >= 0),
  constraint invest_monthly_budgets_bonus_to_plan_check check (bonus_to_plan >= 0),
  constraint invest_monthly_budgets_bonus_to_plan_lte_total_check check (bonus_to_plan <= bonus_total),
  constraint invest_monthly_budgets_cash_balance_check check (cash_balance >= 0),
  constraint invest_monthly_budgets_mortgage_interest_check check (mortgage_interest >= 0),
  constraint invest_monthly_budgets_mortgage_principal_check check (mortgage_principal >= 0),
  constraint invest_monthly_budgets_mortgage_extra_principal_check check (mortgage_extra_principal >= 0)
);

alter table public.invest_monthly_budgets enable row level security;

-- Keep the policy explicit to signed-in users. Drop the legacy policy first
-- because the shared backend originally created it for PUBLIC.
drop policy if exists "own monthly budgets" on public.invest_monthly_budgets;
create policy "own monthly budgets"
  on public.invest_monthly_budgets
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Supabase Data API exposure is now explicit for newly-created tables.
-- RLS still controls which rows each signed-in user can access.
grant select, insert, update, delete
  on table public.invest_monthly_budgets
  to authenticated;

create index if not exists idx_invest_monthly_budgets_user_month
  on public.invest_monthly_budgets(user_id, month desc);
