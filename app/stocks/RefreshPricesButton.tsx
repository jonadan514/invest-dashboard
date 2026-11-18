'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { refreshPrices } from './actions'

/** 현재가·환율 자동 불러오기 버튼. 결과(갱신 수·실패 종목)를 옆에 보여 준다. */
export default function RefreshPricesButton({ lastUpdated }: { lastUpdated: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  function run() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await refreshPrices()
        if (!result.ok) {
          setMessage({ tone: 'warn', text: result.error })
          return
        }
        const parts = [`${result.updated}종목 갱신`]
        if (result.usdKrw) parts.push(`환율 ${result.usdKrw.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`)
        if (result.skipped > 0) parts.push(`코드 없는 ${result.skipped}종목 제외`)
        const text = result.failed.length > 0 ? `${parts.join(' · ')} · 못 불러온 것: ${result.failed.join(', ')} (직접 입력해 주세요)` : parts.join(' · ')
        setMessage({ tone: result.failed.length > 0 ? 'warn' : 'ok', text })
        router.refresh()
      } catch (cause) {
        setMessage({ tone: 'warn', text: cause instanceof Error ? cause.message : '불러오지 못했습니다.' })
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" onClick={run} disabled={pending} className="min-h-9 rounded-lg bg-[var(--color-primary)] px-4 text-[13px] font-bold text-white disabled:opacity-50">
        {pending ? '불러오는 중…' : '현재가 자동 불러오기'}
      </button>
      {message ? (
        <span role="status" className={`text-[12.5px] ${message.tone === 'ok' ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{message.text}</span>
      ) : lastUpdated ? (
        <span className="text-[12.5px] text-[var(--color-muted)]">마지막 갱신 {lastUpdated} · 매일 아침 자동 갱신</span>
      ) : (
        <span className="text-[12.5px] text-[var(--color-muted)]">매일 아침 자동으로 갱신돼요</span>
      )}
    </div>
  )
}
