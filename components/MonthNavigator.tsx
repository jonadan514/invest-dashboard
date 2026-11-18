'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { neighborMonths } from '@/lib/calc/monthly-record'

const NAV_BUTTON = 'grid size-10 place-items-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-muted)] shadow-sm transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-90 active:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-40'

/**
 * 이전·다음 달 버튼과 달 선택. 새 달을 불러오는 동안 버튼을 잠그고 '불러오는 중'을 보여 준다.
 * onPendingChange로 부모가 아래 내용을 흐리게 할 수 있다.
 */
export default function MonthNavigator({ month, months, recorded = [], onPendingChange, label = '기록 월 선택' }: {
  month: string
  months: string[]
  /** 기록이 있는 달. 목록에 ✓를 붙인다. */
  recorded?: string[]
  onPendingChange?: (pending: boolean) => void
  label?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [navigating, startNavigation] = useTransition()
  const [target, setTarget] = useState(month)
  const neighbors = neighborMonths(months, month)
  const recordedSet = new Set(recorded)

  useEffect(() => { onPendingChange?.(navigating) }, [navigating, onPendingChange])

  function go(next: string) {
    if (navigating || next === month) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', next)
    setTarget(next)
    startNavigation(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={!neighbors.previous || navigating} onClick={() => neighbors.previous && go(neighbors.previous)} aria-label="이전 달" className={NAV_BUTTON}><ChevronLeft size={18} /></button>
      <select value={navigating ? target : month} disabled={navigating} onChange={event => go(event.target.value)} aria-label={label} className="min-h-10 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-bold text-[var(--color-ink)] shadow-sm outline-none disabled:opacity-60">
        {months.map(value => {
          const [year, monthNumber] = value.split('-')
          return <option key={value} value={value}>{year}년 {Number(monthNumber)}월{recordedSet.has(value) ? ' ✓' : ''}</option>
        })}
      </select>
      <button type="button" disabled={!neighbors.next || navigating} onClick={() => neighbors.next && go(neighbors.next)} aria-label="다음 달" className={NAV_BUTTON}><ChevronRight size={18} /></button>
      {navigating ? (
        <span role="status" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-primary)]">
          <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          {Number(target.slice(5))}월 불러오는 중…
        </span>
      ) : null}
    </div>
  )
}
