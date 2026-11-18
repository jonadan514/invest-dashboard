import Link from 'next/link'
import type { GoalProgress } from '@/lib/calc/home-insights'
import { formatMonth, krw, signedWonShort, wonShort } from '@/lib/labels'
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
      <article className="app-card flex flex-col justify-center border-dashed p-5">
        <h2 className="text-[15px] font-bold text-[var(--color-ink)]">가족 목표를 정해 보세요</h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-muted)]">
          순자산, 투자, 비상금 목표를 등록하면 진행률과 지금 속도로 언제 달성할지 보여 드려요.
        </p>
        <Link href="/settings#goals" className="mt-4 w-fit rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]">
          목표 추가 →
        </Link>
      </article>
    )
  }

  return (
    <article className="app-card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[var(--color-ink)]">가족 목표</h2>
        <span className="truncate text-[12.5px] text-[var(--color-muted)]">{goal.name}</span>
      </div>
      <p className="mt-1 text-[13px] text-[var(--color-muted)]">{goal.statement}</p>

      {progress ? (
        <>
          <div className="mt-4 flex items-center gap-5">
            <Ring percent={progress.percent} />
            <div className="min-w-0 text-[13px] leading-6">
              <Outlook progress={progress} />
            </div>
          </div>
          <p className="mt-4 text-[12.5px] tabular-nums text-[var(--color-muted)]" title={`${krw(progress.current)} / ${krw(progress.target)}`}>
            {wonShort(progress.current)} / {wonShort(progress.target)} · {basis}
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-[22px] font-extrabold tabular-nums text-[var(--color-ink)]">목표 {wonShort(Number(goal.target))}</p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--color-muted)]">기타 목표는 기록에서 자동으로 집계하지 않아요. 이루면 설정에서 달성 처리해 주세요.</p>
        </>
      )}

      <div className="mt-auto pt-3 text-right">
        <Link href="/settings#goals" className="inline-flex min-h-8 items-center text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">
          {progress?.achieved ? '설정에서 달성 처리하기' : '목표 관리'} →
        </Link>
      </div>
    </article>
  )
}

function Ring({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(percent, 100))
  return (
    <div
      className="grid h-[104px] w-[104px] shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--color-primary) 0 ${value}%, var(--color-section) ${value}% 100%)` }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(value)}
      aria-label="목표 진행률"
    >
      <div className="grid h-[80px] w-[80px] place-items-center rounded-full bg-[var(--color-surface-strong)] text-center">
        <div>
          <p className="text-[22px] font-extrabold leading-none tabular-nums text-[var(--color-ink)]">{Math.floor(value)}%</p>
          <p className="mt-1 text-[11.5px] text-[var(--color-subtle)]">달성</p>
        </div>
      </div>
    </div>
  )
}

function Outlook({ progress }: { progress: GoalProgress }) {
  if (progress.achieved) {
    return <p className="font-semibold text-[var(--color-positive)]">목표 금액에 도달했어요!<br /><span className="font-normal text-[var(--color-muted)]">달성 처리하면 다음 목표가 보여요.</span></p>
  }
  const remaining = <span className="text-[var(--color-muted)]">남은 금액 {wonShort(progress.remaining)}</span>
  if (progress.monthlyPace === null) {
    return <p>{remaining}<br /><span className="text-[var(--color-subtle)]">두 달 이상 기록하면 달성 시점을 알려 드려요.</span></p>
  }
  if (progress.etaMonth) {
    return (
      <p>
        <span className="text-[var(--color-muted)]">이 속도면</span><br />
        <span className="text-[20px] font-extrabold tracking-[-0.03em] text-[var(--color-ink)]">{formatMonth(progress.etaMonth)}</span><br />
        <span className="text-[var(--color-muted)]">월평균 <span className="tabular-nums text-[var(--color-positive)]">{signedWonShort(progress.monthlyPace)}</span></span>
      </p>
    )
  }
  return (
    <p>
      {remaining}<br />
      <span className="text-[var(--color-subtle)]">
        {progress.monthlyPace > 0 ? '지금 속도로는 50년 넘게 걸려요.' : `최근 ${progress.paceMonths}개월 월평균 ${signedWonShort(progress.monthlyPace)}로 멀어지고 있어요.`}
      </span>
    </p>
  )
}
