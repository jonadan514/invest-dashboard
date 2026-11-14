import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMonthEndCalendar, monthEndReminder } from '../lib/calc/reminder.ts'

test('25일부터 이번 달 기록이 끝나지 않았으면 남은 날과 함께 알린다', () => {
  assert.deepEqual(monthEndReminder('2026-11-25', () => false), { kind: 'record-now', month: '2026-11', daysLeft: 5 })
  assert.deepEqual(monthEndReminder('2026-02-28', () => false), { kind: 'record-now', month: '2026-02', daysLeft: 0 })
  assert.equal(monthEndReminder('2026-11-25', () => true), null)
  assert.equal(monthEndReminder('2026-11-24', () => false), null)
})

test('월초 7일까지는 지난달 기록이 비어 있으면 알린다', () => {
  assert.deepEqual(monthEndReminder('2027-01-03', month => month !== '2026-12'), { kind: 'overdue', month: '2026-12' })
  assert.equal(monthEndReminder('2027-01-03', () => true), null)
  assert.equal(monthEndReminder('2027-01-08', () => false), null)
})

test('캘린더 파일은 매달 말일 한국 시간 20시 반복 일정과 두 개의 알림을 담는다', () => {
  const ics = buildMonthEndCalendar('https://example.app', '2026-11-14', new Date('2026-11-14T00:00:00Z'))
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /DTSTART:20261130T110000Z\r\n/)
  assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=-1\r\n/)
  assert.match(ics, /URL:https:\/\/example.app\/budget\r\n/)
  assert.equal(ics.match(/BEGIN:VALARM/g)?.length, 2)
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.match(buildMonthEndCalendar('https://example.app', '2028-02-03'), /DTSTART:20280229T110000Z/)
})
