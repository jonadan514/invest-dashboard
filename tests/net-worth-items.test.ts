import assert from 'node:assert/strict'
import test from 'node:test'
import { isAutoMortgage, pickBalances } from '../lib/calc/net-worth-items.ts'

test('자동 상환 대출: 주담대이고 금리와 월 상환액(또는 만기)이 있을 때만', () => {
  const base = { category: 'mortgage', interest_rate: 3.95, monthly_payment: 2_944_792, maturity_date: null }
  assert.equal(isAutoMortgage(base), true)
  assert.equal(isAutoMortgage({ ...base, monthly_payment: null, maturity_date: '2074-02-05' }), true)
  assert.equal(isAutoMortgage({ ...base, monthly_payment: null }), false)
  assert.equal(isAutoMortgage({ ...base, interest_rate: null }), false)
  assert.equal(isAutoMortgage({ ...base, category: 'credit_loan' }), false)
})

test('월말 기록 저장: 폼에 있는 항목만 저장하고, 없는 항목(자동 상환)은 건드리지 않는다', () => {
  const form: Record<string, string> = { amount_a: '1,000,000', amount_c: '0' }
  assert.deepEqual(pickBalances(['a', 'b', 'c'], name => form[name] ?? null), [{ item_id: 'a', amount: 1_000_000 }, { item_id: 'c', amount: 0 }])
  assert.throws(() => pickBalances(['a'], () => ' '), /금액을 입력/)
  assert.throws(() => pickBalances(['a'], () => '-5'), /0 이상/)
  assert.deepEqual(pickBalances(['a'], () => null), [])
})
