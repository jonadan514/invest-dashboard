import Link from 'next/link'
import type { GoalProgress } from '@/lib/calc/home-insights'
import { compactKrw, formatMonth, krw, signedCompactKrw } from '@/lib/labels'
import type { HouseholdGoal } from '@/lib/types'

interface Props {
  goal: HouseholdGoal | null
  progress: GoalProgress | null
  /** 현재 금액을 어디서 집계했는지. 자동 집계하지 않는 목표는 null. */
  basis: string | null
}

export default function GoalCard({ goal, progress, basis }: Props) {
  if (!goal) {
    return (
      <article className="app-card flex flex-col justify-center border-dashed p-5 lg:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">Family goal</p>
        <h2 className="mt-1 text-sm font-bold text-[var(--color-ink)]">가족 목표를 정해 보세요</h2>
        <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">
          순자산, 투자, 비상금 목표를 등록하면 진행률과 지금 속도로 언제 달성할지 보여 드려요.
        </p>
        <Link href="/settings#goals" className="mt-4 w-fit rounded-sm border border-[var(--color-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]">
          목표 추가 →
        </Link>
      </article>
    )
  }

  return (
    <article className="app-card flex flex-col p-5 lg:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">가족 목표 · {goal.name}</p>
          <h2 className="mt-1 text-sm font-bold leading-snug text-[var(--color-ink)]">{goal.statement}</h2>
        </div>
        {progress ? <strong className="shrink-0 text-lg tabular-nums text-[var(--color-ink)]">{Math.floor(progress.percent)}%</strong> : null}
      </div>

      {progress ? (
        <>
          <div className="mt-4 flex items-end justify-between gap-3 lg:mt-3">
            <strong className="text-base tracking-[-0.025em] tabular-nums text-[var(--color-ink)]">{krw(progress.current)}</strong>
            <span className="text-[10px] text-[var(--color-subtle)]">목표 {krw(progress.target)}</span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--color-border)]/75" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress.percent)} aria-label={`${goal.name} 진행률`}>
            <div className="h-full rounded-full bg-[var(--color-positive-bright)]" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] text-[var(--color-subtle)]">{basis}</p>
          <div className="mt-3 rounded-lg bg-[var(--color-canvas)]/75 px-3 py-2.5 text-[11px] leading-5">
            <GoalOutlook progress={progress} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 text-base font-bold tabular-nums text-[var(--color-ink)]">목표 {krw(Number(goal.target))}</p>
          <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">기타 목표는 기록에서 자동으로 집계하지 않아요. 이루면 설정에서 달성 처리해 주세요.</p>
        </>
      )}

      <div className="mt-auto pt-3 text-right">
        <Link href="/settings#goals" className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline">
          {progress?.achieved ? '설정에서 달성 처리하기' : '목표 관리'} →
        </Link>
      </div>
    </article>
  )
}

function GoalOutlook({ progress }: { progress: GoalProgress }) {
  if (progress.achieved) {
    return <p className="font-semibold text-[var(--color-positive-strong)]">목표 금액에 도달했어요. 달성 처리하면 다음 목표가 표시돼요.</p>
  }
  const remaining = <span className="text-[var(--color-muted)]">남은 금액 <strong className="tabular-nums text-[var(--color-ink)]">{compactKrw(progress.remaining)}</strong></span>
  if (progress.monthlyPace === null) {
    return <p>{remaining}<br /><span className="text-[var(--color-subtle)]">두 달 이상 기록하면 달성 예상 시점을 알려 드려요.</span></p>
  }
  const pace = (
    <span className="text-[var(--color-muted)]">
      최근 {progress.paceMonths}개월 월평균{' '}
      <strong className={`tabular-nums ${progress.monthlyPace > 0 ? 'text-[var(--color-positive-strong)]' : 'text-[var(--color-negative)]'}`}>
        {signedCompactKrw(progress.monthlyPace)}
      </strong>
    </span>
  )
  if (progress.etaMonth) {
    return (
      <p>
        {pace} · {remaining}
        <br />
        <span className="font-semibold text-[var(--color-ink)]">이 속도면 {formatMonth(progress.etaMonth)} 달성 예상</span>
      </p>
    )
  }
  return (
    <p>
      {pace} · {remaining}
      <br />
      <span className="text-[var(--color-subtle)]">{progress.monthlyPace > 0 ? '지금 속도로는 50년 넘게 걸려요.' : '최근에는 목표에서 멀어지고 있어요.'}</span>
    </p>
  )
}
