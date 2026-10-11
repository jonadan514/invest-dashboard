-- 가족 자산·부채 항목과 월말 잔액을 별도로 관리한다.
-- 투자 거래 원장(accounts/transactions)과 분리하여 부동산, 보증금, 차량 등도
-- 동일한 기준으로 월 1회 직접 기록할 수 있게 한다.

create table if not exists net_worth_items (
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

create table if not exists net_worth_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id     uuid not null references net_worth_items(id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount      numeric not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, item_id, month)
);

create index if not exists idx_net_worth_items_user
  on net_worth_items(user_id, kind, sort_order, created_at);

create index if not exists idx_net_worth_snapshots_user_month
  on net_worth_snapshots(user_id, month desc);

create index if not exists idx_net_worth_snapshots_item_month
  on net_worth_snapshots(item_id, month desc);

alter table net_worth_items enable row level security;
alter table net_worth_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'net_worth_items'
      and policyname = 'own net worth items'
  ) then
    create policy "own net worth items"
      on net_worth_items for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'net_worth_snapshots'
      and policyname = 'own net worth snapshots'
  ) then
    create policy "own net worth snapshots"
      on net_worth_snapshots for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

comment on table net_worth_items is
  '가족 순자산 계산에 포함할 수동 입력 자산·부채 항목';
comment on table net_worth_snapshots is
  '월말 기준 자산·부채 항목별 잔액. 순자산은 자산 합계에서 부채 합계를 차감한다.';

