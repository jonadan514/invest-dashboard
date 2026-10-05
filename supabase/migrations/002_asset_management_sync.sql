-- ============================================================
-- Asset Management Dashboard — standalone backend sync
-- Additive/idempotent migration for the dedicated Supabase project.
-- ============================================================

-- Account types used by the current UI.
alter type public.account_type add value if not exists 'debt';
alter type public.account_type add value if not exists 'cash';
alter type public.account_type add value if not exists 'mmf';

-- Planning fields used for savings/debt accounts.
alter table public.accounts
  add column if not exists interest_rate numeric,
  add column if not exists monthly_payment numeric,
  add column if not exists maturity_date date,
  add column if not exists is_emergency_fund boolean not null default false;

-- Monthly household allocation history.
create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  month text not null,
  joint_savings integer not null default 0,
  bonus_total integer not null default 0,
  bonus_to_plan integer not null default 0,
  cash_balance integer not null default 0,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  mortgage_interest numeric not null default 0,
  mortgage_principal numeric not null default 0,
  mortgage_extra_principal numeric not null default 0,
  constraint monthly_budgets_user_id_month_key unique (user_id, month),
  constraint monthly_budgets_month_check
    check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint monthly_budgets_joint_savings_check check (joint_savings >= 0),
  constraint monthly_budgets_bonus_total_check check (bonus_total >= 0),
  constraint monthly_budgets_bonus_to_plan_check check (bonus_to_plan >= 0),
  constraint monthly_budgets_bonus_to_plan_lte_total_check check (bonus_to_plan <= bonus_total),
  constraint monthly_budgets_cash_balance_check check (cash_balance >= 0),
  constraint monthly_budgets_mortgage_interest_check check (mortgage_interest >= 0),
  constraint monthly_budgets_mortgage_principal_check check (mortgage_principal >= 0),
  constraint monthly_budgets_mortgage_extra_principal_check check (mortgage_extra_principal >= 0)
);

alter table public.monthly_budgets
  add column if not exists mortgage_interest numeric not null default 0,
  add column if not exists mortgage_principal numeric not null default 0,
  add column if not exists mortgage_extra_principal numeric not null default 0;

alter table public.monthly_budgets enable row level security;

drop policy if exists "own" on public.monthly_budgets;
drop policy if exists "own monthly budgets" on public.monthly_budgets;

create policy "own monthly budgets"
  on public.monthly_budgets
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on table public.monthly_budgets
  to authenticated;

create index if not exists idx_monthly_budgets_user_month
  on public.monthly_budgets(user_id, month desc);
