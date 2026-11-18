import Link from 'next/link'
import type { AllocationSlice } from '@/lib/calc/holdings-view'
import { signedWonShort, wonShort } from '@/lib/labels'

const tone = (value: number) => value > 0 ? 'text-[var(--color-positive)]' : value < 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-muted)]'

/** 홈의 주식 계좌 수익률 카드: 전체 수익률과 계좌별 비중·수익률. */
export default function StockReturnCard({ accounts, missing }: { accounts: AllocationSlice[]; missing: number }) {
  if (accounts.length === 0) return null
  const value = accounts.reduce((sum, row) => sum + row.value, 0)
  const cost = accounts.reduce((sum, row) => sum + row.cost, 0)
  const pnl = value - cost
  const rate = cost > 0 ? pnl / cost * 100 : null
  return (
    <section aria-label="주식 계좌 수익률" className="app-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-bold text-[var(--color-muted)]">주식 계좌 수익률</p>
          <p className={`mt-1 text-[26px] font-bold tabular-nums leading-none ${tone(pnl)}`}>{rate === null ? '—' : `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%`}</p>
          <p className="mt-1.5 text-[12.5px] tabular-nums text-[var(--color-muted)]">평가 {wonShort(value)} · 원금 {wonShort(cost)} · <span className={`font-semibold ${tone(pnl)}`}>{signedWonShort(pnl)}</span></p>
        </div>
        <Link href="/stocks" className="inline-flex min-h-8 items-center text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">주식 계좌 →</Link>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-section)]" aria-hidden="true">
        {accounts.map((row, index) => <span key={row.key} style={{ width: `${row.share}%`, background: ['#284b7a', '#4ea57f', '#c4a46b', '#78a8d6', '#a3587a'][index % 5] }} />)}
      </div>
      <ul className="mt-3 divide-y divide-[var(--color-border)]">
        {accounts.map((row, index) => (
          <li key={row.key} className="flex items-center gap-2 py-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ['#284b7a', '#4ea57f', '#c4a46b', '#78a8d6', '#a3587a'][index % 5] }} aria-hidden="true" />
            <Link href={`/stocks?account=${row.key}`} className="min-w-0 truncate font-semibold hover:text-[var(--color-primary)]">{row.label}</Link>
            <span className="ml-auto shrink-0 tabular-nums text-[var(--color-muted)]">{wonShort(row.value)} · {row.share.toFixed(0)}%</span>
            <span className={`w-14 shrink-0 text-right font-bold tabular-nums ${tone(row.pnl)}`}>{row.rate === null ? '—' : `${row.rate > 0 ? '+' : ''}${row.rate.toFixed(1)}%`}</span>
          </li>
        ))}
      </ul>
      {missing > 0 ? <p className="mt-2 text-[12px] text-[var(--color-accent)]">현재가가 없는 종목 {missing}개는 제외했어요.</p> : null}
    </section>
  )
}
