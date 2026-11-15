import Link from 'next/link'
import type { MonthEndReminder } from '@/lib/calc/reminder'
import { formatMonth } from '@/lib/labels'

export default function MonthEndBanner({ reminder }: { reminder: MonthEndReminder | null }) {
  if (!reminder) return null
  const overdue = reminder.kind === 'overdue'
  return (
    <section
      aria-label="월말 기록 알림"
      className="app-card relative flex flex-col gap-3 overflow-hidden px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:py-3"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${overdue ? 'bg-[var(--color-negative)]' : 'bg-[var(--color-positive-bright)]'}`} aria-hidden="true" />
      <div>
        <p className={`text-[11.5px] font-bold ${overdue ? 'text-[var(--color-negative)]' : 'text-[var(--color-positive-strong)]'}`}>
          {overdue ? '지난달 기록 필요' : reminder.daysLeft === 0 ? '오늘이 말일' : `말일까지 ${reminder.daysLeft}일`}
        </p>
        <p className="mt-1 text-sm font-bold text-[var(--color-ink)]">
          {overdue ? `${formatMonth(reminder.month)} 월말 기록이 아직 끝나지 않았어요` : `${formatMonth(reminder.month)} 월말 기록할 때예요`}
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">공금, 계좌 평가금액, 연금 누적 납입액을 입력하면 이번 달 변화가 계산돼요.</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link href={`/budget?month=${reminder.month}`} className="rounded-sm bg-[var(--color-primary)] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[var(--color-primary-strong)]">
          {formatMonth(reminder.month)} 기록하기
        </Link>
        <a href="/api/calendar/month-end" download className="rounded-sm border border-[var(--color-border)] bg-white px-3 py-2 text-[12.5px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]">
          캘린더 알림 받기
        </a>
      </div>
    </section>
  )
}
