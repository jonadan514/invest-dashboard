import type { TrendPoint } from '@/lib/calc/cost-trend'

const W = 560, H = 100, PL = 8, PR = 8, PT = 8, PB = 20
const iw = W - PL - PR
const ih = H - PT - PB

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) return null

  const max = Math.max(...data.map(d => d.value))
  const range = max || 1
  const x = (i: number) => PL + (i / (data.length - 1)) * iw
  const y = (v: number) => PT + ih - (v / range) * ih
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const lastX = x(data.length - 1)
  const lastY = y(data[data.length - 1].value)
  const bottom = (PT + ih).toFixed(1)

  const step = Math.max(1, Math.floor(data.length / 5))
  const labelIdxs = data
    .map((_, i) => i)
    .filter(i => i === 0 || i === data.length - 1 || i % step === 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c6b4a" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#1c6b4a" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`${pts} ${lastX.toFixed(1)},${bottom} ${PL.toFixed(1)},${bottom}`}
        fill="url(#cg)"
      />
      <polyline points={pts} fill="none" stroke="#1c6b4a" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="#1c6b4a" />
      {labelIdxs.map(i => {
        const [, m] = data[i].month.split('-')
        return (
          <text
            key={i}
            x={x(i)}
            y={H - 4}
            textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
            className="fill-[#b5aa98]"
            style={{ fontSize: 9 }}
          >
            {parseInt(m)}월
          </text>
        )
      })}
    </svg>
  )
}
