-- Run against a disposable/local database after migrations, or as a single
-- transaction in the SQL editor. Synthetic fixture rows all roll back; no DDL.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  other_owner_id uuid := gen_random_uuid();
  mortgage_id uuid := gen_random_uuid();
  other_mortgage_id uuid := gen_random_uuid();
  cash_id uuid := gen_random_uuid();
  account_id uuid := gen_random_uuid();
  february_id uuid;
  before_rows jsonb;
  after_rows jsonb;
  failed boolean;
  m text;
  budget jsonb := '{"joint_savings":0,"bonus_total":0,"bonus_to_plan":0,"cash_balance":0,"mortgage_interest":10,"mortgage_principal":80,"mortgage_extra_principal":20}';
begin
  insert into auth.users(id, aud, role) values
    (owner_id, 'authenticated', 'authenticated'),
    (other_owner_id, 'authenticated', 'authenticated');
  insert into public.net_worth_items(id, user_id, name, kind, category) values
    (mortgage_id, owner_id, 'Fixture mortgage', 'liability', 'mortgage'),
    (cash_id, owner_id, 'Fixture cash', 'asset', 'cash'),
    (other_mortgage_id, other_owner_id, 'Other household mortgage', 'liability', 'mortgage');
  insert into public.accounts(id, user_id, name, type)
    values (account_id, owner_id, 'Fixture account', 'general');
  insert into public.net_worth_snapshots(user_id, item_id, month, amount, source) values
    (other_owner_id, other_mortgage_id, '2026-01', 9999, 'manual'),
    (other_owner_id, other_mortgage_id, '2026-02', 8888, 'mortgage_auto');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  execute 'set local role service_role';

  assert not has_function_privilege('anon', 'public.save_net_worth_snapshot(uuid,text,jsonb)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.save_net_worth_snapshot(uuid,text,jsonb)', 'EXECUTE');

  -- Budgets predating the first manual anchor must not invent a balance.
  perform public.save_household_monthly_record(owner_id, '2025-12', budget, '[]');
  foreach m in array array['2026-01','2026-02','2026-03','2026-04','2026-05'] loop
    perform public.save_household_monthly_record(owner_id, m, budget, '[]');
  end loop;
  assert not exists (select 1 from public.net_worth_snapshots where user_id = owner_id);

  -- A newly added mortgage's first manual balance replays existing later months.
  perform public.save_net_worth_snapshot(owner_id, '2026-01',
    jsonb_build_array(jsonb_build_object('item_id', mortgage_id, 'amount', 1000)));
  assert (select amount = 900 and source = 'mortgage_auto' from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-02');
  assert (select amount = 800 from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-03');
  assert not exists (select 1 from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2025-12');
  select id into february_id from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-02';

  -- A later manual anchor remains independent of earlier corrections.
  perform public.save_net_worth_snapshot(owner_id, '2026-04',
    jsonb_build_array(jsonb_build_object('item_id', mortgage_id, 'amount', 700)));
  perform public.save_net_worth_snapshot(owner_id, '2026-01',
    jsonb_build_array(jsonb_build_object('item_id', mortgage_id, 'amount', 1200),
      jsonb_build_object('item_id', cash_id, 'amount', 50)));
  assert (select amount = 1100 and id = february_id from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-02');
  assert (select amount = 1000 from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-03');
  assert (select amount = 700 and source = 'manual' from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-04');
  assert (select amount = 600 from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-05');

  -- Editing principal through the existing RPC uses the very same replay.
  perform public.save_household_monthly_record(owner_id, '2026-02',
    budget || '{"mortgage_principal":130}',
    jsonb_build_array(jsonb_build_object('account_id', account_id,
      'evaluation_amount', 500, 'monthly_allocation', 50, 'ytd_contribution', 100)));
  assert (select evaluation_amount = 500 and monthly_allocation = 50 and ytd_contribution = 100
    from public.account_monthly_snapshots where user_id = owner_id and month = '2026-02');
  assert (select amount = 1050 from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-02');
  assert (select amount = 950 from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-03');
  assert (select amount = 600 from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-05');

  select jsonb_agg(to_jsonb(s) order by id) into before_rows
    from public.net_worth_snapshots s where user_id = owner_id;
  -- Duplicate manual entries must reject the whole payload without partial saves.
  failed := false;
  begin
    perform public.save_net_worth_snapshot(owner_id, '2026-01',
      jsonb_build_array(jsonb_build_object('item_id', mortgage_id, 'amount', 999),
        jsonb_build_object('item_id', mortgage_id, 'amount', 90)));
  exception when others then failed := true;
  end;
  assert failed, 'Duplicate items must be rejected';
  select jsonb_agg(to_jsonb(s) order by id) into after_rows
    from public.net_worth_snapshots s where user_id = owner_id;
  assert before_rows = after_rows, 'Invalid manual payloads must not partially save';

  -- The budget upsert happens before the account insert. A NOT NULL failure
  -- during that insert must roll back the budget and preserve all snapshots.
  failed := false;
  begin
    perform public.save_household_monthly_record(owner_id, '2026-02',
      budget || '{"mortgage_principal":300}',
      jsonb_build_array(jsonb_build_object('account_id', account_id,
        'evaluation_amount', null, 'monthly_allocation', 99, 'ytd_contribution', 199)));
  exception when not_null_violation then
    failed := true;
  end;
  assert failed, 'The fixture must reach the downstream account NOT NULL constraint';
  assert (select mortgage_principal = 130 from public.monthly_budgets
    where user_id = owner_id and month = '2026-02');
  assert (select evaluation_amount = 500 and monthly_allocation = 50 and ytd_contribution = 100
    from public.account_monthly_snapshots where user_id = owner_id and month = '2026-02');
  select jsonb_agg(to_jsonb(s) order by id) into after_rows
    from public.net_worth_snapshots s where user_id = owner_id;
  assert before_rows = after_rows, 'Failed monthly saves must preserve manual and derived rows';

  -- Mixed valid and foreign item IDs cannot partially save or cross ownership.
  failed := false;
  begin
    perform public.save_net_worth_snapshot(owner_id, '2026-01',
      jsonb_build_array(jsonb_build_object('item_id', mortgage_id, 'amount', 1),
        jsonb_build_object('item_id', other_mortgage_id, 'amount', 1)));
  exception when others then failed := true;
  end;
  assert failed, 'Foreign items must be rejected';
  select jsonb_agg(to_jsonb(s) order by id) into after_rows
    from public.net_worth_snapshots s where user_id = owner_id;
  assert before_rows = after_rows;
  assert (select amount = 8888 from public.net_worth_snapshots
    where item_id = other_mortgage_id and month = '2026-02');

  failed := false;
  begin
    perform public.save_net_worth_snapshot(other_owner_id, '2026-01',
      jsonb_build_array(jsonb_build_object('item_id', other_mortgage_id, 'amount', 1)));
  exception when others then failed := true;
  end;
  assert failed, 'A JWT owner mismatch must be rejected';

  -- Zero is a real manual anchor, and repayments never make debt negative.
  perform public.save_net_worth_snapshot(owner_id, '2026-04',
    jsonb_build_array(jsonb_build_object('item_id', mortgage_id, 'amount', 0)));
  assert (select amount = 0 and source = 'manual' from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-04');
  assert (select amount = 0 from public.net_worth_snapshots
    where item_id = mortgage_id and month = '2026-05');

  execute 'reset role';
  raise notice 'PASS: manual replay, monthly replay, preserved anchors and IDs, atomic rollback, ownership, zero floor';
end;
$$;

rollback;
