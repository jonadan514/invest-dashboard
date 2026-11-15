import assert from 'node:assert/strict'
import test from 'node:test'
import { pensionRoom, yearEndSchedule } from '../lib/calc/pension.ts'

test('남은 공제 한도와 연금저축으로 채울 수 있는 금액을 나눈다', () => {
  assert.deepEqual(pensionRoom(4_000_000, 1_000_000), { remaining: 4_000_000, pensionSavingsRoom: 2_000_000, extraCredit: 528_000 })
  // 연금저축 600만 초과분은 공제되지 않으므로 남은 300만은 IRP로만 채울 수 있다.
  assert.deepEqual(pensionRoom(7_000_000, 0), { remaining: 3_000_000, pensionSavingsRoom: 0, extraCredit: 396_000 })
  assert.deepEqual(pensionRoom(0, 0), { remaining: 9_000_000, pensionSavingsRoom: 6_000_000, extraCredit: 1_188_000 })
  assert.deepEqual(pensionRoom(6_000_000, 3_500_000), { remaining: 0, pensionSavingsRoom: 0, extraCredit: 0 })
  assert.deepEqual(pensionRoom(1_000_000, 7_000_000), { remaining: 1_000_000, pensionSavingsRoom: 1_000_000, extraCredit: 132_000 })
})

test('연말까지 남은 날과 주를 오늘 포함으로 센다', () => {
  assert.deepEqual(yearEndSchedule('2026-11-14'), { daysLeft: 48, weeksLeft: 7, isYearEndSeason: true })
  assert.deepEqual(yearEndSchedule('2026-12-31'), { daysLeft: 1, weeksLeft: 1, isYearEndSeason: true })
  assert.deepEqual(yearEndSchedule('2026-09-30'), { daysLeft: 93, weeksLeft: 14, isYearEndSeason: false })
  assert.equal(yearEndSchedule('2028-01-01').daysLeft, 366)
})
