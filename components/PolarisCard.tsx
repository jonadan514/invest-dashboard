'use client'
import { useState, useEffect } from 'react'
import { loadGoals, getActiveGoal } from '@/lib/goals'
import Link from 'next/link'

function fmtKrw(n: number) {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000) return Math.round(n / 10_000) + '만'
  return n.toLocaleString()
}

interface Props {
  cashBalance: number     // 현재 현금 잔액 (최근 monthly_budgets)
  monthlySavings: number  // 이번 달 저축
  avgSavings3m: number    // 최근 3개월 평균 저축
}

export default function PolarisCard({ cashBalance, monthlySavings, avgSavings3m }: Props) {
  const [goal, setGoal] = useState<ReturnType<typeof getActiveGoal>>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setGoal(getActiveGoal(loadGoals()))
  }, [])

  if (!mounted) return null
  if (!goal) {
    return (
      <div className="bg-[#faf6ec] border border-dashed border-[#c8bea8] rounded-2xl p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-[#9c9484]">🧭 북극성 목표</p>
          <p className="text-xs text-[#b5aa98] mt-0.5">설정에서 현재 목표를 등록하면 여기에 표시됩니다</p>
        </div>
        <Link href="/settings#goals" className="text-xs text-[#1c6b4a] hover:underline shrink-0 ml-4">
          목표 추가 →
        </Link>
      </div>
    )
  }

  const current = goal.type === 'cash' ? cashBalance : 0
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
    <div className={`rounded-2xl p-5 mb-5 border ${
      isDone
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-[#faf6ec] border-[#e3d9c4]'
    }`}>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] text-[#9c9484] font-medium tracking-wider uppercase mb-1">
            🧭 {goal.name}
          </p>
          <p className="text-base font-bold text-[#34322b]">{goal.statement}</p>
          {goal.sub && (
            <p className="text-xs text-[#9c9484] mt-0.5">{goal.sub}</p>
          )}
        </div>
        <span className={`text-sm font-bold ml-4 shrink-0 ${isDone ? 'text-[#1c6b4a]' : 'text-[#34322b]'}`}>
          {pct.toFixed(0)}%
        </span>
      </div>

      {/* 진행 게이지 */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-[#9c9484] mb-1">
          <span>{fmtKrw(current)}</span>
          <span>목표 {fmtKrw(goal.target)}</span>
        </div>
        <div className="h-2 bg-[#e3d9c4] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: isDone ? '#1c6b4a' : pct >= 80 ? '#3d9970' : '#1c6b4a',
            }}
          />
        </div>
      </div>

      {/* 이번 달 저축 + 달성 예상 */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {monthlySavings > 0 && (
            <span className="text-[#9c9484]">
              이번 달 저축 <span className="font-semibold text-[#34322b]">{fmtKrw(monthlySavings)}</span> →
            </span>
          )}
          {estimatedLabel && (
            <span className={isDone ? 'text-[#1c6b4a] font-semibold' : 'text-[#9c9484]'}>
              {estimatedLabel}
            </span>
          )}
        </div>
      </div>

      {/* 다음 단계 */}
      {goal.next_hint && (
        <p className="text-[10px] text-[#b5aa98] mt-2.5 pt-2.5 border-t border-[#e3d9c4]">
          다음: {goal.next_hint}
        </p>
      )}
    </div>
  )
}
