-- Execute after the accounts activity migration. All fixtures roll back.
begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_account_id uuid := gen_random_uuid();
  v_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_prior text := to_char((now() at time zone 'Asia/Seoul') - interval '1 month', 'YYYY-MM');
  v_earlier text := to_char((now() at time zone 'Asia/Seoul') - interval '2 months', 'YYYY-MM');
  v_future text := to_char((now() at time zone 'Asia/Seoul') + interval '1 month', 'YYYY-MM');
  v_row public.accounts%rowtype;
  v_history jsonb;
  v_rejected boolean;
begin
  insert into auth.users (id) values (v_user), (v_other_user);
  insert into public.accounts (id, user_id, name, type, owner)
  values (v_account_id, v_user, 'rollback-only activity test', 'pension', 'me');

  -- Atomic toggle derives the persisted state; no client status argument exists.
  perform public.toggle_account_activity(v_user, v_account_id, v_month);
  select * into v_row from public.accounts where id = v_account_id;
  assert not v_row.is_active and v_row.inactive_from_month = v_month, 'close current account';
  assert v_row.activity_history = jsonb_build_array(jsonb_build_object('month', v_month, 'active', false)), 'close event recorded';

  perform public.toggle_account_activity(v_user, v_account_id, v_month);
  select * into v_row from public.accounts where id = v_account_id;
  assert v_row.is_active and v_row.inactive_from_month is null, 'same-month reopen uses locked persisted state';
  assert jsonb_array_length(v_row.activity_history) = 1 and (v_row.activity_history -> 0 ->> 'active')::boolean, 'same-month last state wins';

  v_history := jsonb_build_array(
    jsonb_build_object('month', v_earlier, 'active', false),
    jsonb_build_object('month', v_prior, 'active', true)
  );
  update public.accounts set activity_history = v_history, is_active = true where id = v_account_id;
  perform public.toggle_account_activity(v_user, v_account_id, v_month);
  select * into v_row from public.accounts where id = v_account_id;
  assert not v_row.is_active and jsonb_array_length(v_row.activity_history) = 3, 'second closure';
  assert v_row.activity_history -> 0 = v_history -> 0 and v_row.activity_history -> 1 = v_history -> 1, 'old closed interval retained';
  perform public.toggle_account_activity(v_user, v_account_id, v_month);
  select * into v_row from public.accounts where id = v_account_id;
  assert v_row.is_active and jsonb_array_length(v_row.activity_history) = 3, 'second reopen';
  assert v_row.activity_history -> 0 = v_history -> 0 and v_row.activity_history -> 1 = v_history -> 1, 'reopen does not erase old interval';
  v_history := v_row.activity_history;

  v_rejected := false;
  begin
    perform public.toggle_account_activity(v_user, v_account_id, v_future);
  exception when raise_exception then
    if sqlerrm <> '계좌 상태는 현재 월까지 변경할 수 있습니다.' then raise; end if;
    v_rejected := true;
  end;
  assert v_rejected, 'future status change rejected';

  v_rejected := false;
  begin
    perform public.toggle_account_activity(v_user, v_account_id, v_prior);
  exception when raise_exception then
    if sqlerrm <> '마지막 계좌 상태 변경 월 이후를 선택해 주세요.' then raise; end if;
    v_rejected := true;
  end;
  assert v_rejected, 'out-of-order status change rejected';

  v_rejected := false;
  begin
    perform public.toggle_account_activity(v_other_user, v_account_id, v_month);
  exception when raise_exception then
    if sqlerrm <> '계좌를 찾을 수 없습니다.' then raise; end if;
    v_rejected := true;
  end;
  assert v_rejected, 'cross-owner change rejected';

  v_rejected := false;
  begin
    update public.accounts set activity_history = '[{"month":"2026-13","active":"yes"}]'::jsonb where id = v_account_id;
  exception when check_violation then
    v_rejected := true;
  end;
  assert v_rejected, 'invalid activity payload rejected';
  select * into v_row from public.accounts where id = v_account_id;
  assert v_row.activity_history = v_history and v_row.is_active, 'failed calls leave account unchanged';
  assert not has_function_privilege('anon', 'public.toggle_account_activity(uuid,uuid,text)', 'execute'), 'anon cannot call';
  assert not has_function_privilege('authenticated', 'public.toggle_account_activity(uuid,uuid,text)', 'execute'), 'authenticated cannot call';
  assert has_function_privilege('service_role', 'public.toggle_account_activity(uuid,uuid,text)', 'execute'), 'server can call';
end;
$$;
rollback;
