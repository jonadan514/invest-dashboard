-- 가계 설정을 Supabase로 통합하고 월말 투자계좌 평가액을 보관한다.

alter table net_worth_items
  add column if not exists inactive_from_month text
    check (inactive_from_month is null or inactive_from_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

create table if not exists household_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  monthly_income     numeric not null default 0 check (monthly_income >= 0),
  target_allocation  jsonb not null default '{"kr_stock":30,"us_stock":30,"etf_kr":10,"etf_us":10,"crypto":10,"deposit":10,"other":0}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists household_goals (
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

create index if not exists idx_household_goals_user_order
  on household_goals(user_id, sort_order, created_at);

create table if not exists portfolio_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount      numeric not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists idx_portfolio_snapshots_user_month
  on portfolio_snapshots(user_id, month desc);

alter table household_settings enable row level security;
alter table household_goals enable row level security;
alter table portfolio_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'household_settings' and policyname = 'own household settings'
  ) then
    create policy "own household settings" on household_settings for all
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'household_goals' and policyname = 'own household goals'
  ) then
    create policy "own household goals" on household_goals for all
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'portfolio_snapshots' and policyname = 'own portfolio snapshots'
  ) then
    create policy "own portfolio snapshots" on portfolio_snapshots for all
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end
$$;

comment on table household_settings is '가계 공통 설정. 모든 기기에서 동일한 값을 사용한다.';
comment on table household_goals is '대시보드에 표시할 가계 목표 마일스톤';
comment on table portfolio_snapshots is '월말 순자산에 자동 합산한 투자계좌 평가액';

