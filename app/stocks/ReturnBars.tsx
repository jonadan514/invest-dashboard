import { signedWonShort } from '@/lib/labels'

export interface ReturnBar { key: string; label: string; rate: number | null; pnl: number; detail: string }

/** 0%를 가운데 두고 이익은 오른쪽(초록), 손실은 왼쪽(빨강)으로 뻗는 수익률 막대. */
export default function ReturnBars({ rows }: { rows: ReturnBar[] }) {
  const peak = Math.max(...rows.map(row => Math.abs(row.rate ?? 0)), 1)
  return (
    <ul className="space-y-3">
      {rows.map(row => {
        const rate = row.rate ?? 0
        const width = Math.min(Math.abs(rate) / peak * 50, 50)
        const gain = rate >= 0
        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-semibold">{row.label} <span className="font-normal text-[var(--color-muted)]">{row.detail}</span></span>
              <span className={`shrink-0 font-bold tabular-nums ${gain ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                {row.rate === null ? '—' : `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%`} <span className="text-[12px] font-medium">{signedWonShort(row.pnl)}</span>
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-[var(--color-section)]" role="img" aria-label={`${row.label} 수익률 ${rate.toFixed(1)}%`}>
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-border-strong)]" aria-hidden="true" />
              <span className={`absolute inset-y-0 rounded-full ${gain ? 'bg-[var(--color-positive-bright)]' : 'bg-[var(--color-negative)]'}`} style={gain ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
