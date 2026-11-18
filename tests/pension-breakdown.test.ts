import assert from 'node:assert/strict'
import test from 'node:test'
import { pensionBreakdown, projectYearEnd } from '../lib/calc/pension.ts'

test('연금저축 600만·IRP 300만을 나눠 완료 여부를 보여 준다', () => {
  assert.deepEqual(pensionBreakdown(6_000_000, 3_000_000), {
    pensionCounted: 6_000_000, pensionLimit: 6_000_000, pensionDone: true,
    irpCounted: 3_000_000, irpLimit: 3_000_000, irpDone: true, total: 9_000_000, totalDone: true, pensionOver: 0,
  })
  const half = pensionBreakdown(6_500_000, 1_000_000)
  assert.equal(half.pensionDone, true)
  assert.equal(half.pensionOver, 500_000, '600만 넘는 연금저축은 공제 안 됨')
  assert.equal(half.irpLimit, 3_000_000)
  assert.equal(half.irpDone, false)
  assert.equal(half.total, 7_000_000)
  const irpOnly = pensionBreakdown(2_000_000, 8_000_000)
  assert.equal(irpOnly.irpLimit, 7_000_000, '연금저축이 적으면 IRP로 더 채울 수 있다')
  assert.equal(irpOnly.irpCounted, 7_000_000)
  assert.equal(irpOnly.totalDone, true)
})

test('연말 예상: 기록한 달 이후 12월까지 정기 납입액을 더한다', () => {
  assert.equal(projectYearEnd(5_000_000, 500_000, '2026-10', '2026-11'), 6_000_000)
  assert.equal(projectYearEnd(5_000_000, 0, '2026-10', '2026-11'), 5_000_000)
  assert.equal(projectYearEnd(0, 500_000, null, '2026-11'), 1_000_000, '올해 기록이 없으면 이번 달부터')
  assert.equal(projectYearEnd(6_000_000, 500_000, '2026-12', '2026-12'), 6_000_000)
})
