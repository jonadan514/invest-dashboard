-- Shared personal-backend investment app additions. No family/schedule objects are altered.
-- Apply shared-enums.sql first. This file is one atomic migration, with no data import.
set local search_path = public, pg_catalog;
do $guard$
declare v_name text;
begin
  foreach v_name in array array['invest_monthly_budgets', 'invest_financial_plan_settings', 'invest_net_worth_items', 'invest_net_worth_snapshots', 'invest_household_settings', 'invest_household_goals', 'invest_portfolio_snapshots', 'invest_account_monthly_snapshots', 'invest_children', 'invest_child_gift_deposits', 'invest_child_accounts', 'invest_child_account_monthly_snapshots', 'invest_dashboard_access_attempts'] loop
    if to_regclass('public.' || v_name) is not null then
      raise exception 'Refusing to overwrite existing table: %', v_name;
    end if;
  end loop;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname in ('invest_save_household_monthly_record', 'invest_restore_household_backup', 'invest_dashboard_access_retry_after', 'invest_record_dashboard_access_failure', 'invest_clear_dashboard_access_failures')) then
    raise exception 'Refusing to overwrite an existing invest RPC';
  end if;
end
$guard$;
-- SOURCE: 002_complete_finance_features.sql
-- 현재 애플리케이션에서 사용하는 재무 계획/대출 기능을 초기 스키마에 보완한다.


alter table accounts
  add column if not exists interest_rate numeric,
  add column if not exists monthly_payment numeric,
  add column if not exists maturity_date date;

alter table accounts
  add constraint accounts_interest_rate_check
    check (interest_rate is null or interest_rate >= 0),
  add constraint accounts_monthly_payment_check
    check (monthly_payment is null or monthly_payment >= 0);

-- 잔액 이력을 같은 날짜 안에서도 안정적으로 정렬하기 위한 생성 시각.
alter table balances
  add column if not exists created_at timestamptz not null default now();

create table if not exists invest_monthly_budgets (
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
alter table invest_monthly_budgets
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

create unique index if not exists idx_invest_monthly_budgets_user_month
  on invest_monthly_budgets(user_id, month);

alter table invest_monthly_budgets enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invest_monthly_budgets'
      and policyname = 'own monthly budgets'
  ) then
    create policy "own monthly budgets"
      on invest_monthly_budgets
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;


-- SOURCE: 003_financial_plan_settings.sql
-- 재무계획 기준값과 3단계 배분 비율을 Supabase에서 단일 관리한다.

create table if not exists invest_financial_plan_settings (
  user_id                       uuid primary key references auth.users(id) on delete cascade,
  monthly_fixed_cost            numeric not null default 3700000,
  mortgage_interest             numeric not null default 2500000,
  mortgage_principal            numeric not null default 450000,
  monthly_joint_contribution    numeric not null default 7000000,
  current_emergency_fund        numeric not null default 13000000,
  stage1_target                 numeric not null default 30000000,
  stage2_target                 numeric not null default 50000000,
  stage1_emergency_ratio        numeric not null default 1,
  stage2_emergency_ratio        numeric not null default 0.8,
  stage2_investment_ratio       numeric not null default 0.2,
  completed_investment_ratio    numeric not null default 0.5,
  completed_property_ratio      numeric not null default 0.5,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  check (monthly_fixed_cost >= 0),
  check (mortgage_interest >= 0),
  check (mortgage_principal >= 0),
  check (monthly_joint_contribution >= 0),
  check (current_emergency_fund >= 0),
  check (stage1_target > 0),
  check (stage2_target > stage1_target),
  check (stage1_emergency_ratio = 1),
  check (stage2_emergency_ratio between 0 and 1),
  check (stage2_investment_ratio between 0 and 1),
  check (abs(stage2_emergency_ratio + stage2_investment_ratio - 1) < 0.0001),
  check (completed_investment_ratio between 0 and 1),
  check (completed_property_ratio between 0 and 1),
  check (abs(completed_investment_ratio + completed_property_ratio - 1) < 0.0001)
);

alter table invest_financial_plan_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invest_financial_plan_settings'
      and policyname = 'own financial plan settings'
  ) then
    create policy "own financial plan settings"
      on invest_financial_plan_settings
      for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;


-- SOURCE: 004_optimize_financial_plan_rls.sql
drop policy if exists "own financial plan settings" on invest_financial_plan_settings;

create policy "own financial plan settings"
  on invest_financial_plan_settings
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- SOURCE: 005_document_financial_plan_semantics.sql
comment on column invest_financial_plan_settings.monthly_fixed_cost is
  '월 공금 납입금에서 배분 전에 한 번 차감하는 고정비 총액';

comment on column invest_financial_plan_settings.monthly_joint_contribution is
  '가구가 매월 납입하는 공금 총액. 고정비 차감 후 잉여금만 단계별 배분';

comment on column invest_financial_plan_settings.mortgage_interest is
  '월 고정비에 포함된 주담대 이자 구성액. 향후 부채·순자산 계산용';

comment on column invest_financial_plan_settings.mortgage_principal is
  '월 고정비에 포함된 주담대 원금 상환액. 향후 부채·순자산 계산용';


-- SOURCE: 006_household_net_worth.sql
-- 가족 자산·부채 항목과 월말 잔액을 별도로 관리한다.
-- 투자 거래 원장(accounts/transactions)과 분리하여 부동산, 보증금, 차량 등도
-- 동일한 기준으로 월 1회 직접 기록할 수 있게 한다.

create table if not exists invest_net_worth_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  kind        text not null check (kind in ('asset', 'liability')),
  category    text not null,
  owner       text not null default 'household' check (owner in ('household', 'me', 'spouse')),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists invest_net_worth_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id     uuid not null references invest_net_worth_items(id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount      numeric not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, item_id, month)
);

create index if not exists idx_invest_net_worth_items_user
  on invest_net_worth_items(user_id, kind, sort_order, created_at);

create index if not exists idx_invest_net_worth_snapshots_user_month
  on invest_net_worth_snapshots(user_id, month desc);

create index if not exists idx_invest_net_worth_snapshots_item_month
  on invest_net_worth_snapshots(item_id, month desc);

alter table invest_net_worth_items enable row level security;
alter table invest_net_worth_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invest_net_worth_items'
      and policyname = 'own net worth items'
  ) then
    create policy "own net worth items"
      on invest_net_worth_items for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invest_net_worth_snapshots'
      and policyname = 'own net worth snapshots'
  ) then
    create policy "own net worth snapshots"
      on invest_net_worth_snapshots for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

comment on table invest_net_worth_items is
  '가족 순자산 계산에 포함할 수동 입력 자산·부채 항목';
comment on table invest_net_worth_snapshots is
  '월말 기준 자산·부채 항목별 잔액. 순자산은 자산 합계에서 부채 합계를 차감한다.';



-- SOURCE: 007_net_worth_item_terms.sql
-- 자산·부채 항목 생성 시 금융 조건을 함께 기록한다.

alter table invest_net_worth_items
  add column if not exists interest_rate numeric,
  add column if not exists start_date date,
  add column if not exists maturity_date date,
  add column if not exists monthly_payment numeric;

alter table invest_net_worth_items
  drop constraint if exists invest_net_worth_items_interest_rate_check,
  add constraint invest_net_worth_items_interest_rate_check
    check (interest_rate is null or interest_rate >= 0),
  drop constraint if exists invest_net_worth_items_monthly_payment_check,
  add constraint invest_net_worth_items_monthly_payment_check
    check (monthly_payment is null or monthly_payment >= 0),
  drop constraint if exists invest_net_worth_items_date_range_check,
  add constraint invest_net_worth_items_date_range_check
    check (start_date is null or maturity_date is null or maturity_date >= start_date);

comment on column invest_net_worth_items.interest_rate is '예적금 또는 대출의 연 이율(%)';
comment on column invest_net_worth_items.monthly_payment is '월 납입액 또는 월 상환액';



-- SOURCE: 008_data_stability.sql
-- 가계 설정을 Supabase로 통합하고 월말 투자계좌 평가액을 보관한다.

alter table invest_net_worth_items
  add column if not exists inactive_from_month text
    check (inactive_from_month is null or inactive_from_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

create table if not exists invest_household_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  monthly_income     numeric not null default 0 check (monthly_income >= 0),
  target_allocation  jsonb not null default '{"kr_stock":30,"us_stock":30,"etf_kr":10,"etf_us":10,"crypto":10,"deposit":10,"other":0}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists invest_household_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null check (char_length(trim(name)) > 0),
  statement    text not null check (char_length(trim(statement)) > 0),
  sub          text not null default '',
  type         text not null check (type in ('cash', 'investment', 'net_worth', 'other')),
  target       numeric not null check (target > 0),
  next_hint    text not null default '',
  sort_order   int not null default 0,
  achieved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_invest_household_goals_user_order
  on invest_household_goals(user_id, sort_order, created_at);

create table if not exists invest_portfolio_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount      numeric not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists idx_invest_portfolio_snapshots_user_month
  on invest_portfolio_snapshots(user_id, month desc);

alter table invest_household_settings enable row level security;
alter table invest_household_goals enable row level security;
alter table invest_portfolio_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'invest_household_settings' and policyname = 'own household settings'
  ) then
    create policy "own household settings" on invest_household_settings for all
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'invest_household_goals' and policyname = 'own household goals'
  ) then
    create policy "own household goals" on invest_household_goals for all
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'invest_portfolio_snapshots' and policyname = 'own portfolio snapshots'
  ) then
    create policy "own portfolio snapshots" on invest_portfolio_snapshots for all
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end
$$;

comment on table invest_household_settings is '가계 공통 설정. 모든 기기에서 동일한 값을 사용한다.';
comment on table invest_household_goals is '대시보드에 표시할 가계 목표 마일스톤';
comment on table invest_portfolio_snapshots is '월말 순자산에 자동 합산한 투자계좌 평가액';



-- SOURCE: 009_account_monthly_snapshots.sql
-- 거래 원장 대신 월 1회 계좌 평가금액을 기록한다.

create table if not exists public.invest_account_monthly_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id          uuid not null references public.accounts(id) on delete cascade,
  month               text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  evaluation_amount   numeric not null default 0 check (evaluation_amount >= 0),
  ytd_contribution    numeric not null default 0 check (ytd_contribution >= 0),
  memo                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, account_id, month)
);

create index if not exists idx_invest_account_monthly_snapshots_user_month
  on public.invest_account_monthly_snapshots(user_id, month desc);

create index if not exists idx_invest_account_monthly_snapshots_account_month
  on public.invest_account_monthly_snapshots(account_id, month desc);

alter table public.invest_account_monthly_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invest_account_monthly_snapshots'
      and policyname = 'own account monthly snapshots'
  ) then
    create policy "own account monthly snapshots"
      on public.invest_account_monthly_snapshots
      for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

grant select, insert, update, delete
  on public.invest_account_monthly_snapshots
  to service_role;

comment on table public.invest_account_monthly_snapshots is
  '계좌별 월말 평가금액과 연금계좌의 연간 누적 납입액';
comment on column public.invest_account_monthly_snapshots.evaluation_amount is
  '선택한 월의 월말 계좌 평가금액';
comment on column public.invest_account_monthly_snapshots.ytd_contribution is
  '해당 연도 1월부터 선택한 월까지의 누적 납입액. 연금저축·IRP 계좌에 사용';


-- SOURCE: 010_balance_sheet_account_flow.sql
-- 금융계좌를 밸런스 시트에서 관리하고 월간 기록과 연결한다.


alter table public.accounts
  add column if not exists is_emergency_fund boolean not null default false;

alter table public.invest_account_monthly_snapshots
  add column if not exists monthly_allocation numeric not null default 0
  check (monthly_allocation >= 0);

alter table public.invest_monthly_budgets
  add column if not exists mortgage_interest numeric not null default 0
  check (mortgage_interest >= 0),
  add column if not exists mortgage_principal numeric not null default 0
  check (mortgage_principal >= 0),
  add column if not exists mortgage_extra_principal numeric not null default 0
  check (mortgage_extra_principal >= 0);

comment on column public.accounts.is_emergency_fund is
  '비상금 목표 금액에 합산할 현금성 계좌인지 여부';
comment on column public.invest_account_monthly_snapshots.monthly_allocation is
  '해당 월 공금 잉여금 및 성과급에서 실제로 이 계좌에 배분한 금액';
comment on column public.invest_monthly_budgets.mortgage_interest is
  '해당 월 고정비에 포함된 주택담보대출 이자';
comment on column public.invest_monthly_budgets.mortgage_principal is
  '해당 월 납부한 주택담보대출 정기 원금';
comment on column public.invest_monthly_budgets.mortgage_extra_principal is
  '해당 월 추가 상환한 주택담보대출 원금';


-- SOURCE: 20260902022903_child_gift_tracking.sql
-- 자녀별 계좌 납입과 직계존속 증여 기록을 관리한다.
-- 자녀 재산은 부모의 밸런스 시트 총자산과 분리한다.

create table if not exists public.invest_children (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (char_length(trim(name)) > 0),
  birth_date    date not null,
  account_name  text,
  memo          text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.invest_child_gift_deposits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id      uuid not null,
  gift_date     date not null,
  amount        numeric(15, 0) not null check (amount > 0),
  donor         text not null default 'parents'
                check (donor in ('parents', 'me', 'spouse', 'grandparents')),
  account_name  text,
  memo          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint invest_child_gift_deposits_child_owner_fkey
    foreign key (child_id, user_id)
    references public.invest_children(id, user_id)
    on delete cascade
);

create index if not exists idx_invest_children_user_active
  on public.invest_children(user_id, is_active, birth_date);

create index if not exists idx_invest_child_gift_deposits_user_date
  on public.invest_child_gift_deposits(user_id, gift_date desc);

create index if not exists idx_invest_child_gift_deposits_child_date
  on public.invest_child_gift_deposits(child_id, user_id, gift_date desc);

alter table public.invest_children enable row level security;
alter table public.invest_child_gift_deposits enable row level security;

revoke all on table public.invest_children from anon, authenticated;
revoke all on table public.invest_child_gift_deposits from anon, authenticated;

grant select, insert, update, delete on public.invest_children to service_role;
grant select, insert, update, delete on public.invest_child_gift_deposits to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invest_children'
      and policyname = 'own invest_children'
  ) then
    create policy "own invest_children"
      on public.invest_children for all
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invest_child_gift_deposits'
      and policyname = 'own child gift deposits'
  ) then
    create policy "own child gift deposits"
      on public.invest_child_gift_deposits for all
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end
$$;

comment on table public.invest_children is
  '가구에서 별도로 관리하는 자녀 프로필과 대표 계좌 정보';
comment on table public.invest_child_gift_deposits is
  '자녀가 직계존속에게 받은 계좌 납입·증여 기록. 세무 신고 원장이 아닌 가정용 관리 기록';


-- SOURCE: 20260902023702_child_gift_tracking_fk_index.sql
drop index if exists public.idx_invest_child_gift_deposits_child_date;

create index idx_invest_child_gift_deposits_child_date
  on public.invest_child_gift_deposits(child_id, user_id, gift_date desc);


-- SOURCE: 20260902033839_classify_child_gift_deposits.sql
-- 자녀 계좌 납입을 증여자 관계와 입금 성격별로 구분한다.
-- 기존 기록은 안전하게 직계존속의 증여로 유지한다.

alter table public.invest_child_gift_deposits
  drop constraint if exists invest_child_gift_deposits_donor_check;

alter table public.invest_child_gift_deposits
  alter column donor set default 'me',
  add column donor_name text,
  add column relationship_category text not null default 'direct_ascendant',
  add column transfer_type text not null default 'gift';

alter table public.invest_child_gift_deposits
  add constraint invest_child_gift_deposits_donor_check
    check (donor in ('parents', 'me', 'spouse', 'grandparents', 'other_relative', 'non_relative')),
  add constraint invest_child_gift_deposits_relationship_category_check
    check (relationship_category in ('direct_ascendant', 'other_relative', 'non_relative')),
  add constraint invest_child_gift_deposits_donor_relationship_check
    check (
      (donor in ('parents', 'me', 'spouse', 'grandparents') and relationship_category = 'direct_ascendant')
      or (donor = 'other_relative' and relationship_category = 'other_relative')
      or (donor = 'non_relative' and relationship_category = 'non_relative')
    ),
  add constraint invest_child_gift_deposits_transfer_type_check
    check (transfer_type in ('gift', 'living_education', 'customary'));

comment on column public.invest_child_gift_deposits.donor_name is
  '고모, 외조부 등 실제 입금자를 구분하기 위한 선택 입력값';
comment on column public.invest_child_gift_deposits.relationship_category is
  '증여재산공제 계산용 관계 구분: 직계존속, 기타 친족, 친족 외';
comment on column public.invest_child_gift_deposits.transfer_type is
  '입금 성격: 증여, 생활비·교육비, 통상적 용돈·축하금';


-- SOURCE: 20260902133902_child_account_monthly_valuation.sql
-- 자녀에게 증여한 돈의 보관·투자 계좌와 월말 평가금액을 관리한다.
-- 자녀 재산은 가구 밸런스 시트와 분리하고, 거래내역 대신 월 1회 평가액만 기록한다.

create table public.invest_child_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id      uuid not null,
  name          text not null check (char_length(trim(name)) between 1 and 100),
  asset_type    text not null check (asset_type in ('cash', 'investment')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  unique (id, user_id, child_id),
  unique (user_id, child_id, name),
  constraint invest_child_accounts_child_owner_fkey
    foreign key (child_id, user_id)
    references public.invest_children(id, user_id)
    on delete cascade
);

create table public.invest_child_account_monthly_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id         uuid not null,
  month              date not null check (extract(day from month) = 1),
  evaluation_amount  numeric(15, 0) not null check (evaluation_amount >= 0),
  memo               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, account_id, month),
  constraint child_account_snapshots_account_owner_fkey
    foreign key (account_id, user_id)
    references public.invest_child_accounts(id, user_id)
    on delete cascade
);

alter table public.invest_child_gift_deposits
  add column child_account_id uuid,
  add constraint invest_child_gift_deposits_account_child_owner_fkey
    foreign key (child_account_id, user_id, child_id)
    references public.invest_child_accounts(id, user_id, child_id)
    on delete set null (child_account_id);

create index idx_invest_child_accounts_child_active
  on public.invest_child_accounts(child_id, user_id, is_active, created_at);

create index idx_invest_child_account_snapshots_account_month
  on public.invest_child_account_monthly_snapshots(account_id, user_id, month desc);

create index idx_invest_child_account_snapshots_user_month
  on public.invest_child_account_monthly_snapshots(user_id, month desc);

create index idx_invest_child_gift_deposits_account_date
  on public.invest_child_gift_deposits(child_account_id, user_id, gift_date desc)
  where child_account_id is not null;

alter table public.invest_child_accounts enable row level security;
alter table public.invest_child_account_monthly_snapshots enable row level security;

revoke all on table public.invest_child_accounts from anon, authenticated;
revoke all on table public.invest_child_account_monthly_snapshots from anon, authenticated;

grant select, insert, update, delete on public.invest_child_accounts to service_role;
grant select, insert, update, delete on public.invest_child_account_monthly_snapshots to service_role;

create policy "own child accounts"
  on public.invest_child_accounts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own child account snapshots"
  on public.invest_child_account_monthly_snapshots for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.invest_child_accounts is
  '자녀에게 증여한 돈을 보관하거나 투자하는 자녀 명의 계좌';
comment on column public.invest_child_accounts.asset_type is
  '현금성 계좌 또는 투자 계좌 구분';
comment on table public.invest_child_account_monthly_snapshots is
  '거래내역 대신 월 1회 기록하는 자녀 계좌 평가금액';
comment on column public.invest_child_gift_deposits.child_account_id is
  '납입된 자녀 계좌. 기존 미연결 기록은 null을 허용';


-- SOURCE: 20260902134838_index_child_gift_account_fk.sql
-- 복합 외래키 전체 열을 선두에 배치해 계좌 삭제·변경 시 참조 검사를 빠르게 한다.

drop index if exists public.idx_invest_child_gift_deposits_account_date;

create index idx_invest_child_gift_deposits_account_date
  on public.invest_child_gift_deposits(child_account_id, user_id, child_id, gift_date desc)
  where child_account_id is not null;


-- SOURCE: 20260908150040_household_data_integrity.sql
-- 원자적 월간 기록·백업 복원과 대시보드 접근 시도 제한.

alter table public.invest_net_worth_snapshots
  add column if not exists source text not null default 'manual';

alter table public.invest_net_worth_snapshots
  drop constraint if exists invest_net_worth_snapshots_source_check,
  add constraint invest_net_worth_snapshots_source_check
    check (source in ('manual', 'mortgage_auto'));

comment on column public.invest_net_worth_snapshots.source is
  'manual: 밸런스 시트 직접 입력, mortgage_auto: 월간 주담대 원금으로 계산';

create table if not exists public.invest_dashboard_access_attempts (
  fingerprint text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  first_attempt_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.invest_dashboard_access_attempts enable row level security;
revoke all on public.invest_dashboard_access_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.invest_dashboard_access_attempts to service_role;

create or replace function public.invest_save_household_monthly_record(
  p_user_id uuid,
  p_month text,
  p_budget jsonb,
  p_accounts jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mortgage_id uuid;
  v_mortgage_count integer;
  v_balance numeric;
  v_event record;
begin
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '올바른 월 형식이 아닙니다.';
  end if;
  if jsonb_typeof(p_budget) <> 'object' then
    raise exception '월간 자금 기록 형식이 올바르지 않습니다.';
  end if;
  if jsonb_typeof(coalesce(p_accounts, '[]'::jsonb)) <> 'array' then
    raise exception '계좌 기록 형식이 올바르지 않습니다.';
  end if;
  if (p_budget->>'joint_savings')::numeric < 0
    or (p_budget->>'bonus_total')::numeric < 0
    or (p_budget->>'bonus_to_plan')::numeric < 0
    or (p_budget->>'cash_balance')::numeric < 0
    or (p_budget->>'mortgage_interest')::numeric < 0
    or (p_budget->>'mortgage_principal')::numeric < 0
    or (p_budget->>'mortgage_extra_principal')::numeric < 0
    or (p_budget->>'bonus_to_plan')::numeric > (p_budget->>'bonus_total')::numeric
  then
    raise exception '월간 자금 기록에 올바르지 않은 금액이 포함되어 있습니다.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_accounts, '[]'::jsonb)) as x(
      evaluation_amount numeric,
      monthly_allocation numeric,
      ytd_contribution numeric
    )
    where x.evaluation_amount < 0 or x.monthly_allocation < 0 or x.ytd_contribution < 0
  ) then
    raise exception '계좌 기록에 음수 금액을 저장할 수 없습니다.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_accounts, '[]'::jsonb)) as x(account_id uuid)
    left join public.accounts a on a.id = x.account_id and a.user_id = p_user_id and a.is_active
    where a.id is null
  ) then
    raise exception '현재 가구에 속하지 않는 계좌가 포함되어 있습니다.';
  end if;

  insert into public.invest_monthly_budgets (
    user_id, month, joint_savings, bonus_total, bonus_to_plan, cash_balance,
    mortgage_interest, mortgage_principal, mortgage_extra_principal, memo, updated_at
  ) values (
    p_user_id,
    p_month,
    (p_budget->>'joint_savings')::integer,
    (p_budget->>'bonus_total')::integer,
    (p_budget->>'bonus_to_plan')::integer,
    (p_budget->>'cash_balance')::integer,
    (p_budget->>'mortgage_interest')::numeric,
    (p_budget->>'mortgage_principal')::numeric,
    (p_budget->>'mortgage_extra_principal')::numeric,
    coalesce(trim(p_budget->>'memo'), ''),
    now()
  )
  on conflict (user_id, month) do update set
    joint_savings = excluded.joint_savings,
    bonus_total = excluded.bonus_total,
    bonus_to_plan = excluded.bonus_to_plan,
    cash_balance = excluded.cash_balance,
    mortgage_interest = excluded.mortgage_interest,
    mortgage_principal = excluded.mortgage_principal,
    mortgage_extra_principal = excluded.mortgage_extra_principal,
    memo = excluded.memo,
    updated_at = now();

  insert into public.invest_account_monthly_snapshots (
    user_id, account_id, month, evaluation_amount, monthly_allocation,
    ytd_contribution, memo, updated_at
  )
  select
    p_user_id, x.account_id, p_month, x.evaluation_amount,
    x.monthly_allocation, x.ytd_contribution, x.memo, now()
  from jsonb_to_recordset(coalesce(p_accounts, '[]'::jsonb)) as x(
    account_id uuid,
    evaluation_amount numeric,
    monthly_allocation numeric,
    ytd_contribution numeric,
    memo text
  )
  on conflict (user_id, account_id, month) do update set
    evaluation_amount = excluded.evaluation_amount,
    monthly_allocation = excluded.monthly_allocation,
    ytd_contribution = excluded.ytd_contribution,
    memo = excluded.memo,
    updated_at = now();

  -- 자동 잔액은 항상 수동 기준점과 월별 상환 기록에서 다시 계산한다.
  delete from public.invest_net_worth_snapshots s
  using public.invest_net_worth_items i
  where s.item_id = i.id
    and s.user_id = p_user_id
    and i.user_id = p_user_id
    and i.category = 'mortgage'
    and s.source = 'mortgage_auto';

  select count(*)
  into v_mortgage_count
  from public.invest_net_worth_items
  where user_id = p_user_id and category = 'mortgage' and is_active;

  if v_mortgage_count = 1 then
    select id
    into v_mortgage_id
    from public.invest_net_worth_items
    where user_id = p_user_id and category = 'mortgage' and is_active
    limit 1;

    v_balance := null;
    for v_event in
      with months as (
        select s.month
        from public.invest_net_worth_snapshots s
        where s.user_id = p_user_id and s.item_id = v_mortgage_id and s.source = 'manual'
        union
        select b.month
        from public.invest_monthly_budgets b
        where b.user_id = p_user_id
      )
      select
        m.month,
        (
          select s.amount
          from public.invest_net_worth_snapshots s
          where s.user_id = p_user_id and s.item_id = v_mortgage_id
            and s.month = m.month and s.source = 'manual'
          limit 1
        ) as manual_amount,
        (
          select b.mortgage_principal + b.mortgage_extra_principal
          from public.invest_monthly_budgets b
          where b.user_id = p_user_id and b.month = m.month
        ) as principal
      from months m
      order by m.month
    loop
      if v_event.manual_amount is not null then
        v_balance := v_event.manual_amount;
      elsif v_balance is not null and v_event.principal is not null then
        v_balance := greatest(v_balance - v_event.principal, 0);
        insert into public.invest_net_worth_snapshots (
          user_id, item_id, month, amount, source, updated_at
        ) values (
          p_user_id, v_mortgage_id, v_event.month, v_balance, 'mortgage_auto', now()
        )
        on conflict (user_id, item_id, month) do update set
          amount = excluded.amount,
          source = 'mortgage_auto',
          updated_at = now()
        where public.invest_net_worth_snapshots.source = 'mortgage_auto';
      end if;
    end loop;
  end if;
end;
$$;

revoke all on function public.invest_save_household_monthly_record(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.invest_save_household_monthly_record(uuid, text, jsonb, jsonb) to service_role;

create or replace function public.invest_restore_household_backup(
  p_user_id uuid,
  p_operations jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_operation jsonb;
  v_table text;
  v_conflict text;
  v_rows jsonb;
  v_updates text;
  v_count integer;
  v_total integer := 0;
  v_foreign_owner boolean;
begin
  if p_user_id is null then
    raise exception '백업 소유자가 지정되지 않았습니다.';
  end if;
  if jsonb_typeof(p_operations) is distinct from 'array' then
    raise exception '백업 작업 형식이 올바르지 않습니다.';
  end if;

  for v_operation in select value from jsonb_array_elements(p_operations)
  loop
    v_table := case v_operation->>'table'
      when 'monthly_budgets' then 'invest_monthly_budgets'
      when 'financial_plan_settings' then 'invest_financial_plan_settings'
      when 'net_worth_items' then 'invest_net_worth_items'
      when 'net_worth_snapshots' then 'invest_net_worth_snapshots'
      when 'household_settings' then 'invest_household_settings'
      when 'household_goals' then 'invest_household_goals'
      when 'portfolio_snapshots' then 'invest_portfolio_snapshots'
      when 'account_monthly_snapshots' then 'invest_account_monthly_snapshots'
      when 'children' then 'invest_children'
      when 'child_gift_deposits' then 'invest_child_gift_deposits'
      when 'child_accounts' then 'invest_child_accounts'
      when 'child_account_monthly_snapshots' then 'invest_child_account_monthly_snapshots'
      when 'dashboard_access_attempts' then 'invest_dashboard_access_attempts'
      else v_operation->>'table'
    end;
    v_conflict := case v_table
      when 'accounts' then 'id'
      when 'assets' then 'id'
      when 'transactions' then 'id'
      when 'balances' then 'id'
      when 'invest_monthly_budgets' then 'user_id, month'
      when 'invest_account_monthly_snapshots' then 'user_id, account_id, month'
      when 'invest_financial_plan_settings' then 'user_id'
      when 'invest_net_worth_items' then 'id'
      when 'invest_net_worth_snapshots' then 'user_id, item_id, month'
      when 'invest_portfolio_snapshots' then 'user_id, month'
      when 'invest_household_settings' then 'user_id'
      when 'invest_household_goals' then 'id'
      when 'invest_children' then 'id'
      when 'invest_child_accounts' then 'id'
      when 'invest_child_gift_deposits' then 'id'
      when 'invest_child_account_monthly_snapshots' then 'user_id, account_id, month'
      else null
    end;
    if v_conflict is null then
      raise exception '지원하지 않는 백업 테이블입니다: %', v_table;
    end if;
    if jsonb_typeof(v_operation->'rows') is distinct from 'array' then
      raise exception '백업 행 형식이 올바르지 않습니다: %', v_table;
    end if;

    select coalesce(jsonb_agg(jsonb_set(value, '{user_id}', to_jsonb(p_user_id), true)), '[]'::jsonb)
    into v_rows
    from jsonb_array_elements(v_operation->'rows');

    -- Older exports may encode an empty budget memo as null. Preserve its meaning
    -- without changing null/default behavior for any other column or table.
    if v_table = 'invest_monthly_budgets' then
      select coalesce(jsonb_agg(
        case when value->>'memo' is null
          then jsonb_set(value, '{memo}', '""'::jsonb, true)
          else value
        end
      ), '[]'::jsonb)
      into v_rows
      from jsonb_array_elements(v_rows);
    end if;

    if v_table not in ('invest_financial_plan_settings', 'invest_household_settings') then
      execute format(
        'select exists (
          select 1 from public.%1$I target
          join jsonb_populate_recordset(null::public.%1$I, $1) incoming on incoming.id = target.id
          where target.user_id <> $2
        )',
        v_table
      ) into v_foreign_owner using v_rows, p_user_id;
      if v_foreign_owner then
        raise exception '다른 가구에 속한 식별자가 포함되어 있습니다: %', v_table;
      end if;
    end if;

    -- service_role bypasses RLS; validate the owner of the single-column foreign
    -- keys here. Child relations already enforce ownership with composite FKs.
    if v_table in ('transactions', 'balances', 'invest_account_monthly_snapshots') then
      if exists (
        select 1
        from jsonb_to_recordset(v_rows) as incoming(account_id uuid)
        left join public.accounts parent
          on parent.id = incoming.account_id and parent.user_id = p_user_id
        where parent.id is null
      ) then
        raise exception '현재 가구에 속하지 않는 계좌 참조가 포함되어 있습니다: %', v_table;
      end if;
    end if;

    if v_table = 'transactions' then
      if exists (
        select 1
        from jsonb_to_recordset(v_rows) as incoming(asset_id uuid)
        left join public.assets parent
          on parent.id = incoming.asset_id and parent.user_id = p_user_id
        where incoming.asset_id is not null and parent.id is null
      ) then
        raise exception '현재 가구에 속하지 않는 종목 참조가 포함되어 있습니다.';
      end if;
    end if;

    if v_table = 'invest_net_worth_snapshots' then
      if exists (
        select 1
        from jsonb_to_recordset(v_rows) as incoming(item_id uuid)
        left join public.invest_net_worth_items parent
          on parent.id = incoming.item_id and parent.user_id = p_user_id
        where parent.id is null
      ) then
        raise exception '현재 가구에 속하지 않는 자산·부채 항목 참조가 포함되어 있습니다.';
      end if;
    end if;

    select string_agg(format('%1$I = excluded.%1$I', column_name), ', ' order by ordinal_position)
    into v_updates
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_table
      and not (column_name = any(string_to_array(replace(v_conflict, ' ', ''), ',')));

    execute format(
      'insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1)
       on conflict (%2$s) do update set %3$s',
      v_table,
      v_conflict,
      v_updates
    ) using v_rows;
    get diagnostics v_count = row_count;
    v_total := v_total + v_count;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.invest_restore_household_backup(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.invest_restore_household_backup(uuid, jsonb) to service_role;

create or replace function public.invest_dashboard_access_retry_after(p_fingerprint text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seconds integer;
begin
  delete from public.invest_dashboard_access_attempts
  where updated_at < now() - interval '2 days';

  select greatest(ceil(extract(epoch from blocked_until - now()))::integer, 0)
  into v_seconds
  from public.invest_dashboard_access_attempts
  where fingerprint = p_fingerprint and blocked_until > now();
  return coalesce(v_seconds, 0);
end;
$$;

create or replace function public.invest_record_dashboard_access_failure(p_fingerprint text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempts integer;
  v_first timestamptz;
  v_blocked timestamptz;
begin
  insert into public.invest_dashboard_access_attempts (fingerprint)
  values (p_fingerprint)
  on conflict (fingerprint) do nothing;

  select attempts, first_attempt_at
  into v_attempts, v_first
  from public.invest_dashboard_access_attempts
  where fingerprint = p_fingerprint
  for update;

  if v_first < now() - interval '15 minutes' then
    v_attempts := 1;
    v_first := now();
  else
    v_attempts := v_attempts + 1;
  end if;
  v_blocked := case when v_attempts >= 5 then now() + interval '15 minutes' else null end;

  update public.invest_dashboard_access_attempts
  set attempts = v_attempts,
      first_attempt_at = v_first,
      blocked_until = v_blocked,
      updated_at = now()
  where fingerprint = p_fingerprint;

  return coalesce(greatest(ceil(extract(epoch from v_blocked - now()))::integer, 0), 0);
end;
$$;

create or replace function public.invest_clear_dashboard_access_failures(p_fingerprint text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.invest_dashboard_access_attempts where fingerprint = p_fingerprint;
$$;

revoke all on function public.invest_dashboard_access_retry_after(text) from public, anon, authenticated;
revoke all on function public.invest_record_dashboard_access_failure(text) from public, anon, authenticated;
revoke all on function public.invest_clear_dashboard_access_failures(text) from public, anon, authenticated;
grant execute on function public.invest_dashboard_access_retry_after(text) to service_role;
grant execute on function public.invest_record_dashboard_access_failure(text) to service_role;
grant execute on function public.invest_clear_dashboard_access_failures(text) to service_role;

-- Password-gated application: all new tables are available only to its server.
do $grants$
declare v_name text;
begin
  foreach v_name in array array['invest_monthly_budgets', 'invest_financial_plan_settings', 'invest_net_worth_items', 'invest_net_worth_snapshots', 'invest_household_settings', 'invest_household_goals', 'invest_portfolio_snapshots', 'invest_account_monthly_snapshots', 'invest_children', 'invest_child_gift_deposits', 'invest_child_accounts', 'invest_child_account_monthly_snapshots', 'invest_dashboard_access_attempts'] loop
    execute format('alter table public.%I enable row level security', v_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', v_name);
  end loop;
end
$grants$;
notify pgrst, 'reload schema';
