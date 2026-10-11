-- 자녀별 계좌 납입과 직계존속 증여 기록을 관리한다.
-- 자녀 재산은 부모의 밸런스 시트 총자산과 분리한다.

create table if not exists public.children (
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

create table if not exists public.child_gift_deposits (
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
  constraint child_gift_deposits_child_owner_fkey
    foreign key (child_id, user_id)
    references public.children(id, user_id)
    on delete cascade
);

create index if not exists idx_children_user_active
  on public.children(user_id, is_active, birth_date);

create index if not exists idx_child_gift_deposits_user_date
  on public.child_gift_deposits(user_id, gift_date desc);

create index if not exists idx_child_gift_deposits_child_date
  on public.child_gift_deposits(child_id, user_id, gift_date desc);

alter table public.children enable row level security;
alter table public.child_gift_deposits enable row level security;

revoke all on table public.children from anon, authenticated;
revoke all on table public.child_gift_deposits from anon, authenticated;

grant select, insert, update, delete on public.children to service_role;
grant select, insert, update, delete on public.child_gift_deposits to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'children'
      and policyname = 'own children'
  ) then
    create policy "own children"
      on public.children for all
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'child_gift_deposits'
      and policyname = 'own child gift deposits'
  ) then
    create policy "own child gift deposits"
      on public.child_gift_deposits for all
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end
$$;

comment on table public.children is
  '가구에서 별도로 관리하는 자녀 프로필과 대표 계좌 정보';
comment on table public.child_gift_deposits is
  '자녀가 직계존속에게 받은 계좌 납입·증여 기록. 세무 신고 원장이 아닌 가정용 관리 기록';
