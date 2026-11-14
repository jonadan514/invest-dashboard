import Link from 'next/link'
import { pensionRoom, yearEndSchedule } from '@/lib/calc/pension'
import { compactKrw, formatMonth, krw } from '@/lib/labels'

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
  const creditLow = rows.reduce((sum, row) => sum + row.room.extraCredit.low, 0)
  const creditHigh = rows.reduce((sum, row) => sum + row.room.extraCredit.high, 0)
  return { schedule, rows, remaining, creditLow, creditHigh }
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
export function PensionYearEndBanner({ persons, today, recordMonth }: Props) {
  const { schedule, remaining, creditLow, creditHigh } = summarize(persons, today)
  if (!schedule.isYearEndSeason || remaining <= 0) return null
  return (
    <section aria-label="연금 세액공제 연말 알림" className="app-card relative flex flex-col gap-3 overflow-hidden px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:py-3">
      <span className="absolute inset-y-0 left-0 w-1 bg-[var(--color-primary)]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
          연금 세액공제 마감 {dDay(schedule.daysLeft)}
        </p>
        <p className="mt-1 text-sm font-bold leading-snug text-[var(--color-ink)]">
          12월 31일까지 부부 합계 {compactKrw(remaining)}을 더 넣으면 세금을 약 {compactKrw(creditLow)}~{compactKrw(creditHigh)} 더 돌려받아요
        </p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
          남은 {schedule.weeksLeft}주 동안 주당 약 {compactKrw(remaining / schedule.weeksLeft)} · {staleNote(recordMonth, today)}
        </p>
      </div>
      <Link href="/pension" className="shrink-0 rounded-sm border border-[var(--color-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]">
        사람별 계획 보기 →
      </Link>
    </section>
  )
}

/** 연금 화면의 사람별 남은 한도 계획. */
export function PensionYearEndPlan({ persons, today, recordMonth }: Props) {
  const { schedule, rows, remaining, creditLow, creditHigh } = summarize(persons, today)
  const year = today.slice(0, 4)
  return (
    <section className="app-card mb-4 p-5" aria-label="올해 남은 공제 한도">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            {schedule.isYearEndSeason ? `${year}년 세액공제 마감 ${dDay(schedule.daysLeft)}` : `${year}년 남은 공제 한도`}
          </p>
          <h2 className="mt-1 text-base font-bold text-[var(--color-ink)]">
            {remaining > 0 ? `부부 합계 ${krw(remaining)} 더 넣을 수 있어요` : '올해 세액공제 한도를 모두 채웠어요'}
          </h2>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">{staleNote(recordMonth, today)}</p>
        </div>
        {remaining > 0 ? (
          <div className="rounded-lg bg-[var(--color-accent-soft)] px-3 py-2 text-right">
            <p className="text-[10px] text-[var(--color-primary)]">모두 채우면 추가 세액공제</p>
            <p className="text-sm font-bold tabular-nums text-[var(--color-primary)]">약 {compactKrw(creditLow)}~{compactKrw(creditHigh)}</p>
          </div>
        ) : null}
      </div>

      {remaining > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map(row => (
            <div key={row.label} className="rounded-lg border border-[var(--color-border)] bg-white/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--color-ink)]">{row.label}</span>
                <span className="text-sm font-bold tabular-nums text-[var(--color-ink)]">{row.room.remaining > 0 ? krw(row.room.remaining) : '한도 채움'}</span>
              </div>
              {row.room.remaining > 0 ? (
                <ul className="mt-2 space-y-1 text-[11px] leading-5 text-[var(--color-muted)]">
                  <li>
                    {row.room.pensionSavingsRoom >= row.room.remaining
                      ? '연금저축·IRP 어느 쪽에 넣어도 모두 인정돼요.'
                      : row.room.pensionSavingsRoom > 0
                        ? `연금저축은 ${compactKrw(row.room.pensionSavingsRoom)}까지만 인정돼요. 나머지 ${compactKrw(row.room.remaining - row.room.pensionSavingsRoom)}은 IRP로 넣어야 해요.`
                        : '연금저축 한도(600만)는 다 찼어요. IRP로 넣어야 인정돼요.'}
                  </li>
                  {schedule.isYearEndSeason ? <li>남은 {schedule.weeksLeft}주 동안 주당 약 <strong className="tabular-nums text-[var(--color-ink)]">{compactKrw(row.room.remaining / schedule.weeksLeft)}</strong></li> : null}
                  <li>추가 세액공제 약 {compactKrw(row.room.extraCredit.low)}~{compactKrw(row.room.extraCredit.high)}</li>
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-4 text-[var(--color-subtle)]">
        연금저축 600만 원, 연금저축+IRP 합산 900만 원 한도 기준이에요. 세액공제율은 총급여 5,500만 원 이하 16.5%, 초과 13.2%이며 실제 금액은 개인 상황에 따라 달라요.
      </p>
    </section>
  )
}
