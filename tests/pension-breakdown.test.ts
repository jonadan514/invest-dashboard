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

import { regularYtd } from '../lib/calc/pension.ts'

test('정기 납입 누적: 시작 달부터 그 달까지, 시작이 작년이면 1월부터', () => {
  assert.equal(regularYtd('2026-11', '2026-03', 500_000), 4_500_000, '3~11월 9회')
  assert.equal(regularYtd('2026-02', '2025-06', 500_000), 1_000_000, '해가 바뀌면 1월부터')
  assert.equal(regularYtd('2026-02', '2026-03', 500_000), 0, '시작 전')
  assert.equal(regularYtd('2026-11', '2026-03', 0), 0)
})

test('연말 예상에 시작 달 반영: 올해 기록이 없으면 시작 달부터, 시작 전 달은 세지 않음', () => {
  assert.equal(projectYearEnd(0, 500_000, null, '2026-11', '2026-03'), 5_000_000, '3~12월 10회')
  assert.equal(projectYearEnd(4_000_000, 500_000, '2026-10', '2026-11', '2026-03'), 5_000_000, '11·12월 2회')
  assert.equal(projectYearEnd(0, 500_000, '2026-05', '2026-11', '2026-09'), 2_000_000, '9~12월 4회')
  assert.equal(projectYearEnd(0, 500_000, null, '2026-11', '2027-01'), 0, '내년 시작')
})
