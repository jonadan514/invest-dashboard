import Link from 'next/link'
import type { HouseholdGoal } from '@/lib/types'

function fmtKrw(n: number) {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000) return Math.round(n / 10_000) + '만'
  return n.toLocaleString()
}

interface Props {
  goal: HouseholdGoal | null
  current: number
  monthlySavings: number  // 이번 달 저축
  avgSavings3m: number    // 최근 3개월 평균 저축
}

export default function PolarisCard({ goal, current, monthlySavings, avgSavings3m }: Props) {
  if (!goal) {
    return (
      <div className="app-card flex items-center justify-between border-dashed p-4 mb-5">
        <div>
          <p className="text-xs font-semibold text-[var(--color-muted)]">가족 목표</p>
          <p className="mt-0.5 text-xs text-[var(--color-subtle)]">설정에서 현재 목표를 등록하면 여기에 표시됩니다</p>
        </div>
        <Link href="/settings#goals" className="ml-4 shrink-0 text-xs text-[var(--color-primary)] hover:underline">
          목표 추가 →
        </Link>
      </div>
    )
  }

  const pct = Math.min(100, goal.target > 0 ? (current / goal.target) * 100 : 0)
  const remaining = Math.max(0, goal.target - current)

  // 달성 예상 시점
  let estimatedLabel: string | null = null
  if (pct < 100 && avgSavings3m > 0) {
    const monthsToGo = Math.ceil(remaining / avgSavings3m)
    const d = new Date()
    d.setMonth(d.getMonth() + monthsToGo)
    estimatedLabel = `이 속도라면 ${d.getFullYear()}년 ${d.getMonth() + 1}월 달성`
  } else if (pct >= 100) {
    estimatedLabel = '목표 달성 완료 🎉'
  }

  const isDone = pct >= 100

  return (
    <div className={`app-card p-5 mb-5 ${
      isDone
        ? 'border-blue-200 bg-blue-50'
        : ''
    }`}>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {goal.name}
          </p>
          <p className="text-base font-bold text-[var(--color-ink)]">{goal.statement}</p>
          {goal.sub && (
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{goal.sub}</p>
          )}
        </div>
        <span className={`ml-4 shrink-0 text-sm font-bold ${isDone ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink)]'}`}>
          {pct.toFixed(0)}%
        </span>
      </div>

      {/* 진행 게이지 */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[10px] text-[var(--color-muted)]">
          <span>{fmtKrw(current)}</span>
          <span>목표 {fmtKrw(goal.target)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: isDone ? '#326ba6' : pct >= 80 ? '#5893cf' : '#3f7fc3',
            }}
          />
        </div>
      </div>

      {/* 이번 달 저축 + 달성 예상 */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {monthlySavings > 0 && (
            <span className="text-[var(--color-muted)]">
              이번 달 저축 <span className="font-semibold text-[var(--color-ink)]">{fmtKrw(monthlySavings)}</span> →
            </span>
          )}
          {estimatedLabel && (
            <span className={isDone ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-muted)]'}>
              {estimatedLabel}
            </span>
          )}
        </div>
      </div>

      {/* 다음 단계 */}
      {goal.next_hint && (
        <p className="mt-2.5 border-t border-[var(--color-border)] pt-2.5 text-[10px] text-[var(--color-subtle)]">
          다음: {goal.next_hint}
        </p>
      )}
    </div>
  )
}
