import assert from 'node:assert/strict'
import test from 'node:test'
import { valuationStatus } from '../lib/calc/child-valuation.ts'
import type { ChildAccount, ChildAccountMonthlySnapshot, ChildGiftDeposit } from '../lib/types.ts'

const account = { id: 'account-1', is_active: true } as ChildAccount
const snapshot = (month: string) => ({ account_id: account.id, month, evaluation_amount: 1_000_000 }) as ChildAccountMonthlySnapshot
const gift = (date: string, accountId: string | null = account.id) => ({
  child_account_id: accountId,
  gift_date: date,
}) as ChildGiftDeposit

test('평가 후 추가 입금은 손실로 계산하지 않고 평가 갱신을 요구한다', () => {
  const result = valuationStatus([account], [snapshot('2026-08-01')], [gift('2026-09-03')])
  assert.equal(result.ready, false)
  assert.match(result.reason, /평가 갱신/)
})

test('납입 계좌와 평가월이 모두 맞으면 운용손익 계산을 허용한다', () => {
  const result = valuationStatus([account], [snapshot('2026-09-01')], [gift('2026-09-03')])
  assert.equal(result.ready, true)
  assert.equal(result.valuedMonth, '2026-09')
})

test('연결되지 않은 납입은 임의의 계좌 손익에 포함하지 않는다', () => {
  const result = valuationStatus([account], [snapshot('2026-09-01')], [gift('2026-09-03', null)])
  assert.equal(result.ready, false)
  assert.match(result.reason, /미연결/)
})
