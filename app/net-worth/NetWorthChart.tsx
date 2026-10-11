interface Point {
  month: string
  assets: number
  liabilities: number
  netWorth: number
}

const W = 720
const H = 230
const LEFT = 54
const RIGHT = 12
const TOP = 16
const BOTTOM = 32

export default function NetWorthChart({ data }: { data: Point[] }) {
  if (data.length < 2) return null

  const values = data.flatMap(point => [point.assets, point.liabilities, point.netWorth])
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const range = max - min || 1
  const innerWidth = W - LEFT - RIGHT
  const innerHeight = H - TOP - BOTTOM
  const x = (index: number) => LEFT + (index / (data.length - 1)) * innerWidth
  const y = (value: number) => TOP + ((max - value) / range) * innerHeight
  const line = (key: keyof Pick<Point, 'assets' | 'liabilities' | 'netWorth'>) => data.map((point, index) => `${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ')
  const ticks = [max, min + range / 2, min]
  const labelStep = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[10px] text-[var(--color-muted)]">
        <Legend color="#3f7fc3" label="자산" />
        <Legend color="#dc3f4a" label="부채" />
        <Legend color="#84cc16" label="순자산" />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="월별 자산, 부채, 순자산 추이">
        {ticks.map((tick, index) => (
          <g key={index}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(tick)} y2={y(tick)} stroke="#dfd5c2" strokeWidth="1" />
            <text x={LEFT - 7} y={y(tick) + 3} textAnchor="end" fill="#8d8779" fontSize="9">{compactKrw(tick)}</text>
          </g>
        ))}
        <polyline points={line('assets')} fill="none" stroke="#3f7fc3" strokeWidth="2.5" strokeLinejoin="round" />
        <polyline points={line('liabilities')} fill="none" stroke="#dc3f4a" strokeWidth="2.5" strokeLinejoin="round" />
        <polyline points={line('netWorth')} fill="none" stroke="#84cc16" strokeWidth="2.8" strokeLinejoin="round" />
        {data.map((point, index) => index % labelStep === 0 || index === data.length - 1 ? (
          <text key={point.month} x={x(index)} y={H - 8} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} fill="#8d8779" fontSize="9">
            {point.month.slice(2).replace('-', '.')}
          </text>
        ) : null)}
      </svg>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ backgroundColor: color }} />{label}</span>
}

function compactKrw(value: number) {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute >= 100_000_000) return `${sign}${(absolute / 100_000_000).toFixed(1)}억`
  if (absolute >= 10_000) return `${sign}${Math.round(absolute / 10_000)}만`
  return `${sign}${Math.round(absolute)}`
}
