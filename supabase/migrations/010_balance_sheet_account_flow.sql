-- 금융계좌를 밸런스 시트에서 관리하고 월간 기록과 연결한다.

alter type public.account_type add value if not exists 'cash';
alter type public.account_type add value if not exists 'mmf';

alter table public.accounts
  add column if not exists is_emergency_fund boolean not null default false;

alter table public.account_monthly_snapshots
  add column if not exists monthly_allocation numeric not null default 0
  check (monthly_allocation >= 0);

alter table public.monthly_budgets
  add column if not exists mortgage_interest numeric not null default 0
  check (mortgage_interest >= 0),
  add column if not exists mortgage_principal numeric not null default 0
  check (mortgage_principal >= 0),
  add column if not exists mortgage_extra_principal numeric not null default 0
  check (mortgage_extra_principal >= 0);

comment on column public.accounts.is_emergency_fund is
  '비상금 목표 금액에 합산할 현금성 계좌인지 여부';
comment on column public.account_monthly_snapshots.monthly_allocation is
  '해당 월 공금 잉여금 및 성과급에서 실제로 이 계좌에 배분한 금액';
comment on column public.monthly_budgets.mortgage_interest is
  '해당 월 고정비에 포함된 주택담보대출 이자';
comment on column public.monthly_budgets.mortgage_principal is
  '해당 월 납부한 주택담보대출 정기 원금';
comment on column public.monthly_budgets.mortgage_extra_principal is
  '해당 월 추가 상환한 주택담보대출 원금';
