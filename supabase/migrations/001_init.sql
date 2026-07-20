-- ============================================================
-- 투자 관리 대시보드 — 초기 스키마 (설계 v1.2)
-- Supabase SQL Editor에 붙여넣고 실행하세요.
-- ============================================================

-- ── enum 타입 ──
create type owner_type        as enum ('me', 'spouse');                -- 나 / 아내
create type account_type      as enum ('general', 'pension', 'irp', 'isa', 'crypto', 'savings');
create type asset_class_type  as enum ('kr_stock', 'us_stock', 'etf_kr', 'etf_us', 'crypto', 'deposit', 'other');
create type price_source_type as enum ('kis', 'finnhub', 'upbit', 'manual');
create type tx_type           as enum ('buy', 'sell', 'dividend', 'deposit', 'withdraw', 'interest', 'fee');

-- ── 1.1 accounts — 계좌 ──
create table accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id),
  name          text not null,
  broker        text,
  owner         owner_type not null default 'me',
  type          account_type not null,
  base_currency text not null default 'KRW',
  tax_benefit   boolean not null default false,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── 1.2 assets — 종목 마스터 ──
create table assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id),
  symbol       text,
  name         text not null,
  asset_class  asset_class_type not null,
  currency     text not null default 'KRW',
  market       text,
  price_source price_source_type not null default 'manual',
  is_active    boolean not null default true
);

-- ── 1.3 transactions — 거래 (유일한 입력) ──
create table transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  date       date not null,
  account_id uuid not null references accounts(id) on delete cascade,
  asset_id   uuid references assets(id),            -- 현금 입출금은 null
  type       tx_type not null,
  quantity   numeric,
  price      numeric,
  amount     numeric,                               -- 총액(검증/현금흐름용)
  fee        numeric not null default 0,
  tax        numeric not null default 0,
  fx_rate    numeric not null default 1,            -- 거래시점 환율 (원화=1)
  currency   text not null default 'KRW',
  memo       text,                                  -- 매매일지
  created_at timestamptz not null default now()
);

-- ── 1.4 prices — 시세 캐시 ──
create table prices (
  asset_id   uuid primary key references assets(id) on delete cascade,
  price      numeric not null,
  prev_close numeric,
  currency   text not null default 'KRW',
  as_of      timestamptz not null default now()
);

-- ── 1.5 fx_rates — 환율 캐시 ──
create table fx_rates (
  pair       text primary key,                      -- 'USDKRW'
  rate       numeric not null,
  prev_close numeric,
  as_of      timestamptz not null default now()
);

-- ── 1.6 balances — 수동 평가액 스냅샷 (예적금 전용, 월 1회) ──
create table balances (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  account_id uuid not null references accounts(id) on delete cascade,
  value      numeric not null,                      -- 평가액 (KRW)
  as_of      date not null,
  memo       text
);

-- ── 인덱스 ──
create index idx_tx_account on transactions(account_id);
create index idx_tx_asset   on transactions(asset_id);
create index idx_tx_date    on transactions(date);
create index idx_bal_account on balances(account_id, as_of desc);

-- ── RLS (Row Level Security) ──
alter table accounts     enable row level security;
alter table assets       enable row level security;
alter table transactions enable row level security;
alter table prices       enable row level security;
alter table fx_rates     enable row level security;
alter table balances     enable row level security;

-- 본인 데이터만 (공용 1계정이므로 사실상 로그인 보호 역할)
create policy "own accounts"     on accounts     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own assets"       on assets       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own transactions" on transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own balances"     on balances     for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 시세/환율 캐시: 로그인한 사용자는 읽기/쓰기 가능
create policy "auth prices"   on prices   for all to authenticated using (true) with check (true);
create policy "auth fx_rates" on fx_rates for all to authenticated using (true) with check (true);
