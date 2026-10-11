-- 현재 애플리케이션에서 사용하는 재무 계획/대출 기능을 초기 스키마에 보완한다.

alter type account_type add value if not exists 'debt';

alter table accounts
  add column if not exists interest_rate numeric,
  add column if not exists monthly_payment numeric,
  add column if not exists maturity_date date;

alter table accounts
  drop constraint if exists accounts_interest_rate_check,
  add constraint accounts_interest_rate_check
    check (interest_rate is null or interest_rate >= 0),
  drop constraint if exists accounts_monthly_payment_check,
  add constraint accounts_monthly_payment_check
    check (monthly_payment is null or monthly_payment >= 0);

-- 잔액 이력을 같은 날짜 안에서도 안정적으로 정렬하기 위한 생성 시각.
alter table balances
  add column if not exists created_at timestamptz not null default now();

create table if not exists monthly_budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id),
  month          text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  joint_savings  numeric not null default 0 check (joint_savings >= 0),
  bonus_total    numeric not null default 0 check (bonus_total >= 0),
  bonus_to_plan  numeric not null default 0 check (bonus_to_plan >= 0),
  cash_balance   numeric not null default 0 check (cash_balance >= 0),
  memo           text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, month),
  check (bonus_to_plan <= bonus_total)
);

-- 이미 수동으로 만든 monthly_budgets가 있어도 필요한 컬럼을 보강한다.
alter table monthly_budgets
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid default auth.uid() references auth.users(id),
  add column if not exists month text,
  add column if not exists joint_savings numeric not null default 0,
  add column if not exists bonus_total numeric not null default 0,
  add column if not exists bonus_to_plan numeric not null default 0,
  add column if not exists cash_balance numeric not null default 0,
  add column if not exists memo text not null default '',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_monthly_budgets_user_month
  on monthly_budgets(user_id, month);

alter table monthly_budgets enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'monthly_budgets'
      and policyname = 'own monthly budgets'
  ) then
    create policy "own monthly budgets"
      on monthly_budgets
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;
