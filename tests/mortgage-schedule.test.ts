import assert from 'node:assert/strict'
import test from 'node:test'
import { amortizeMonth, buildMortgageSchedule, expectedMortgagePayment, resolveMonthlyPayment } from '../lib/calc/mortgage-schedule.ts'
import { levelPayment, monthlyInterest, monthsBetween } from '../lib/calc/loan-interest.ts'
import { buildRepaymentTable } from '../lib/calc/repayment-table.ts'

// 실제 은행 납부 내역(연 3.95%, 월부금 2,944,792원, 만기 2074-02-05)
const RATE = 3.95
const PAYMENT = 2_944_792
const BANK = [
  { month: '2026-09', principal: 452_426, interest: 2_492_366, after: 756_722_136 },
  { month: '2026-10', principal: 453_915, interest: 2_490_877, after: 756_268_221 },
  { month: '2026-11', principal: 455_410, interest: 2_489_382, after: 755_812_811 },
]
const loan = { id: 'm', interest_rate: RATE, monthly_payment: PAYMENT, maturity_date: '2074-02-05', inactive_from_month: null }

test('이자 = 납부 전 잔액 × 연금리 ÷ 12(원 미만 버림), 원금 = 월부금 − 이자: 은행 내역과 1원까지 같다', () => {
  for (const row of BANK) {
    const before = row.after + row.principal
    assert.equal(monthlyInterest(before, RATE), row.interest, row.month)
    assert.deepEqual(amortizeMonth(before, RATE, PAYMENT), { interest: row.interest, principal: row.principal }, row.month)
  }
  assert.equal(monthlyInterest(320_000_000, 3.9), 1_040_000, '부동소수 오차로 1원이 덜 잘리지 않는다')
  assert.deepEqual(amortizeMonth(500_000, 3.9, 1_650_000), { interest: 1_625, principal: 500_000 }, '마지막 달은 잔액까지만')
  assert.deepEqual(amortizeMonth(100_000_000, 6, 400_000), { interest: 500_000, principal: 0 }, '납입액이 이자보다 작으면 원금은 0')
})

test('만기로 월부금을 계산하면 은행 월부금과 같다', () => {
  assert.equal(monthsBetween('2026-11', '2074-02'), 567)
  assert.equal(levelPayment(755_812_811, RATE, 567), PAYMENT)
  assert.equal(levelPayment(1_200_000, 0, 12), 100_000)
  assert.equal(levelPayment(1_000_000, RATE, 0), null)
  assert.deepEqual(resolveMonthlyPayment(loan, 755_812_811, '2026-11'), { amount: PAYMENT, source: 'item' })
  assert.deepEqual(resolveMonthlyPayment({ ...loan, monthly_payment: null }, 755_812_811, '2026-11'), { amount: PAYMENT, source: 'maturity' })
  assert.equal(resolveMonthlyPayment({ ...loan, monthly_payment: null, maturity_date: null }, 755_812_811, '2026-11'), null)
})

test('수동 잔액에서 시작한 자동 상환 잔액이 은행 잔액과 같다(월 상환액 없이 만기만 있어도)', () => {
  for (const item of [loan, { ...loan, monthly_payment: null }]) {
    const schedule = buildMortgageSchedule({
      item, snapshots: [{ month: '2026-09', amount: BANK[0].after, source: 'manual' }], budgetPrincipal: null, throughMonth: '2026-11',
    })
    assert.deepEqual(schedule.map(row => [row.month, row.interest, row.principal, row.balance]), [
      ['2026-10', BANK[1].interest, BANK[1].principal, BANK[1].after],
      ['2026-11', BANK[2].interest, BANK[2].principal, BANK[2].after],
    ])
  }
})

test('월간 기록 원금이 있는 달은 그 금액만큼, 수동 기록은 덮어쓰지 않고 새 기준으로', () => {
  const schedule = buildMortgageSchedule({
    item: loan,
    snapshots: [{ month: '2026-09', amount: BANK[0].after, source: 'manual' }, { month: '2026-11', amount: 700_000_000, source: 'manual' }],
    budgetPrincipal: new Map([['2026-10', 10_000_000]]),
    throughMonth: '2026-12',
  })
  assert.deepEqual(schedule.map(row => [row.month, row.basis]), [['2026-10', 'budget'], ['2026-12', 'schedule']])
  assert.equal(schedule[0].balance, BANK[0].after - 10_000_000)
  assert.equal(schedule[1].balance, 700_000_000 - amortizeMonth(700_000_000, RATE, PAYMENT).principal)
})

test('기준 잔액이나 상환 조건이 없으면 만들지 않고, 종료 월과 완납 이후는 멈춘다', () => {
  assert.deepEqual(buildMortgageSchedule({ item: loan, snapshots: [], budgetPrincipal: null, throughMonth: '2026-11' }), [])
  const noTerms = buildMortgageSchedule({ item: { ...loan, interest_rate: null }, snapshots: [{ month: '2026-08', amount: 1_000_000, source: 'manual' }], budgetPrincipal: new Map([['2026-10', 100_000]]), throughMonth: '2026-11' })
  assert.deepEqual(noTerms.map(row => [row.month, row.balance]), [['2026-10', 900_000]], '조건이 없어도 월간 기록 원금은 반영')
  const closed = buildMortgageSchedule({ item: { ...loan, inactive_from_month: '2026-10' }, snapshots: [{ month: '2026-08', amount: 320_000_000, source: 'manual' }], budgetPrincipal: null, throughMonth: '2026-12' })
  assert.deepEqual(closed.map(row => row.month), ['2026-09'])
  const paidOff = buildMortgageSchedule({ item: { ...loan, monthly_payment: 1_650_000 }, snapshots: [{ month: '2026-08', amount: 2_000_000, source: 'manual' }], budgetPrincipal: null, throughMonth: '2026-12' })
  assert.deepEqual(paidOff.map(row => row.balance), [356_583, 0])
})

test('월간 기록 자동 채우기: 직전 달 잔액으로 은행과 같은 이자·원금, 월 상환액 없으면 만기로', () => {
  assert.deepEqual(expectedMortgagePayment(BANK[1].after, loan, '2026-11'), { interest: BANK[2].interest, principal: BANK[2].principal })
  assert.deepEqual(expectedMortgagePayment(BANK[1].after, { ...loan, monthly_payment: null }, '2026-11'), { interest: BANK[2].interest, principal: BANK[2].principal })
  assert.deepEqual(expectedMortgagePayment(BANK[1].after, { interest_rate: RATE, monthly_payment: null, maturity_date: null }, '2026-11'), { interest: BANK[2].interest, principal: null })
  assert.equal(expectedMortgagePayment(null, loan, '2026-11'), null)
  assert.equal(expectedMortgagePayment(BANK[1].after, { ...loan, interest_rate: null }, '2026-11'), null)
})

test('상환 이력: 잔액 기록 변화로 계산하고, 월간 기록이 있으면 그 값(실제)을 쓴다. 최신순', () => {
  const { past } = buildRepaymentTable({
    balance: BANK[2].after, balanceMonth: '2026-11', annualRate: RATE, monthlyPayment: PAYMENT,
    history: [{ month: '2026-08', amount: BANK[0].after + BANK[0].principal }, ...BANK.map(row => ({ month: row.month, amount: row.after }))],
    recorded: [{ month: '2026-11', interest: BANK[2].interest, principal: BANK[2].principal }],
  })
  assert.deepEqual(past.map(row => [row.month, row.principal, row.interest, row.total, row.balanceAfter, row.recorded ?? false]), [
    ['2026-11', BANK[2].principal, BANK[2].interest, PAYMENT, BANK[2].after, true],
    ['2026-10', BANK[1].principal, BANK[1].interest, PAYMENT, BANK[1].after, false],
    ['2026-09', BANK[0].principal, BANK[0].interest, PAYMENT, BANK[0].after, false],
  ])
  const onlyRecorded = buildRepaymentTable({ balance: BANK[2].after, balanceMonth: '2026-11', annualRate: RATE, monthlyPayment: PAYMENT, history: [{ month: '2026-11', amount: BANK[2].after }], recorded: [{ month: '2026-10', interest: 1, principal: 2 }] })
  assert.deepEqual(onlyRecorded.past.map(row => [row.month, row.balanceAfter]), [['2026-10', null]], '잔액 기록이 없는 달은 잔액 null')
})

test('월별 상환 예정: 월부금 고정, 이자는 줄고 원금은 늘며 잔액이 이어진다', () => {
  const { future } = buildRepaymentTable({ balance: BANK[0].after, balanceMonth: '2026-09', annualRate: RATE, monthlyPayment: PAYMENT, history: [], futureMonths: 3 })
  assert.deepEqual(future.slice(0, 2).map(row => [row.month, row.principal, row.interest, row.balanceAfter]), [
    ['2026-10', BANK[1].principal, BANK[1].interest, BANK[1].after],
    ['2026-11', BANK[2].principal, BANK[2].interest, BANK[2].after],
  ])
  assert.ok(future.every(row => row.total === PAYMENT))
  assert.deepEqual(buildRepaymentTable({ balance: 1, balanceMonth: '2026-09', annualRate: null, monthlyPayment: PAYMENT, history: [] }), { past: [], future: [] })
  const paid = buildRepaymentTable({ balance: 1_000_000, balanceMonth: '2026-09', annualRate: RATE, monthlyPayment: PAYMENT, history: [] })
  assert.deepEqual(paid.future.map(row => row.balanceAfter), [0], '완납하면 거기서 끝')
})
