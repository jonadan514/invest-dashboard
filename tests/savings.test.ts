import assert from 'node:assert/strict'
import test from 'node:test'
import { averageSavingsRate, buildSavingsSeries } from '../lib/calc/savings.ts'

const budget = (month: string, joint: number, bonusTotal = 0, bonusToPlan = 0, principal = 450_000) =>
  ({ month, joint_savings: joint, bonus_total: bonusTotal, bonus_to_plan: bonusToPlan, mortgage_principal: principal })

test('정기 잉여금과 배분한 성과급으로 저축률을 구하고 월 순서로 정렬한다', () => {
  const series = buildSavingsSeries([budget('2026-10', 7_000_000, 3_000_000, 2_000_000), budget('2026-09', 7_000_000)], 8_000_000, 3_700_000)
  assert.deepEqual(series.map(point => point.month), ['2026-09', '2026-10'])
  const [september, october] = series
  assert.equal(september.saving, 3_300_000)
  assert.equal(september.income, 8_000_000)
  assert.equal(september.rate, 41.25)
  assert.equal(september.rateWithPrincipal, (3_300_000 + 450_000) / 8_000_000 * 100)
  assert.equal(october.saving, 5_300_000)
  assert.equal(october.income, 11_000_000)
})

test('공금이 고정비보다 적으면 잉여금은 0으로 보고 소득이 없으면 비율을 비운다', () => {
  const [point] = buildSavingsSeries([budget('2026-10', 3_000_000)], 0, 3_700_000)
  assert.equal(point.saving, 0)
  assert.equal(point.rate, null)
  assert.equal(point.rateWithPrincipal, null)
})

test('평균 저축률은 최근 기록의 소득 가중 평균이다', () => {
  const series = buildSavingsSeries([
    budget('2026-01', 9_000_000), // 창 밖
    budget('2026-10', 7_000_000, 3_000_000, 2_000_000),
    budget('2026-11', 7_000_000),
  ], 8_000_000, 3_700_000)
  const average = averageSavingsRate(series, 2)
  assert.equal(average?.months, 2)
  assert.equal(average?.rate, (5_300_000 + 3_300_000) / (11_000_000 + 8_000_000) * 100)
  assert.equal(averageSavingsRate(buildSavingsSeries([budget('2026-10', 7_000_000)], 0, 3_700_000)), null)
})
