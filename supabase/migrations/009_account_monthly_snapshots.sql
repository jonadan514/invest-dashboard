-- 거래 원장 대신 월 1회 계좌 평가금액을 기록한다.

create table if not exists public.account_monthly_snapshots (
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

create index if not exists idx_account_monthly_snapshots_user_month
  on public.account_monthly_snapshots(user_id, month desc);

create index if not exists idx_account_monthly_snapshots_account_month
  on public.account_monthly_snapshots(account_id, month desc);

alter table public.account_monthly_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'account_monthly_snapshots'
      and policyname = 'own account monthly snapshots'
  ) then
    create policy "own account monthly snapshots"
      on public.account_monthly_snapshots
      for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

grant select, insert, update, delete
  on public.account_monthly_snapshots
  to service_role;

comment on table public.account_monthly_snapshots is
  '계좌별 월말 평가금액과 연금계좌의 연간 누적 납입액';
comment on column public.account_monthly_snapshots.evaluation_amount is
  '선택한 월의 월말 계좌 평가금액';
comment on column public.account_monthly_snapshots.ytd_contribution is
  '해당 연도 1월부터 선택한 월까지의 누적 납입액. 연금저축·IRP 계좌에 사용';
