'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePrices } from './actions'

export interface PriceRowInput {
  asset_id: string
  name: string
  symbol: string | null
  currency: string
  quantity: number
  price: number | null
  as_of: string | null
}

export default function PriceForm({ rows, usdKrw, usdAsOf }: { rows: PriceRowInput[]; usdKrw: number | null; usdAsOf: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const hasUsd = rows.some(row => row.currency === 'USD')

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    const data = new FormData(event.currentTarget)
    startTransition(async () => {
      try {
        const result = await savePrices(data)
        if (!result.ok) {
          setMessage(result.error)
          return
        }
        setMessage(`${result.saved}개 값을 저장했습니다.`)
        router.refresh()
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      }
    })
  }

  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-[var(--color-muted)]">보유 중인 종목이 없어요. 거래 기록에서 매수를 먼저 추가해 주세요.</p>
  }

  return (
    <form onSubmit={submit}>
      {hasUsd ? (
        <label className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--color-section)] px-4 py-3">
          <span className="text-[13px] font-semibold">원/달러 환율</span>
          <input name="usd_krw" inputMode="decimal" defaultValue={usdKrw ?? ''} placeholder="예: 1,390" className="min-h-10 w-36 rounded-lg border border-[var(--color-border)] bg-white px-3 text-right text-sm tabular-nums" />
          <span className="text-[12.5px] text-[var(--color-muted)]">{usdAsOf ? `${formatDate(usdAsOf)} 입력` : '아직 입력 전'}</span>
        </label>
      ) : null}
      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map(row => (
          <li key={row.asset_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.name}{row.symbol ? <span className="ml-1.5 text-[12.5px] font-normal text-[var(--color-subtle)]">{row.symbol}</span> : null}</p>
              <p className="text-[12.5px] text-[var(--color-muted)]">보유 {row.quantity.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주 · {row.as_of ? `${formatDate(row.as_of)} 입력` : '현재가 미입력'}</p>
            </div>
            <label className="flex items-center gap-2">
              <span className="sr-only">{row.name} 현재가</span>
              <input name={`price_${row.asset_id}`} inputMode="decimal" defaultValue={row.price ?? ''} placeholder="현재가" className="min-h-10 w-36 rounded-lg border border-[var(--color-border)] bg-white px-3 text-right text-sm tabular-nums" />
              <span className="w-6 text-[12.5px] text-[var(--color-muted)]">{row.currency === 'USD' ? '$' : '원'}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-end gap-3">
        {message ? <span role="status" className="text-[12.5px] text-[var(--color-muted)]">{message}</span> : null}
        <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-[var(--color-primary)] px-5 text-[13px] font-bold text-white disabled:opacity-50">{pending ? '저장 중…' : '현재가 저장'}</button>
      </div>
    </form>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(value))
}
