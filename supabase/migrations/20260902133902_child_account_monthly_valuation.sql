-- 자녀에게 증여한 돈의 보관·투자 계좌와 월말 평가금액을 관리한다.
-- 자녀 재산은 가구 밸런스 시트와 분리하고, 거래내역 대신 월 1회 평가액만 기록한다.

create table public.child_accounts (
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
  constraint child_accounts_child_owner_fkey
    foreign key (child_id, user_id)
    references public.children(id, user_id)
    on delete cascade
);

create table public.child_account_monthly_snapshots (
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
    references public.child_accounts(id, user_id)
    on delete cascade
);

alter table public.child_gift_deposits
  add column child_account_id uuid,
  add constraint child_gift_deposits_account_child_owner_fkey
    foreign key (child_account_id, user_id, child_id)
    references public.child_accounts(id, user_id, child_id)
    on delete set null (child_account_id);

create index idx_child_accounts_child_active
  on public.child_accounts(child_id, user_id, is_active, created_at);

create index idx_child_account_snapshots_account_month
  on public.child_account_monthly_snapshots(account_id, user_id, month desc);

create index idx_child_account_snapshots_user_month
  on public.child_account_monthly_snapshots(user_id, month desc);

create index idx_child_gift_deposits_account_date
  on public.child_gift_deposits(child_account_id, user_id, gift_date desc)
  where child_account_id is not null;

alter table public.child_accounts enable row level security;
alter table public.child_account_monthly_snapshots enable row level security;

revoke all on table public.child_accounts from anon, authenticated;
revoke all on table public.child_account_monthly_snapshots from anon, authenticated;

grant select, insert, update, delete on public.child_accounts to service_role;
grant select, insert, update, delete on public.child_account_monthly_snapshots to service_role;

create policy "own child accounts"
  on public.child_accounts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own child account snapshots"
  on public.child_account_monthly_snapshots for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.child_accounts is
  '자녀에게 증여한 돈을 보관하거나 투자하는 자녀 명의 계좌';
comment on column public.child_accounts.asset_type is
  '현금성 계좌 또는 투자 계좌 구분';
comment on table public.child_account_monthly_snapshots is
  '거래내역 대신 월 1회 기록하는 자녀 계좌 평가금액';
comment on column public.child_gift_deposits.child_account_id is
  '납입된 자녀 계좌. 기존 미연결 기록은 null을 허용';
