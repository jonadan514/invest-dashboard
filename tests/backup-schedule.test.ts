import assert from 'node:assert/strict'
import test from 'node:test'
import { backupFileName, backupLabel, backupsToDelete, isAuthorizedCron, isBackupFileName } from '../lib/backup-schedule.ts'

test('백업 파일 이름은 한국 시간으로 만들고 형식을 검증한다', () => {
  const name = backupFileName(new Date('2026-11-15T18:05:09Z'))
  assert.equal(name, 'backup-2026-11-16-030509.json')
  assert.equal(isBackupFileName(name), true)
  assert.equal(backupLabel(name), '2026-11-16 03:05')
  for (const bad of ['../backup-2026-11-16-030509.json', 'backup-2026-11-16.json', 'backup-2026-11-16-030509.json.exe', 'notes.txt']) {
    assert.equal(isBackupFileName(bad), false, bad)
  }
})

test('최신 백업만 남기고 오래된 것부터 지운다', () => {
  const weekly = Array.from({ length: 15 }, (_, index) => `backup-2026-01-${String(index + 1).padStart(2, '0')}-030000.json`)
  assert.deepEqual(backupsToDelete([...weekly, 'other.json'], 12), [
    'backup-2026-01-03-030000.json', 'backup-2026-01-02-030000.json', 'backup-2026-01-01-030000.json',
  ])
  assert.deepEqual(backupsToDelete(weekly.slice(0, 5), 12), [])
  // 0 이하로 설정해도 가장 최근 백업 하나는 남긴다.
  assert.equal(backupsToDelete(weekly, 0).length, 14)
})

test('크론 호출은 설정된 비밀값과 정확히 같은 Bearer 헤더만 통과시킨다', () => {
  const secret = 'a-very-long-cron-secret-value'
  assert.equal(isAuthorizedCron(`Bearer ${secret}`, secret), true)
  assert.equal(isAuthorizedCron(`Bearer ${secret}x`, secret), false)
  assert.equal(isAuthorizedCron(secret, secret), false)
  assert.equal(isAuthorizedCron(null, secret), false)
  assert.equal(isAuthorizedCron('Bearer short', 'short'), false)
  assert.equal(isAuthorizedCron('Bearer ', undefined), false)
})
