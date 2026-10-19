import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAccountTotalTrend, isAccountActiveAtMonth, latestSnapshotsAtMonth, latestYearContributions } from '../lib/calc/account-snapshots.ts'
import type { Account, AccountMonthlySnapshot } from '../lib/types.ts'

const account = (overrides: Partial<Account> = {}) => ({
  id: 'pension', type: 'pension', is_active: true, ...overrides,
}) as Account
const snapshot = (month: string, amount: number, contribution = amount) => ({
  account_id: 'pension', month, evaluation_amount: amount, ytd_contribution: contribution,
}) as AccountMonthlySnapshot

test('closing an account preserves earlier totals and contributions, emits zero at closure without a new snapshot', () => {
  const closed = account({ is_active: false, inactive_from_month: '2026-10', activity_history: [{ month: '2026-10', active: false }] })
  const snapshots = [snapshot('2026-08', 100, 60), snapshot('2026-09', 120, 80)]
  assert.deepEqual(buildAccountTotalTrend([closed], snapshots, '2026-10'), [
    { month: '2026-08', amount: 100 },
    { month: '2026-09', amount: 120 },
    { month: '2026-10', amount: 0 },
  ])
  assert.equal(latestYearContributions([closed], snapshots, '2026', '2026-10').get('pension')?.ytd_contribution, 80)
  assert.equal(isAccountActiveAtMonth(closed, '2026-09'), true)
  assert.equal(isAccountActiveAtMonth(closed, '2026-10'), false)
})

test('reactivation preserves the closed interval across repeated monthly transitions', () => {
  const reopened = account({ activity_history: [
    { month: '2026-07', active: false }, { month: '2026-09', active: true },
    { month: '2026-10', active: false }, { month: '2026-11', active: true },
  ] })
  const snapshots = [snapshot('2026-06', 100), snapshot('2026-08', 200), snapshot('2026-09', 300)]
  assert.deepEqual(buildAccountTotalTrend([reopened], snapshots, '2026-11'), [
    { month: '2026-06', amount: 100 }, { month: '2026-07', amount: 0 },
    { month: '2026-08', amount: 0 }, { month: '2026-09', amount: 300 },
    { month: '2026-10', amount: 0 }, { month: '2026-11', amount: 300 },
  ])
})

test('current totals and annual contributions ignore future records while an explicitly selected future month includes them', () => {
  const accounts = [account()]
  const snapshots = [snapshot('2025-12', 50, 40), snapshot('2026-09', 100, 60), snapshot('2026-12', 900, 500), snapshot('2027-01', 1_000, 10)]
  assert.deepEqual(buildAccountTotalTrend(accounts, snapshots, '2026-10'), [
    { month: '2025-12', amount: 50 }, { month: '2026-09', amount: 100 },
  ])
  assert.equal(latestSnapshotsAtMonth(snapshots, '2026-10').get('pension')?.evaluation_amount, 100)
  assert.equal(latestYearContributions(accounts, snapshots, '2026', '2026-10').get('pension')?.ytd_contribution, 60)
  assert.equal(latestYearContributions(accounts, snapshots, '2027', '2026-10').size, 0)
  assert.equal(latestYearContributions(accounts, snapshots, '2025', '2026-10').get('pension')?.ytd_contribution, 40)
  assert.equal(buildAccountTotalTrend(accounts, snapshots, '2026-12').at(-1)?.amount, 900)
})

test('future closures are excluded from current trend and same-month activity uses the last state', () => {
  const accounts = [account({ activity_history: [
    { month: '2026-09', active: false }, { month: '2026-09', active: true },
    { month: '2026-12', active: false },
  ] })]
  assert.equal(isAccountActiveAtMonth(accounts[0], '2026-10'), true)
  assert.deepEqual(buildAccountTotalTrend(accounts, [snapshot('2026-08', 100)], '2026-10'), [
    { month: '2026-08', amount: 100 }, { month: '2026-09', amount: 100 },
  ])
  assert.equal(isAccountActiveAtMonth(accounts[0], '2026-12'), false)
})

test('legacy closure month preserves history without events and unknown accounts do not enter totals', () => {
  const closed = account({ is_active: false, inactive_from_month: '2026-10' })
  const snapshots = [snapshot('2026-09', 100), { ...snapshot('2026-09', 999), account_id: 'unknown' }]
  assert.deepEqual(buildAccountTotalTrend([closed], snapshots, '2026-10'), [
    { month: '2026-09', amount: 100 }, { month: '2026-10', amount: 0 },
  ])
})
