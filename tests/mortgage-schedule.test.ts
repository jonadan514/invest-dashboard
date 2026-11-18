import assert from 'node:assert/strict'
import test from 'node:test'
import { amortizeMonth, buildMortgageSchedule, expectedMortgagePayment } from '../lib/calc/mortgage-schedule.ts'

const item = { id: 'm', interest_rate: 3.9, monthly_payment: 1_650_000, inactive_from_month: null }

test('원리금균등 한 달은 이자를 먼저 떼고 남은 금액을 원금으로 갚는다', () => {
  assert.deepEqual(amortizeMonth(320_000_000, 3.9, 1_650_000), { interest: 1_040_000, principal: 610_000 })
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
  assert.equal(schedule[2].interest, Math.round(316_770_000 * 3.9 / 100 / 12))
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

test('월간 기록 자동 채우기는 직전 잔액으로 이자와 정기 원금을 계산한다', () => {
  assert.deepEqual(expectedMortgagePayment(320_000_000, item), { interest: 1_040_000, principal: 610_000 })
  assert.equal(expectedMortgagePayment(null, item), null)
  assert.equal(expectedMortgagePayment(320_000_000, { interest_rate: null, monthly_payment: 1_650_000 }), null)
})
