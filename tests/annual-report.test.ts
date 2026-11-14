import assert from 'node:assert/strict'
import test from 'node:test'
import { annualNetWorth, reportYears } from '../lib/calc/annual-report.ts'

const point = (month: string, netWorth: number) => ({ month, assets: netWorth, liabilities: 0, netWorth })
const trend = [point('2025-11', 90), point('2025-12', 100), point('2026-01', 110), point('2026-03', 105), point('2026-11', 150), point('2027-01', 160)]

test('전년도 마지막 기록을 기준으로 그해 순자산 변화를 계산한다', () => {
  const result = annualNetWorth(trend, '2026', '2026-11')
  assert.equal(result.start?.month, '2025-12')
  assert.equal(result.end?.month, '2026-11')
  assert.deepEqual(result.months, [
    { month: '2026-01', netWorth: 110, change: 10 },
    { month: '2026-03', netWorth: 105, change: -5 },
    { month: '2026-11', netWorth: 150, change: 45 },
  ])
  assert.equal(result.inProgress, true)
})

test('전년도 기록이 없으면 그해 첫 기록을 기준으로 하고 첫 달 변화는 비운다', () => {
  const result = annualNetWorth(trend, '2025', '2026-11')
  assert.equal(result.start?.month, '2025-11')
  assert.equal(result.end?.month, '2025-12')
  assert.equal(result.months[0].change, null)
  assert.equal(result.months[1].change, 10)
  assert.equal(result.inProgress, false)
})

test('오늘 이후 기록은 빼고, 기록이 없는 해는 빈 결과를 낸다', () => {
  const result = annualNetWorth(trend, '2027', '2026-11')
  assert.equal(result.end, null)
  assert.equal(result.start?.month, '2026-11')
  assert.deepEqual(result.months, [])
  assert.deepEqual(reportYears(trend, '2026-11'), ['2026', '2025'])
})
