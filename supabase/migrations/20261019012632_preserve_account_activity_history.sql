-- Dedicated investment project only. Never modify the original shared project.
do $$
begin
  if to_regclass('public.invest_net_worth_items') is not null then
    raise exception 'This migration must only run on the dedicated investment database.';
  end if;
end;
$$;

alter table public.accounts
  add column if not exists inactive_from_month text,
  add column if not exists activity_history jsonb not null default '[]'::jsonb;

create or replace function public.valid_account_activity_history(p_history jsonb)
returns boolean
language plpgsql immutable strict
set search_path = ''
as $$
declare
  v_event jsonb;
begin
  if jsonb_typeof(p_history) <> 'array' then return false; end if;
  for v_event in select value from jsonb_array_elements(p_history) loop
    if jsonb_typeof(v_event) <> 'object'
      or jsonb_typeof(v_event -> 'month') is distinct from 'string'
      or (v_event ->> 'month') !~ '^\d{4}-(0[1-9]|1[0-2])$'
      or jsonb_typeof(v_event -> 'active') is distinct from 'boolean'
    then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.accounts
  add constraint accounts_inactive_from_month_format
    check (inactive_from_month is null or inactive_from_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  add constraint accounts_activity_history_format
    check (public.valid_account_activity_history(activity_history));

-- Legacy rows have no reliable closure date. Preserve their earlier snapshots
-- and keep them inactive from the migration's Seoul month. Original fields stay intact.
update public.accounts
set inactive_from_month = coalesce(inactive_from_month, to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')),
    activity_history = jsonb_build_array(jsonb_build_object(
      'month', coalesce(inactive_from_month, to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')),
      'active', false
    ))
where not is_active and activity_history = '[]'::jsonb;

comment on column public.accounts.activity_history is
  'Monthly active-state changes; initially active, last event in a month wins. Retain events across reactivation.';
comment on column public.accounts.inactive_from_month is
  'Convenience closure month for the current inactive interval; activity_history is authoritative.';

create or replace function public.toggle_account_activity(
  p_user_id uuid,
  p_account_id uuid,
  p_month text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.accounts%rowtype;
  v_history jsonb;
  v_active boolean;
  v_current_active boolean;
  v_inactive_from text;
  v_current_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
begin
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '올바른 월 형식이 아닙니다.';
  end if;
  -- Future snapshots remain valid planning inputs; activity is an actual state
  -- change and must not leave legacy is_active consumers stale at a future date.
  if p_month > v_current_month then
    raise exception '계좌 상태는 현재 월까지 변경할 수 있습니다.';
  end if;
  select * into v_account from public.accounts
  where id = p_account_id and user_id = p_user_id
  for update;
  if not found then raise exception '계좌를 찾을 수 없습니다.'; end if;

  v_history := v_account.activity_history;
  -- Be robust to older backups without events, retaining their inactive state.
  if v_history = '[]'::jsonb and not v_account.is_active then
    v_history := jsonb_build_array(jsonb_build_object(
      'month', coalesce(v_account.inactive_from_month, v_current_month), 'active', false
    ));
  end if;
  if exists (select 1 from jsonb_array_elements(v_history) as events(event)
             where event ->> 'month' > p_month) then
    raise exception '마지막 계좌 상태 변경 월 이후를 선택해 주세요.';
  end if;
  select (event ->> 'active')::boolean into v_active
  from jsonb_array_elements(v_history) with ordinality as events(event, ordinal)
  where event ->> 'month' <= p_month
  order by event ->> 'month' desc, ordinal desc limit 1;
  v_active := not coalesce(v_active, true);

  -- Replace this month's state atomically; preserve all earlier months.
  select coalesce(jsonb_agg(event order by event ->> 'month', ordinal), '[]'::jsonb)
  into v_history
  from jsonb_array_elements(v_history) with ordinality as events(event, ordinal)
  where event ->> 'month' <> p_month;
  v_history := v_history || jsonb_build_array(jsonb_build_object('month', p_month, 'active', v_active));
  select jsonb_agg(event order by event ->> 'month', ordinal) into v_history
  from jsonb_array_elements(v_history) with ordinality as events(event, ordinal);

  select (event ->> 'active')::boolean,
         case when (event ->> 'active')::boolean then null else event ->> 'month' end
  into v_current_active, v_inactive_from
  from jsonb_array_elements(v_history) with ordinality as events(event, ordinal)
  where event ->> 'month' <= v_current_month
  order by event ->> 'month' desc, ordinal desc limit 1;

  update public.accounts
  set activity_history = v_history,
      is_active = coalesce(v_current_active, true),
      inactive_from_month = v_inactive_from
  where id = p_account_id and user_id = p_user_id;
end;
$$;

revoke all on function public.toggle_account_activity(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.toggle_account_activity(uuid, uuid, text) to service_role;
