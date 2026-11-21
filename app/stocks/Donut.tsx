import { colorAt } from './palette'

export interface DonutSlice { key: string; label: string; share: number; value: number; rate: number | null }

/** 비중 도넛 + 범례. 범례에는 비중과 수익률을 함께 적는다. */
export default function Donut({ title, slices, center, format, href, note, colorOf }: {
  title: string
  slices: DonutSlice[]
  center: string
  format: (value: number) => string
  href?: (slice: DonutSlice) => string | null
  /** 범례 이름 아래 작은 글씨(예: 월간 기록 금액). */
  note?: (slice: DonutSlice) => string | null
  /** 조각 색을 정한다(없으면 순서대로 팔레트). */
  colorOf?: (slice: DonutSlice) => string
}) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offsets = slices.map((_, index) => slices.slice(0, index).reduce((sum, item) => sum + circumference * item.share / 100, 0))
  return (
    <div className="w-full max-w-[34rem]">
      <h3 className="text-[13px] font-bold">{title}</h3>
      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={`${title}: ${slices.map(slice => `${slice.label} ${slice.share.toFixed(0)}%`).join(', ')}`}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-section)" strokeWidth="14" />
          {slices.map((slice, index) => {
            const length = circumference * slice.share / 100
            return (
              <circle key={slice.key} cx="50" cy="50" r={radius} fill="none" stroke={(colorOf ? colorOf(slice) : colorAt(index))} strokeWidth="14"
                strokeDasharray={`${Math.max(length - (slices.length > 1 ? 0.8 : 0), 0)} ${circumference}`} strokeDashoffset={-offsets[index]} />
            )
          })}
          <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fill="var(--color-ink)">{center}</text>
        </svg>
        <ul className="w-full min-w-0 flex-1 space-y-1.5">
          {slices.map((slice, index) => {
            const link = href?.(slice) ?? null
            const extra = note?.(slice) ?? null
            const label = <span className="min-w-0"><span className="block truncate font-semibold">{slice.label}</span>{extra ? <span className="block truncate text-[11.5px] font-normal text-[var(--color-subtle)]">{extra}</span> : null}</span>
            return (
              <li key={slice.key} className="flex items-center gap-2 text-[12.5px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: (colorOf ? colorOf(slice) : colorAt(index)) }} aria-hidden="true" />
                {link ? <a href={link} className="min-w-0 truncate hover:text-[var(--color-primary)]">{label}</a> : label}
                <span className="ml-auto shrink-0 tabular-nums text-[var(--color-muted)]">{format(slice.value)} · {slice.share.toFixed(0)}%</span>
                {slice.rate !== null ? (
                  <span className={`w-14 shrink-0 text-right font-semibold tabular-nums ${slice.rate > 0 ? 'text-[var(--color-positive)]' : slice.rate < 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-muted)]'}`}>{slice.rate > 0 ? '+' : ''}{slice.rate.toFixed(1)}%</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
