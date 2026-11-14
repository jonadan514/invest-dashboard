import type { ReactNode } from 'react'

export type StatTone = 'net' | 'asset' | 'liability' | 'positive' | 'negative' | 'neutral' | 'accent'

const VALUE_COLOR: Record<StatTone, string> = {
  net: 'text-[var(--color-positive-strong)]',
  asset: 'text-[var(--color-primary)]',
  liability: 'text-[var(--color-negative)]',
  positive: 'text-[var(--color-positive-strong)]',
  negative: 'text-[var(--color-negative)]',
  neutral: 'text-[var(--color-ink)]',
  accent: 'text-[var(--color-primary)]',
}

const ACCENT: Record<StatTone, string> = {
  net: 'var(--color-positive-bright)',
  asset: 'var(--color-primary)',
  liability: 'var(--color-negative)',
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  neutral: 'var(--color-border)',
  accent: 'var(--color-primary)',
}

/** 부호에 따라 증가는 positive, 감소는 negative, 0은 neutral. */
export function toneOf(value: number | null | undefined): StatTone {
  if (!value) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}

const COLUMNS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
} as const

/** 화면 상단 요약 숫자 띠. 모바일에서는 2열로 놓는다(3칸이면 마지막 칸에 wide를 준다). */
export function StatStrip({ columns, label, className = '', children }: { columns: keyof typeof COLUMNS; label?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={label} className={`metric-strip grid ${COLUMNS[columns]} ${className}`}>
      {children}
    </section>
  )
}

export function Stat({ label, value, detail, tone = 'neutral', wide = false }: {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: StatTone
  /** 모바일 2열에서 한 줄을 다 쓰게 한다. */
  wide?: boolean
}) {
  return (
    <article
      className={`metric-cell border-t-[3px] px-4 py-4 sm:px-5 lg:py-3.5 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}
      style={{ borderTopColor: ACCENT[tone] }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: ACCENT[tone] }} aria-hidden="true" />
        <h2 className="truncate text-xs font-extrabold tracking-[-0.015em] text-[var(--color-ink)] sm:text-sm">{label}</h2>
      </div>
      <p className={`stat-value mt-2 whitespace-nowrap text-lg font-bold tracking-[-0.035em] tabular-nums sm:text-2xl ${VALUE_COLOR[tone]}`}>{value}</p>
      {detail ? <p className="mt-1 text-[11px] font-medium leading-4 text-[var(--color-muted)]">{detail}</p> : null}
    </article>
  )
}
