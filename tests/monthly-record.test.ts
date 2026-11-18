import assert from 'node:assert/strict'
import test from 'node:test'
import { accountRecordState, neighborMonths, ownerLabel, stageLabel } from '../lib/calc/monthly-record.ts'

const snap = (month: string, evaluation: number, allocation = 0, ytd = 0) => ({ account_id: 'a', month, evaluation_amount: evaluation, monthly_allocation: allocation, ytd_contribution: ytd })

test('이번 달 기록이 있으면 그 값, 지난달과 비교할 직전 기록도 준다', () => {
  const state = accountRecordState([snap('2026-10', 100, 5, 50), snap('2026-11', 120, 7, 60)], 'a', '2026-11')
  assert.deepEqual(state, { evaluationAmount: 120, monthlyAllocation: 7, ytdContribution: 60, carried: false, previous: { month: '2026-10', evaluation: 100 } })
})

test('이번 달 기록이 없으면 직전 평가금액을 불러오고 표시한다. 배분액은 0, 누적액은 같은 해일 때만', () => {
  assert.deepEqual(accountRecordState([snap('2026-10', 100, 5, 50)], 'a', '2026-11'), { evaluationAmount: 100, monthlyAllocation: 0, ytdContribution: 50, carried: true, previous: { month: '2026-10', evaluation: 100 } })
  assert.equal(accountRecordState([snap('2025-12', 100, 5, 50)], 'a', '2026-01').ytdContribution, 0, '해가 바뀌면 누적액 0')
  assert.deepEqual(accountRecordState([], 'a', '2026-11'), { evaluationAmount: 0, monthlyAllocation: 0, ytdContribution: 0, carried: false, previous: null })
  assert.equal(accountRecordState([snap('2026-12', 999)], 'a', '2026-11').evaluationAmount, 0, '뒤 달 기록은 쓰지 않는다')
})

test('이전·다음 달, 목표 문구, 소유 표시', () => {
  const months = ['2026-12', '2026-11', '2026-10']
  assert.deepEqual(neighborMonths(months, '2026-11'), { previous: '2026-10', next: '2026-12' })
  assert.deepEqual(neighborMonths(months, '2026-10'), { previous: null, next: '2026-11' })
  assert.deepEqual(neighborMonths(months, '2027-05'), { previous: null, next: null })
  assert.equal(stageLabel(30_000_000), '3,000만 달성')
  assert.equal(stageLabel(100_000_000), '1억 달성')
  assert.deepEqual(['me', 'spouse', 'household'].map(ownerLabel), ['나', '아내', '공동'])
})

test('정기 납입액이 있으면 누적 납입액에 직전 기록 이후 달 수만큼 더한다', () => {
  const pension = (month: string, ytd: number) => ({ account_id: 'p', month, evaluation_amount: 1_000_000, monthly_allocation: 0, ytd_contribution: ytd })
  const next = accountRecordState([pension('2026-10', 5_000_000)], 'p', '2026-11', 500_000)
  assert.equal(next.ytdContribution, 5_500_000)
  assert.equal(next.autoContribution, true)
  assert.equal(accountRecordState([pension('2026-09', 4_500_000)], 'p', '2026-11', 500_000).ytdContribution, 5_500_000, '두 달 비면 두 달치')
  assert.equal(accountRecordState([pension('2025-12', 6_000_000)], 'p', '2026-01', 500_000).ytdContribution, 500_000, '해가 바뀌면 이번 달치만')
  assert.equal(accountRecordState([pension('2026-11', 5_200_000)], 'p', '2026-11', 500_000).ytdContribution, 5_200_000, '이미 기록한 달은 그대로')
  assert.equal(accountRecordState([pension('2026-10', 5_000_000)], 'p', '2026-11').autoContribution, undefined)
})
