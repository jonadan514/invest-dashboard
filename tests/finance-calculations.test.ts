import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAccountTotalTrend, latestSnapshotsAtMonth, latestYearContributions } from '../lib/calc/account-snapshots.ts'
import { calcDeductible, pensionProgress } from '../lib/calc/pension.ts'
import type { Account, AccountMonthlySnapshot } from '../lib/types.ts'

const account = (id: string, type: Account['type'] = 'general') => ({ id, type, is_active: true }) as Account
const snapshot = (accountId: string, month: string, evaluation: number, ytd = 0) => ({
  account_id: accountId,
  month,
  evaluation_amount: evaluation,
  ytd_contribution: ytd,
}) as AccountMonthlySnapshot

test('계좌 평가금액은 기록이 없는 달에도 최근 월말 값을 이어받는다', () => {
  const accounts = [account('cash'), account('pension', 'pension')]
  const snapshots = [
    snapshot('cash', '2026-08', 10_000_000),
    snapshot('pension', '2026-08', 3_000_000, 2_000_000),
    snapshot('cash', '2026-09', 11_000_000),
  ]
  assert.deepEqual(buildAccountTotalTrend(accounts, snapshots), [
    { month: '2026-08', amount: 13_000_000 },
    { month: '2026-09', amount: 14_000_000 },
  ])
  assert.equal(latestSnapshotsAtMonth(snapshots, '2026-09').get('pension')?.month, '2026-08')
  assert.equal(latestYearContributions(accounts, snapshots, '2026').get('pension')?.ytd_contribution, 2_000_000)
})

test('연금저축과 IRP 공제 달성률은 모든 화면에서 같은 규칙을 사용한다', () => {
  assert.equal(calcDeductible(9_000_000, 0).total, 6_000_000)
  assert.ok(Math.abs(pensionProgress(9_000_000, 0) - (100 * 6 / 9)) < 1e-9)
  assert.equal(calcDeductible(6_000_000, 5_000_000).total, 9_000_000)
  assert.equal(pensionProgress(6_000_000, 5_000_000), 100)
})
