import { formatMonth, wonShort } from '@/lib/labels'
import type { TrendPoint } from '@/lib/calc/stock-trend'

/** 월간 평가액 꺾은선. 점 2개 미만이면 그리지 않는다. */
export default function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return <p className="py-6 text-center text-[13px] text-[var(--color-muted)]">월간 기록이 2개월 이상 쌓이면 추이가 보여요.</p>
  }
  const width = 600
  const height = 160
  const pad = { left: 8, right: 8, top: 12, bottom: 22 }
  const max = Math.max(...points.map(point => point.value))
  const min = Math.min(...points.map(point => point.value))
  const span = max - min || 1
  const x = (index: number) => pad.left + (width - pad.left - pad.right) * index / (points.length - 1)
  const y = (value: number) => pad.top + (height - pad.top - pad.bottom) * (1 - (value - min) / span)
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const delta = last.value - first.value
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${formatMonth(first.month)}부터 ${formatMonth(last.month)}까지 평가액 추이`} className="h-auto w-full">
        <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => <circle key={point.month} cx={x(index)} cy={y(point.value)} r="3" fill="var(--color-primary)"><title>{`${formatMonth(point.month)} ${wonShort(point.value)}`}</title></circle>)}
        <text x={pad.left} y={height - 6} fontSize="11" fill="var(--color-muted)">{formatMonth(first.month)}</text>
        <text x={width - pad.right} y={height - 6} fontSize="11" textAnchor="end" fill="var(--color-muted)">{formatMonth(last.month)}</text>
      </svg>
      <figcaption className="mt-1 text-[12.5px] tabular-nums text-[var(--color-muted)]">
        {wonShort(first.value)} → <strong className="text-[var(--color-ink)]">{wonShort(last.value)}</strong> ({delta >= 0 ? '+' : ''}{wonShort(delta)})
      </figcaption>
    </figure>
  )
}
