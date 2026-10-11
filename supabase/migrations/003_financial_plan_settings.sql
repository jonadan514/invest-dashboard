-- 재무계획 기준값과 3단계 배분 비율을 Supabase에서 단일 관리한다.

create table if not exists financial_plan_settings (
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

alter table financial_plan_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_plan_settings'
      and policyname = 'own financial plan settings'
  ) then
    create policy "own financial plan settings"
      on financial_plan_settings
      for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;
