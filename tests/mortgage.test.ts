import assert from 'node:assert/strict'
import test from 'node:test'
import { estimateAnnualRate, simulateMortgage } from '../lib/calc/mortgage.ts'

test('원리금균등 상환의 완납 개월 수와 총이자를 계산한다', () => {
  // 1억, 연 6%, 30년 원리금균등 월 납입액은 약 599,551원이다.
  const result = simulateMortgage({ balance: 100_000_000, annualRate: 6, monthlyPayment: 599_551 })
  assert.equal(result.months, 360)
  assert.ok(Math.abs(result.totalInterest! - 115_838_000) < 2_000)
  assert.equal(result.firstMonthInterest, 500_000)
})

test('일시 상환과 매월 추가 상환은 기간과 이자를 줄인다', () => {
  const base = simulateMortgage({ balance: 100_000_000, annualRate: 6, monthlyPayment: 599_551 })
  const lump = simulateMortgage({ balance: 100_000_000, annualRate: 6, monthlyPayment: 599_551, lumpSum: 10_000_000 })
  const monthly = simulateMortgage({ balance: 100_000_000, annualRate: 6, monthlyPayment: 599_551, extraMonthly: 200_000 })
  assert.ok(lump.months! < base.months!)
  assert.ok(lump.totalInterest! < base.totalInterest!)
  assert.ok(monthly.months! < base.months!)
  assert.ok(monthly.totalInterest! < lump.totalInterest!)
})

test('금리가 0이면 잔액을 납입액으로 나눈 기간이다', () => {
  assert.deepEqual(simulateMortgage({ balance: 1_200_000, annualRate: 0, monthlyPayment: 100_000 }), { months: 12, totalInterest: 0, firstMonthInterest: 0 })
})

test('납입액이 이자보다 작거나 일시 상환으로 다 갚으면 그에 맞게 표시한다', () => {
  const never = simulateMortgage({ balance: 100_000_000, annualRate: 6, monthlyPayment: 400_000 })
  assert.equal(never.months, null)
  assert.equal(never.totalInterest, null)
  assert.deepEqual(simulateMortgage({ balance: 5_000_000, annualRate: 4, monthlyPayment: 100_000, lumpSum: 6_000_000 }), { months: 0, totalInterest: 0, firstMonthInterest: 0 })
})

test('최근 이자로 연 금리를 추정한다', () => {
  assert.equal(estimateAnnualRate(300_000_000, 1_000_000), 4)
  assert.equal(estimateAnnualRate(0, 1_000_000), null)
  assert.equal(estimateAnnualRate(300_000_000, 0), null)
})
