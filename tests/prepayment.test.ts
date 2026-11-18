import assert from 'node:assert/strict'
import test from 'node:test'
import { prepaymentFee, runPayoff, simulatePrepayment } from '../lib/calc/prepayment.ts'

// 실제 대출: 2026년 11월 납부 후 잔액, 연 3.95%, 월부금 2,944,792원, 만기 2074-02
const loan = { balance: 755_812_811, balanceMonth: '2026-11', annualRate: 3.95, monthlyPayment: 2_944_792, feeRatePercent: 0, startDate: null }

test('지금대로 갚으면 만기(2074년 2월) 즈음 끝난다', () => {
  const base = runPayoff(loan.balance, loan.annualRate, loan.monthlyPayment, '2026-12')!
  assert.equal(base.months, 567)
  assert.equal(base.lastMonth, '2074-02', '버림 잔돈은 마지막 회차에 정산해 만기와 같다')
  assert.equal(runPayoff(100_000_000, 6, 400_000, '2026-12'), null, '이자보다 적게 내면 끝나지 않는다')
})

test('기간 단축: 월 상환액은 그대로, 기간과 이자가 줄어든다', () => {
  const result = simulatePrepayment({ ...loan, amount: 50_000_000, prepayMonth: '2026-12', method: 'shorten' })!
  assert.equal(result.plan.monthlyPayment, loan.monthlyPayment)
  assert.ok(result.monthsSaved > 0)
  assert.ok(result.interestSaved > 50_000_000, '50년 대출이라 아끼는 이자가 갚은 돈보다 크다')
  assert.equal(result.applied, 50_000_000)
})

test('월 상환액 감소: 만기는 그대로, 월 상환액이 줄고 아끼는 이자는 기간 단축보다 적다', () => {
  const shorten = simulatePrepayment({ ...loan, amount: 50_000_000, prepayMonth: '2026-12', method: 'shorten' })!
  const reduce = simulatePrepayment({ ...loan, amount: 50_000_000, prepayMonth: '2026-12', method: 'reduce' })!
  assert.ok(reduce.plan.monthlyPayment < loan.monthlyPayment)
  assert.equal(reduce.monthsSaved, 0, '만기는 그대로')
  assert.equal(reduce.plan.lastMonth, '2074-02')
  assert.ok(reduce.interestSaved > 0 && reduce.interestSaved < shorten.interestSaved)
})

test('상환 달까지는 정기 납부를 한 뒤 갚고, 잔액보다 많이 넣으면 잔액만큼만', () => {
  const later = simulatePrepayment({ ...loan, amount: 10_000_000, prepayMonth: '2027-03', method: 'shorten' })!
  assert.ok(later.balanceBefore < loan.balance)
  const all = simulatePrepayment({ ...loan, amount: 2_000_000_000, prepayMonth: '2026-12', method: 'shorten' })!
  assert.equal(all.applied, all.balanceBefore)
  assert.equal(all.plan.monthlyPayment, 0)
  assert.equal(all.plan.months, 1)
})

test('중도상환수수료: 3년에서 남은 기간 비율만큼, 3년이 지나면 0원', () => {
  assert.equal(prepaymentFee(10_000_000, 1.2, null, '2026-12-05'), 120_000)
  assert.equal(prepaymentFee(10_000_000, 1.2, '2026-12-05', '2026-12-05'), 120_000)
  assert.equal(prepaymentFee(10_000_000, 1.2, '2023-01-01', '2026-12-05'), 0)
  const half = prepaymentFee(10_000_000, 1.2, '2025-06-05', '2026-12-04')
  assert.ok(half > 50_000 && half < 70_000, `${half}`)
  const withFee = simulatePrepayment({ ...loan, amount: 10_000_000, prepayMonth: '2026-12', method: 'shorten', feeRatePercent: 1.2 })!
  assert.equal(withFee.fee, 120_000)
  assert.equal(withFee.netSaving, withFee.interestSaved - 120_000)
})
