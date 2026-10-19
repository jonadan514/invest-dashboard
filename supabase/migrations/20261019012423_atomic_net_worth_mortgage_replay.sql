-- This migration is for the dedicated investment database only.
do $$
begin
  if to_regclass('public.invest_net_worth_items') is not null then
    raise exception 'Apply this migration only to the dedicated investment database.';
  end if;
end;
$$;

-- Recompute only derived rows on save. Migration itself never rewrites balances.
create or replace function public.recompute_mortgage_snapshots(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_mortgage_id uuid;
  v_mortgage_count integer;
  v_balance numeric;
  v_event record;
begin
  if p_user_id is null or (auth.uid() is not null and auth.uid() <> p_user_id) then
    raise exception '현재 가구의 기록만 저장할 수 있습니다.';
  end if;
  -- Serialize manual anchors and monthly principal edits for this household.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 41827));

  -- Keep manual anchors and existing row identities. Multiple active mortgages
  -- cannot be allocated a household principal amount without an explicit mapping.
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
$function$;

revoke all on function public.recompute_mortgage_snapshots(uuid) from public, anon, authenticated;
grant execute on function public.recompute_mortgage_snapshots(uuid) to service_role;

create or replace function public.save_net_worth_snapshot(
  p_user_id uuid,
  p_month text,
  p_balances jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_user_id is null or (auth.uid() is not null and auth.uid() <> p_user_id) then
    raise exception '현재 가구의 기록만 저장할 수 있습니다.';
  end if;
  -- Serialize manual anchors and monthly principal edits for this household.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 41827));

  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '올바른 월 형식이 아닙니다.';
  end if;
  if jsonb_typeof(p_balances) is distinct from 'array' then
    raise exception '자산·부채 잔액 형식이 올바르지 않습니다.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_balances) as entry(value)
    where jsonb_typeof(value) is distinct from 'object'
      or jsonb_typeof(value->'amount') is distinct from 'number'
      or jsonb_typeof(value->'item_id') is distinct from 'string'
  ) then
    raise exception '항목과 금액을 모두 입력해 주세요.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_balances) as x(item_id uuid, amount numeric)
    where x.item_id is null or x.amount is null or x.amount < 0
      or x.amount::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception '잔액은 0 이상의 유한한 숫자여야 합니다.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_balances) as x(item_id uuid)
    group by x.item_id having count(*) > 1
  ) then
    raise exception '동일한 항목의 잔액이 중복되어 있습니다.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_balances) as x(item_id uuid)
    left join public.net_worth_items i on i.id = x.item_id
      and i.user_id = p_user_id and i.is_active
    where i.id is null
  ) then
    raise exception '현재 가구의 활성 자산·부채 항목만 저장할 수 있습니다.';
  end if;

  insert into public.net_worth_snapshots (
    user_id, item_id, month, amount, source, updated_at
  )
  select p_user_id, x.item_id, p_month, x.amount, 'manual', now()
  from jsonb_to_recordset(p_balances) as x(item_id uuid, amount numeric)
  on conflict (user_id, item_id, month) do update set
    amount = excluded.amount,
    source = 'manual',
    updated_at = now();

  perform public.recompute_mortgage_snapshots(p_user_id);
end;
$function$;

revoke all on function public.save_net_worth_snapshot(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_net_worth_snapshot(uuid, text, jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.save_household_monthly_record(p_user_id uuid, p_month text, p_budget jsonb, p_accounts jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if p_user_id is null or (auth.uid() is not null and auth.uid() <> p_user_id) then
    raise exception '현재 가구의 기록만 저장할 수 있습니다.';
  end if;
  -- Serialize manual anchors and monthly principal edits for this household.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 41827));
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
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

  perform public.recompute_mortgage_snapshots(p_user_id);
end;
$function$;

revoke all on function public.save_household_monthly_record(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_household_monthly_record(uuid, text, jsonb, jsonb) to service_role;
