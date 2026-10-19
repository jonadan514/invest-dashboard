import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBackupOperations } from '../lib/backup-restore.ts'

test('전체 백업 JSON을 복원할 때 거래 메모, 금액과 통화를 손실 없이 전달한다', () => {
  const transaction = { id: 'tx', user_id: 'source', date: '2026-10-19', account_id: 'a', asset_id: null,
    type: 'deposit', quantity: null, price: null, amount: 12345, fee: 0, tax: 0, fx_rate: 1,
    currency: 'KRW', memo: '입금 메모: 가족 저축\n둘째 줄 "보존"', created_at: '2026-10-19T00:00:00Z' }
  // The export endpoint serializes select('*') rows into this v1 JSON envelope.
  const exported = JSON.stringify({ format: 'invest-dashboard-backup', version: 1, tables: { transactions: [transaction] } })
  const restored = buildBackupOperations(JSON.parse(exported).tables, 'destination')
  assert.deepEqual(restored, [{ table: 'transactions', rows: [{ ...transaction, user_id: 'destination' }] }])
})

test('빈 메모와 null 메모를 구분하고 구형 백업의 없는 메모를 추가하지 않는다', () => {
  const [operation] = buildBackupOperations({ transactions: [{ id: '1', memo: '' }, { id: '2', memo: null }, { id: '3' }] }, 'owner')
  assert.equal(operation.rows[0].memo, '')
  assert.equal(operation.rows[1].memo, null)
  assert.equal(Object.hasOwn(operation.rows[2], 'memo'), false)
})

test('계좌 비활성화 월과 재활성화 이력을 복원하고 알 수 없는 열은 제외한다', () => {
  const activity_history = [{ month: '2026-01', active: false }, { month: '2026-03', active: true }]
  const [operation] = buildBackupOperations({ accounts: [{ id: 'a', inactive_from_month: null,
    activity_history, user_id: 'other', unknown: 'drop' }] }, 'owner')
  assert.deepEqual(operation.rows[0], { id: 'a', inactive_from_month: null, activity_history, user_id: 'owner' })
})

test('기존 순자산 source 기본값과 입력 행/크기 검증을 유지한다', () => {
  assert.equal(buildBackupOperations({ net_worth_snapshots: [{ id: 'n', amount: 0 }] }, 'owner')[0].rows[0].source, 'manual')
  assert.throws(() => buildBackupOperations({ transactions: [null] }, 'owner'), /기록 형식/)
  assert.throws(() => buildBackupOperations({ transactions: Array.from({ length: 10001 }, () => ({})) }, 'owner'), /기록이 너무 많습니다/)
})

test('구형 백업의 활성 계좌는 SQL NOT NULL 기본값을 명시적으로 복원한다', () => {
  for (const activity of [{}, { activity_history: null, inactive_from_month: null }]) {
    const [operation] = buildBackupOperations({ accounts: [{ id: 'old', is_active: true, ...activity }] }, 'owner')
    assert.deepEqual(operation.rows[0], { user_id: 'owner', id: 'old', is_active: true,
      inactive_from_month: null, activity_history: [] })
  }
})

test('구형 비활성 계좌는 서울 복원 월부터 비활성화하여 과거 기록을 보존한다', () => {
  for (const activity of [{}, { activity_history: null, inactive_from_month: null }]) {
    const [operation] = buildBackupOperations({ accounts: [{ id: 'old', is_active: false, ...activity }] },
      'owner', new Date('2026-09-30T16:00:00Z'))
    assert.deepEqual(operation.rows[0], { user_id: 'owner', id: 'old', is_active: false,
      inactive_from_month: '2026-10', activity_history: [{ month: '2026-10', active: false }] })
  }
})

test('기존 비활성화 월과 유효한 이력은 복원 월로 덮어쓰지 않는다', () => {
  const [operation] = buildBackupOperations({ accounts: [
    { id: 'dated', is_active: false, inactive_from_month: '2026-02' },
    { id: 'history', is_active: false, activity_history: [{ month: '2026-01', active: false }, { month: '2026-02', active: true }, { month: '2026-03', active: false }] },
  ] }, 'owner', new Date('2026-10-19T00:00:00Z'))
  assert.deepEqual(operation.rows[0].activity_history, [{ month: '2026-02', active: false }])
  assert.equal(operation.rows[1].inactive_from_month, '2026-03')
  assert.deepEqual(operation.rows[1].activity_history, [{ month: '2026-01', active: false }, { month: '2026-02', active: true }, { month: '2026-03', active: false }])
})

test('잘못된 활성화 월 또는 boolean이 아닌 이력을 거부한다', () => {
  for (const activity_history of [{}, [null], [{ month: '2026-13', active: false }], [{ month: '2026-01', active: 'false' }]]) {
    assert.throws(() => buildBackupOperations({ accounts: [{ activity_history }] }, 'owner'), /활성화 이력/)
  }
  assert.throws(() => buildBackupOperations({ accounts: [{ inactive_from_month: '2026-00' }] }, 'owner'), /비활성화 월/)
})
