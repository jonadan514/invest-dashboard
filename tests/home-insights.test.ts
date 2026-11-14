import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAccountTotalTrend } from '../lib/calc/account-snapshots.ts'
import {
  accountSeries,
  addMonths,
  buildTrend,
  goalProgress,
  INVESTMENT_ACCOUNT_TYPES,
  monthsBetween,
  netWorthChangeDrivers,
  pickActiveGoal,
} from '../lib/calc/home-insights.ts'
import type { Account, AccountMonthlySnapshot, HouseholdGoal, NetWorthItem, NetWorthSnapshot } from '../lib/types.ts'

function account(id: string, type: Account['type'], overrides: Partial<Account> = {}): Account {
  return {
    id, name: id, broker: null, owner: 'me', type, base_currency: 'KRW', tax_benefit: false,
    is_emergency_fund: false, sort_order: 0, is_active: true, interest_rate: null, monthly_payment: null,
    maturity_date: null, created_at: '2026-01-01T00:00:00Z', ...overrides,
  }
}

function snap(account_id: string, month: string, evaluation_amount: number): AccountMonthlySnapshot {
  return { id: `${account_id}-${month}`, user_id: 'u', account_id, month, evaluation_amount, monthly_allocation: 0,
    ytd_contribution: 0, memo: null, created_at: '', updated_at: '' }
}

function item(id: string, kind: NetWorthItem['kind'], overrides: Partial<NetWorthItem> = {}): NetWorthItem {
  return { id, user_id: 'u', name: id, kind, category: kind === 'asset' ? 'real_estate' : 'mortgage', owner: 'household',
    interest_rate: null, start_date: null, maturity_date: null, monthly_payment: null, inactive_from_month: null,
    sort_order: 0, is_active: true, created_at: '', updated_at: '', ...overrides }
}

function itemSnap(item_id: string, month: string, amount: number): NetWorthSnapshot {
  return { id: `${item_id}-${month}`, user_id: 'u', item_id, month, amount, source: 'manual', created_at: '', updated_at: '' }
}

function goal(id: string, overrides: Partial<HouseholdGoal> = {}): HouseholdGoal {
  return { id, user_id: 'u', name: id, statement: id, sub: '', type: 'net_worth', target: 100, next_hint: '',
    sort_order: 0, achieved_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '', ...overrides }
}

test('월 계산 도우미는 연도 경계를 넘어 계산한다', () => {
  assert.equal(monthsBetween('2025-11', '2026-02'), 3)
  assert.equal(addMonths('2025-11', 3), '2026-02')
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-01', 0), '2026-01')
})

test('목표 진행률과 최근 평균 속도로 달성 예상 시점을 구한다', () => {
  const series = [
    { month: '2026-01', value: 40 }, // 6개월 창 밖이라 속도 계산에서 제외
    { month: '2026-05', value: 50 },
    { month: '2026-07', value: 60 },
    { month: '2026-09', value: 70 },
  ]
  const result = goalProgress(100, series, 6)
  assert.equal(result.current, 70)
  assert.equal(result.percent, 70)
  assert.equal(result.remaining, 30)
  assert.equal(result.paceMonths, 4)
  assert.equal(result.monthlyPace, 5)
  assert.equal(result.etaMonth, '2027-03')
  assert.equal(result.achieved, false)
})

test('목표를 넘기면 달성으로 보고 예상 시점은 계산하지 않는다', () => {
  const result = goalProgress(100, [{ month: '2026-08', value: 90 }, { month: '2026-09', value: 120 }])
  assert.equal(result.achieved, true)
  assert.equal(result.percent, 100)
  assert.equal(result.remaining, 0)
  assert.equal(result.etaMonth, null)
})

test('기록이 하나뿐이거나 줄어드는 중이면 예상 시점을 만들지 않는다', () => {
  const single = goalProgress(100, [{ month: '2026-09', value: 10 }])
  assert.equal(single.monthlyPace, null)
  assert.equal(single.etaMonth, null)
  const falling = goalProgress(100, [{ month: '2026-08', value: 30 }, { month: '2026-09', value: 20 }])
  assert.equal(falling.monthlyPace, -10)
  assert.equal(falling.etaMonth, null)
  const tooSlow = goalProgress(1_000_000, [{ month: '2026-08', value: 0 }, { month: '2026-09', value: 1 }])
  assert.equal(tooSlow.etaMonth, null)
  const empty = goalProgress(100, [])
  assert.equal(empty.current, 0)
  assert.equal(empty.percent, 0)
})

test('달성 처리하지 않은 목표 중 정렬 순서가 가장 앞선 목표를 고른다', () => {
  const goals = [
    goal('later', { sort_order: 2 }),
    goal('done', { sort_order: 0, achieved_at: '2026-05-01T00:00:00Z' }),
    goal('second-created', { sort_order: 1, created_at: '2026-02-01T00:00:00Z' }),
    goal('first-created', { sort_order: 1, created_at: '2026-01-01T00:00:00Z' }),
  ]
  assert.equal(pickActiveGoal(goals)?.id, 'first-created')
  assert.equal(pickActiveGoal([goal('done', { achieved_at: '2026-05-01T00:00:00Z' })]), null)
})

test('계좌 시리즈는 직전 기록을 이어 쓰고 해지된 계좌와 대상이 아닌 계좌를 뺀다', () => {
  const accounts = [
    account('stock', 'general'),
    account('pension', 'pension', { activity_history: [{ month: '2026-03', active: false }] }),
    account('cash', 'cash'),
  ]
  const snapshots = [snap('stock', '2026-01', 100), snap('pension', '2026-01', 50), snap('cash', '2026-01', 999), snap('stock', '2026-03', 130)]
  const series = accountSeries(accounts, snapshots, ['2026-01', '2026-02', '2026-03'],
    a => INVESTMENT_ACCOUNT_TYPES.includes(a.type))
  assert.deepEqual(series, [
    { month: '2026-01', value: 150 },
    { month: '2026-02', value: 150 },
    { month: '2026-03', value: 130 },
  ])
})

test('변화 요인의 합은 홈의 순자산 변화와 같고 영향이 큰 순으로 정렬된다', () => {
  const accounts = [
    account('stock', 'general'),
    account('closed', 'savings', { activity_history: [{ month: '2026-10', active: false }] }),
    account('flat', 'cash'),
  ]
  const accountSnapshots = [
    snap('stock', '2026-09', 1_000), snap('stock', '2026-10', 1_300),
    snap('closed', '2026-09', 200),
    snap('flat', '2026-08', 50),
  ]
  const items = [
    item('house', 'asset'),
    item('loan', 'liability'),
    item('car', 'asset', { inactive_from_month: '2026-10' }),
  ]
  const itemSnapshots = [
    itemSnap('house', '2026-09', 5_000), itemSnap('house', '2026-10', 5_100),
    itemSnap('loan', '2026-09', 3_000), itemSnap('loan', '2026-10', 2_950),
    itemSnap('car', '2026-08', 400),
  ]

  const drivers = netWorthChangeDrivers({ accounts, accountSnapshots, items, itemSnapshots, fromMonth: '2026-09', toMonth: '2026-10' })
  assert.deepEqual(drivers.map(d => [d.label, d.source, d.change]), [
    ['car', 'asset', -400],
    ['stock', 'account', 300],
    ['closed', 'account', -200],
    ['house', 'asset', 100],
    ['loan', 'liability', 50],
  ])

  const trend = buildTrend(items, itemSnapshots, buildAccountTotalTrend(accounts, accountSnapshots, '2026-10'), '2026-10')
  const from = trend.find(point => point.month === '2026-09')!
  const to = trend.find(point => point.month === '2026-10')!
  assert.equal(drivers.reduce((sum, d) => sum + d.change, 0), to.netWorth - from.netWorth)
})

test('추이는 종료된 밸런스 시트 항목을 종료 월부터 뺀다', () => {
  const items = [item('car', 'asset', { inactive_from_month: '2026-03' }), item('loan', 'liability')]
  const trend = buildTrend(items, [itemSnap('car', '2026-01', 400), itemSnap('loan', '2026-01', 100)],
    [{ month: '2026-02', amount: 1_000 }], '2026-03')
  assert.deepEqual(trend, [
    { month: '2026-01', assets: 400, liabilities: 100, netWorth: 300 },
    { month: '2026-02', assets: 1_400, liabilities: 100, netWorth: 1_300 },
    { month: '2026-03', assets: 1_000, liabilities: 100, netWorth: 900 },
  ])
})
