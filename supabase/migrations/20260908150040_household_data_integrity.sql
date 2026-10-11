-- 원자적 월간 기록·백업 복원과 대시보드 접근 시도 제한.

alter table public.net_worth_snapshots
  add column if not exists source text not null default 'manual';

alter table public.net_worth_snapshots
  drop constraint if exists net_worth_snapshots_source_check,
  add constraint net_worth_snapshots_source_check
    check (source in ('manual', 'mortgage_auto'));

comment on column public.net_worth_snapshots.source is
  'manual: 밸런스 시트 직접 입력, mortgage_auto: 월간 주담대 원금으로 계산';

create table if not exists public.dashboard_access_attempts (
  fingerprint text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  first_attempt_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_access_attempts enable row level security;
revoke all on public.dashboard_access_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.dashboard_access_attempts to service_role;

create or replace function public.save_household_monthly_record(
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

  insert into public.monthly_budgets (
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
    nullif(trim(p_budget->>'memo'), ''),
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

  insert into public.account_monthly_snapshots (
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
  delete from public.net_worth_snapshots s
  using public.net_worth_items i
  where s.item_id = i.id
    and s.user_id = p_user_id
    and i.user_id = p_user_id
    and i.category = 'mortgage'
    and s.source = 'mortgage_auto';

  select count(*)
  into v_mortgage_count
  from public.net_worth_items
  where user_id = p_user_id and category = 'mortgage' and is_active;

  if v_mortgage_count = 1 then
    select id
    into v_mortgage_id
    from public.net_worth_items
    where user_id = p_user_id and category = 'mortgage' and is_active
    limit 1;

    v_balance := null;
    for v_event in
      with months as (
        select s.month
        from public.net_worth_snapshots s
        where s.user_id = p_user_id and s.item_id = v_mortgage_id and s.source = 'manual'
        union
        select b.month
        from public.monthly_budgets b
        where b.user_id = p_user_id
      )
      select
        m.month,
        (
          select s.amount
          from public.net_worth_snapshots s
          where s.user_id = p_user_id and s.item_id = v_mortgage_id
            and s.month = m.month and s.source = 'manual'
          limit 1
        ) as manual_amount,
        (
          select b.mortgage_principal + b.mortgage_extra_principal
          from public.monthly_budgets b
          where b.user_id = p_user_id and b.month = m.month
        ) as principal
      from months m
      order by m.month
    loop
      if v_event.manual_amount is not null then
        v_balance := v_event.manual_amount;
      elsif v_balance is not null and v_event.principal is not null then
        v_balance := greatest(v_balance - v_event.principal, 0);
        insert into public.net_worth_snapshots (
          user_id, item_id, month, amount, source, updated_at
        ) values (
          p_user_id, v_mortgage_id, v_event.month, v_balance, 'mortgage_auto', now()
        )
        on conflict (user_id, item_id, month) do update set
          amount = excluded.amount,
          source = 'mortgage_auto',
          updated_at = now()
        where public.net_worth_snapshots.source = 'mortgage_auto';
      end if;
    end loop;
  end if;
end;
$$;

revoke all on function public.save_household_monthly_record(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_household_monthly_record(uuid, text, jsonb, jsonb) to service_role;

create or replace function public.restore_household_backup(
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
  if jsonb_typeof(p_operations) <> 'array' then
    raise exception '백업 작업 형식이 올바르지 않습니다.';
  end if;

  for v_operation in select value from jsonb_array_elements(p_operations)
  loop
    v_table := v_operation->>'table';
    v_conflict := case v_table
      when 'accounts' then 'id'
      when 'assets' then 'id'
      when 'transactions' then 'id'
      when 'balances' then 'id'
      when 'monthly_budgets' then 'user_id, month'
      when 'account_monthly_snapshots' then 'user_id, account_id, month'
      when 'financial_plan_settings' then 'user_id'
      when 'net_worth_items' then 'id'
      when 'net_worth_snapshots' then 'user_id, item_id, month'
      when 'portfolio_snapshots' then 'user_id, month'
      when 'household_settings' then 'user_id'
      when 'household_goals' then 'id'
      when 'children' then 'id'
      when 'child_accounts' then 'id'
      when 'child_gift_deposits' then 'id'
      when 'child_account_monthly_snapshots' then 'user_id, account_id, month'
      else null
    end;
    if v_conflict is null then
      raise exception '지원하지 않는 백업 테이블입니다: %', v_table;
    end if;
    if jsonb_typeof(v_operation->'rows') <> 'array' then
      raise exception '백업 행 형식이 올바르지 않습니다: %', v_table;
    end if;

    select coalesce(jsonb_agg(jsonb_set(value, '{user_id}', to_jsonb(p_user_id), true)), '[]'::jsonb)
    into v_rows
    from jsonb_array_elements(v_operation->'rows');

    if v_table not in ('financial_plan_settings', 'household_settings') then
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

revoke all on function public.restore_household_backup(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.restore_household_backup(uuid, jsonb) to service_role;

create or replace function public.dashboard_access_retry_after(p_fingerprint text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seconds integer;
begin
  delete from public.dashboard_access_attempts
  where updated_at < now() - interval '2 days';

  select greatest(ceil(extract(epoch from blocked_until - now()))::integer, 0)
  into v_seconds
  from public.dashboard_access_attempts
  where fingerprint = p_fingerprint and blocked_until > now();
  return coalesce(v_seconds, 0);
end;
$$;

create or replace function public.record_dashboard_access_failure(p_fingerprint text)
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
  insert into public.dashboard_access_attempts (fingerprint)
  values (p_fingerprint)
  on conflict (fingerprint) do nothing;

  select attempts, first_attempt_at
  into v_attempts, v_first
  from public.dashboard_access_attempts
  where fingerprint = p_fingerprint
  for update;

  if v_first < now() - interval '15 minutes' then
    v_attempts := 1;
    v_first := now();
  else
    v_attempts := v_attempts + 1;
  end if;
  v_blocked := case when v_attempts >= 5 then now() + interval '15 minutes' else null end;

  update public.dashboard_access_attempts
  set attempts = v_attempts,
      first_attempt_at = v_first,
      blocked_until = v_blocked,
      updated_at = now()
  where fingerprint = p_fingerprint;

  return coalesce(greatest(ceil(extract(epoch from v_blocked - now()))::integer, 0), 0);
end;
$$;

create or replace function public.clear_dashboard_access_failures(p_fingerprint text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.dashboard_access_attempts where fingerprint = p_fingerprint;
$$;

revoke all on function public.dashboard_access_retry_after(text) from public, anon, authenticated;
revoke all on function public.record_dashboard_access_failure(text) from public, anon, authenticated;
revoke all on function public.clear_dashboard_access_failures(text) from public, anon, authenticated;
grant execute on function public.dashboard_access_retry_after(text) to service_role;
grant execute on function public.record_dashboard_access_failure(text) to service_role;
grant execute on function public.clear_dashboard_access_failures(text) to service_role;
