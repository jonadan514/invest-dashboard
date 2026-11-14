import { addMonths } from './home-insights.ts'

export type MonthEndReminder =
  | { kind: 'record-now'; month: string; daysLeft: number }
  | { kind: 'overdue'; month: string }

/**
 * 월말 기록 알림. today는 한국 날짜 YYYY-MM-DD.
 * 25일부터 말일까지는 이번 달 기록이 끝나지 않았을 때, 1~7일에는 지난달 기록이 비어 있을 때 알린다.
 */
export function monthEndReminder(today: string, isMonthComplete: (month: string) => boolean): MonthEndReminder | null {
  const [year, month, day] = today.split('-').map(Number)
  const currentMonth = today.slice(0, 7)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day >= 25 && !isMonthComplete(currentMonth)) {
    return { kind: 'record-now', month: currentMonth, daysLeft: lastDay - day }
  }
  const previousMonth = addMonths(currentMonth, -1)
  if (day <= 7 && !isMonthComplete(previousMonth)) {
    return { kind: 'overdue', month: previousMonth }
  }
  return null
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** 매달 말일 20:00(한국 시간)에 반복되는 월말 기록 일정. 하루 전과 당일에 알림을 건다. */
export function buildMonthEndCalendar(appUrl: string, today: string, now = new Date()) {
  const [year, month] = today.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // 20:00 KST = 11:00 UTC, 같은 날짜라 BYMONTHDAY=-1이 그대로 맞는다.
  const start = new Date(Date.UTC(year, month - 1, lastDay, 11, 0, 0))
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//saemhunho//household-dashboard//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:month-end-record@saemhunho-household-dashboard',
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1',
    'SUMMARY:샘훈호 월말 자산 기록',
    'DESCRIPTION:공금·계좌 평가금액·연금 누적 납입액을 기록하고 밸런스 시트를 확인하세요.',
    `URL:${appUrl}/budget`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:내일은 월말 자산 기록하는 날이에요',
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:오늘 월말 자산을 기록해 주세요',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}
