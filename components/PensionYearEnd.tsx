import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { pensionRoom, yearEndSchedule } from '@/lib/calc/pension'
import { compactKrw, formatMonth } from '@/lib/labels'

export interface PensionPerson {
  label: string
  pension: number
  irp: number
}

interface Props {
  persons: PensionPerson[]
  /** 한국 날짜 YYYY-MM-DD */
  today: string
  /** 올해 누적 납입액을 마지막으로 기록한 달. 없으면 null. */
  recordMonth: string | null
}

function summarize(persons: PensionPerson[], today: string) {
  const schedule = yearEndSchedule(today)
  const rows = persons.map(person => ({ ...person, room: pensionRoom(person.pension, person.irp) }))
  const remaining = rows.reduce((sum, row) => sum + row.room.remaining, 0)
  const credit = rows.reduce((sum, row) => sum + row.room.extraCredit, 0)
  return { schedule, rows, remaining, credit }
}

function dDay(daysLeft: number) {
  return daysLeft <= 1 ? 'D-Day' : `D-${daysLeft - 1}`
}

function staleNote(recordMonth: string | null, today: string) {
  const currentMonth = today.slice(0, 7)
  if (!recordMonth) return `${today.slice(0, 4)}년 누적 납입 기록이 아직 없어요.`
  if (recordMonth < currentMonth) return `${formatMonth(recordMonth)} 기록 기준이에요. 이번 달 납입분을 기록하면 더 정확해져요.`
  return `${formatMonth(recordMonth)} 기록 기준`
}

/** 홈 상단 알림 띠. 10~12월에 남은 한도가 있을 때만 보인다. */
export function PensionYearEndBanner({ persons, today, recordMonth, embedded = false }: Props & { embedded?: boolean }) {
  const { schedule, remaining, credit } = summarize(persons, today)
  if (!schedule.isYearEndSeason || remaining <= 0) return null
  if (embedded) {
    return (
      <Link href="/pension" className="flex min-h-11 items-center gap-2 px-4 py-2 text-[13px] hover:bg-[var(--color-section)]">
        <span className="shrink-0 rounded bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[11.5px] font-bold text-[var(--color-primary)]">세액공제 마감 {dDay(schedule.daysLeft)}</span>
        <span className="min-w-0 truncate"><span className="font-semibold text-[var(--color-ink)]">부부 합계 {compactKrw(remaining)} 더 넣으면 약 {compactKrw(credit)} 환급</span><span className="hidden text-[var(--color-muted)] sm:inline"> · {staleNote(recordMonth, today)}</span></span>
        <ChevronRight size={14} aria-hidden="true" className="ml-auto shrink-0 text-[var(--color-subtle)]" />
      </Link>
    )
  }
  return (
    <section aria-label="연금 세액공제 연말 알림" className={`${embedded ? '' : 'app-card '}relative flex flex-col gap-3 overflow-hidden px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:py-3`}>
      <span className="absolute inset-y-0 left-0 w-1 bg-[var(--color-primary)]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold text-[var(--color-primary)]">
          연금 세액공제 마감 {dDay(schedule.daysLeft)}
        </p>
        <p className="mt-1 text-sm font-bold leading-snug text-[var(--color-ink)]">
          12월 31일까지 부부 합계 {compactKrw(remaining)}을 더 넣으면 세금을 약 {compactKrw(credit)} 더 돌려받아요
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
          {staleNote(recordMonth, today)}
        </p>
      </div>
      <Link href="/pension" className="shrink-0 rounded-sm border border-[var(--color-border)] bg-white px-3 py-2 text-[12.5px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]">
        사람별 계획 보기 →
      </Link>
    </section>
  )
}

/** 연금 화면 맨 위 한 줄 요약: 마감까지 부부 합계로 더 넣을 수 있는 금액. 사람별 안내는 사람별 카드에 있다. */
export function PensionYearEndPlan({ persons, today, recordMonth }: Props) {
  const { schedule, remaining, credit } = summarize(persons, today)
  const year = today.slice(0, 4)
  return (
    <section className="app-card mb-4 flex flex-col justify-between gap-2 px-5 py-4 sm:flex-row sm:items-center" aria-label="올해 남은 공제 한도">
      <div>
        <p className="text-[11.5px] font-bold text-[var(--color-primary)]">
          {schedule.isYearEndSeason ? `${year}년 세액공제 마감 ${dDay(schedule.daysLeft)}` : `${year}년 남은 공제 한도`}
        </p>
        <h2 className="mt-0.5 text-base font-bold text-[var(--color-ink)]">
          {remaining > 0 ? `부부 합계 ${compactKrw(remaining)} 더 넣을 수 있어요` : '올해 세액공제 한도를 모두 채웠어요'}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{staleNote(recordMonth, today)}</p>
      </div>
      {remaining > 0 ? (
        <p className="shrink-0 rounded-lg bg-[var(--color-accent-soft)] px-3 py-2 text-[12.5px] text-[var(--color-primary)]">모두 채우면 추가 세액공제 <strong className="tabular-nums">약 {compactKrw(credit)}</strong></p>
      ) : null}
    </section>
  )
}
