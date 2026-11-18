import assert from 'node:assert/strict'
import test from 'node:test'
import { amortizeMonth, buildMortgageSchedule, expectedMortgagePayment } from '../lib/calc/mortgage-schedule.ts'
import { dailyInterest, daysInMonth, interestDays } from '../lib/calc/loan-interest.ts'
import { simulateMortgage } from '../lib/calc/mortgage.ts'

const item = { id: 'm', interest_rate: 3.9, monthly_payment: 1_650_000, inactive_from_month: null }

test('원리금균등 한 달은 이자를 먼저 떼고 남은 금액을 원금으로 갚는다', () => {
  assert.deepEqual(amortizeMonth(320_000_000, 3.9, 1_650_000), { interest: 1_040_000, principal: 610_000 })
  // 이자 기간은 전달 일수: 1월 납부분은 12월(31일), 3월 납부분은 2월(28일). 정기 원금은 그대로다.
  assert.deepEqual(amortizeMonth(320_000_000, 3.9, 1_650_000, '2026-01'), { interest: Math.round(320_000_000 * 0.039 * 31 / 365), principal: 610_000 })
  assert.equal(amortizeMonth(320_000_000, 3.9, 1_650_000, '2026-03').interest, Math.round(320_000_000 * 0.039 * 28 / 365))
  assert.equal(amortizeMonth(320_000_000, 3.9, 1_650_000, '2026-03').principal, 610_000)
  assert.deepEqual(amortizeMonth(500_000, 3.9, 1_650_000), { interest: 1_625, principal: 500_000 }, '마지막 달은 잔액까지만')
  assert.deepEqual(amortizeMonth(100_000_000, 6, 400_000), { interest: 500_000, principal: 0 }, '납입액이 이자보다 작으면 원금은 0')
})

test('수동 잔액에서 시작해 기록이 없는 달은 스케줄로, 월간 기록이 있는 달은 그 원금으로 줄인다', () => {
  const schedule = buildMortgageSchedule({
    item,
    snapshots: [{ month: '2026-08', amount: 320_000_000, source: 'manual' }, { month: '2026-09', amount: 1, source: 'mortgage_auto' }],
    budgetPrincipal: new Map([['2026-10', 2_620_000]]),
    throughMonth: '2026-11',
  })
  assert.deepEqual(schedule.map(row => [row.month, row.basis, row.principal, row.balance]), [
    ['2026-09', 'schedule', 610_000, 319_390_000],
    ['2026-10', 'budget', 2_620_000, 316_770_000],
    ['2026-11', 'schedule', 620_497, 316_149_503],
  ])
  assert.equal(schedule[2].interest, Math.round(316_770_000 * 3.9 / 100 * 31 / 365), '11월 납부분은 10월 일수(31일)')
  assert.equal(schedule[1].interest, Math.round(319_390_000 * 3.9 / 100 * 30 / 365), '10월 납부분은 9월 일수(30일)')
})

test('수동 기록이 있는 달은 덮어쓰지 않고 그 값을 새 기준으로 삼는다', () => {
  const schedule = buildMortgageSchedule({
    item,
    snapshots: [{ month: '2026-08', amount: 320_000_000, source: 'manual' }, { month: '2026-10', amount: 300_000_000, source: 'manual' }],
    budgetPrincipal: null,
    throughMonth: '2026-11',
  })
  assert.deepEqual(schedule.map(row => row.month), ['2026-09', '2026-11'])
  assert.equal(schedule[1].balance, 300_000_000 - amortizeMonth(300_000_000, 3.9, 1_650_000).principal)
})

test('기준 잔액이나 상환 조건이 없으면 만들지 않고, 종료 월과 완납 이후는 멈춘다', () => {
  assert.deepEqual(buildMortgageSchedule({ item, snapshots: [], budgetPrincipal: null, throughMonth: '2026-11' }), [])
  const noTerms = buildMortgageSchedule({ item: { ...item, interest_rate: null }, snapshots: [{ month: '2026-08', amount: 1_000_000, source: 'manual' }], budgetPrincipal: new Map([['2026-10', 100_000]]), throughMonth: '2026-11' })
  assert.deepEqual(noTerms.map(row => [row.month, row.balance]), [['2026-10', 900_000]], '조건이 없어도 월간 기록 원금은 반영')
  const closed = buildMortgageSchedule({ item: { ...item, inactive_from_month: '2026-10' }, snapshots: [{ month: '2026-08', amount: 320_000_000, source: 'manual' }], budgetPrincipal: null, throughMonth: '2026-12' })
  assert.deepEqual(closed.map(row => row.month), ['2026-09'])
  const paidOff = buildMortgageSchedule({ item, snapshots: [{ month: '2026-08', amount: 2_000_000, source: 'manual' }], budgetPrincipal: null, throughMonth: '2026-12' })
  assert.deepEqual(paidOff.map(row => row.balance), [356_500, 0])
})

test('월간 기록 자동 채우기는 직전 잔액으로 그달 일수 이자와 정기 원금을 계산한다', () => {
  assert.deepEqual(expectedMortgagePayment(320_000_000, item, '2026-10'), { interest: Math.round(320_000_000 * 0.039 * 30 / 365), principal: 610_000 })
  assert.equal(expectedMortgagePayment(null, item, '2026-10'), null)
  assert.equal(expectedMortgagePayment(320_000_000, { interest_rate: null, monthly_payment: 1_650_000 }, '2026-10'), null)
  // 월 상환액이 없어도 잔액과 금리만으로 이자는 채운다.
  assert.deepEqual(expectedMortgagePayment(320_000_000, { interest_rate: 3.9, monthly_payment: null }, '2026-03'), { interest: Math.round(320_000_000 * 0.039 * 28 / 365), principal: null })
})

test('달 일수·윤년과 일수 기준 이자', () => {
  assert.deepEqual(['2026-01', '2026-02', '2028-02', '2026-04'].map(daysInMonth), [31, 28, 29, 30])
  assert.deepEqual(['2026-01', '2026-03', '2028-03', '2026-11'].map(interestDays), [31, 28, 29, 31], '이자 기간은 전달 일수')
  assert.equal(dailyInterest(365_000_000, 3.65, '2026-01'), 1_131_500)
})

test('이자가 달 일수에 따라 달라져 원금+이자(납부액)도 달라진다', () => {
  const jan = amortizeMonth(300_000_000, 4, 1_700_000, '2026-02') // 1월 일수 31
  const feb = amortizeMonth(300_000_000, 4, 1_700_000, '2026-03') // 2월 일수 28
  assert.equal(jan.principal, feb.principal)
  assert.ok(jan.interest > feb.interest)
  assert.equal(jan.interest + jan.principal - (feb.interest + feb.principal), jan.interest - feb.interest)
})

test('시뮬레이터는 startMonth이 있으면 일수 이자로 총이자를 계산한다', () => {
  const plain = simulateMortgage({ balance: 100_000_000, annualRate: 4, monthlyPayment: 1_000_000 })
  const daily = simulateMortgage({ balance: 100_000_000, annualRate: 4, monthlyPayment: 1_000_000, startMonth: '2026-01' })
  assert.equal(plain.months, daily.months)
  assert.ok(Math.abs(plain.totalInterest! - daily.totalInterest!) < plain.totalInterest! * 0.01)
})

import { buildRepaymentTable } from '../lib/calc/repayment-table.ts'

test('월별 상환 내역: 지난 달은 잔액 변화, 앞으로는 월 상환액으로 계산', () => {
  const rows = buildRepaymentTable({
    balance: 319_390_000, balanceMonth: '2026-09', annualRate: 3.9, monthlyPayment: 1_650_000,
    history: [{ month: '2026-08', amount: 320_000_000 }, { month: '2026-09', amount: 319_390_000 }],
    futureMonths: 3,
  })
  assert.deepEqual(rows.map(row => [row.month, row.kind, row.days]), [['2026-09', 'past', 31], ['2026-10', 'future', 30], ['2026-11', 'future', 31], ['2026-12', 'future', 30]])
  assert.equal(rows[0].principal, 610_000)
  assert.equal(rows[0].interest, Math.round(320_000_000 * 0.039 * 31 / 365))
  assert.ok(rows[2].principal >= rows[1].principal, '정기 원금은 잔액이 줄수록 조금 늘어난다')
  assert.ok(rows[2].interest > rows[1].interest, '이자 기간이 31일인 11월 납부분이 30일인 10월보다 많다')
  assert.equal(rows[1].total, rows[1].interest + rows[1].principal)
  assert.equal(rows[1].balanceAfter, 319_390_000 - rows[1].principal)
})

test('월별 상환 내역: 금리가 없으면 비고, 월 상환액이 없으면 지난 달만, 기록이 끊기면 건너뜀', () => {
  const history = [{ month: '2026-06', amount: 330_000_000 }, { month: '2026-09', amount: 320_000_000 }]
  assert.deepEqual(buildRepaymentTable({ balance: 320_000_000, balanceMonth: '2026-09', annualRate: null, monthlyPayment: 1, history }), [])
  assert.deepEqual(buildRepaymentTable({ balance: 320_000_000, balanceMonth: '2026-09', annualRate: 3.9, monthlyPayment: null, history }), [])
  const onlyPast = buildRepaymentTable({ balance: 320_000_000, balanceMonth: '2026-09', annualRate: 3.9, monthlyPayment: null, history: [{ month: '2026-08', amount: 321_000_000 }, { month: '2026-09', amount: 320_000_000 }] })
  assert.deepEqual(onlyPast.map(row => row.kind), ['past'])
  const paid = buildRepaymentTable({ balance: 1_000_000, balanceMonth: '2026-09', annualRate: 3.9, monthlyPayment: 1_650_000, history: [] })
  assert.deepEqual(paid.map(row => row.balanceAfter), [0], '완납하면 거기서 끝')
})

test('실제 납부 내역(11월: 원금 455,410 · 이자 2,489,382 · 기간 10/5~11/4)과 맞는다', () => {
  assert.equal(interestDays('2026-11'), 31)
  const before = 755_812_811 + 455_410
  // 연 3.876% 부근이면 31일 이자가 실제와 1,000원 안으로 맞는다. 30일로는 4.0%를 넣어도 맞지 않는다.
  assert.ok(Math.abs(dailyInterest(before, 3.876, '2026-11') - 2_489_382) < 1_000)
  assert.ok(Math.abs(before * 0.04 * 30 / 365 - 2_489_382) > 1_000)
})

test('월간 기록의 실제 이자·원금이 있으면 잔액 기록이 없어도 지난 달 행을 만든다', () => {
  const rows = buildRepaymentTable({
    balance: 755_812_811, balanceMonth: '2026-11', annualRate: 3.876, monthlyPayment: 2_944_792,
    history: [{ month: '2026-11', amount: 755_812_811 }],
    recorded: [{ month: '2026-11', interest: 2_489_382, principal: 455_410 }],
    futureMonths: 2,
  })
  assert.deepEqual(rows.map(row => [row.month, row.kind, row.recorded ?? false]), [['2026-11', 'past', true], ['2026-12', 'future', false], ['2027-01', 'future', false]])
  assert.equal(rows[0].total, 2_944_792)
  assert.equal(rows[0].days, 31)
  assert.equal(rows[0].balanceAfter, 755_812_811)
  assert.equal(rows[1].days, 30, '12월 납부분은 11월 일수')
})
