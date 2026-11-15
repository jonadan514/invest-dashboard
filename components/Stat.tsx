import type { ReactNode } from 'react'

export type StatTone = 'net' | 'asset' | 'liability' | 'positive' | 'negative' | 'neutral' | 'accent'

const VALUE_COLOR: Record<StatTone, string> = {
  net: 'text-[var(--color-ink)]',
  asset: 'text-[var(--color-ink)]',
  liability: 'text-[var(--color-ink)]',
  positive: 'text-[var(--color-positive)]',
  negative: 'text-[var(--color-negative)]',
  neutral: 'text-[var(--color-ink)]',
  accent: 'text-[var(--color-primary)]',
}

const DOT: Partial<Record<StatTone, string>> = {
  net: 'var(--color-positive-bright)',
  asset: 'var(--color-primary)',
  liability: 'var(--color-negative)',
  accent: 'var(--color-gold)',
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

/** 화면 상단 요약 숫자 카드 묶음. 모바일에서는 2열로 놓는다(3칸이면 마지막 칸에 wide를 준다). */
export function StatStrip({ columns, label, className = '', children }: { columns: keyof typeof COLUMNS; label?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={label} className={`metric-strip grid ${COLUMNS[columns]} ${className}`}>
      {children}
    </section>
  )
}

export function Stat({ label, value, detail, tone = 'neutral', wide = false, exact }: {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: StatTone
  /** 모바일 2열에서 한 줄을 다 쓰게 한다. */
  wide?: boolean
  /** 줄여 쓴 금액의 정확한 값. 마우스를 올리면 보인다. */
  exact?: string
}) {
  const dot = DOT[tone]
  return (
    <article className={`metric-cell px-4 py-4 sm:px-5 ${wide ? 'col-span-2 sm:col-span-1' : ''}`} title={exact}>
      <div className="flex items-center gap-2">
        {dot ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} aria-hidden="true" /> : null}
        <h2 className="truncate text-[13px] font-semibold text-[var(--color-muted)]">{label}</h2>
      </div>
      <p className={`mt-2 whitespace-nowrap text-[21px] font-extrabold tracking-[-0.035em] tabular-nums sm:text-[26px] ${VALUE_COLOR[tone]}`}>{value}</p>
      {detail ? <p className="mt-1.5 text-[12.5px] leading-5 text-[var(--color-muted)]">{detail}</p> : null}
    </article>
  )
}
