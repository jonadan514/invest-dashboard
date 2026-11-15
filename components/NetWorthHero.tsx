import Link from 'next/link'
import type { TrendPoint } from '@/lib/calc/home-insights'
import { compactKrw, formatMonth, krw, signedWonShort, wonShort } from '@/lib/labels'

export interface CompositionSlice {
  label: string
  value: number
}

interface Props {
  current: TrendPoint
  previous: TrendPoint | null
  /** 최근 기록부터 거슬러 올라간 최대 12개월. */
  trend: TrendPoint[]
  composition: CompositionSlice[]
}

const SLICE_COLORS = ['#8fb3e3', '#c4a46b', '#7fcfae', '#c9d3e0', '#e8b4a8', '#a7b6ff']

/** 홈 맨 위 순자산 카드: 큰 숫자, 지난달 대비 변화, 총자산·총부채, 자산 구성, 순자산 흐름. */
export default function NetWorthHero({ current, previous, trend, composition }: Props) {
  const change = previous ? current.netWorth - previous.netWorth : null
  const changeRate = change !== null && previous && previous.netWorth !== 0 ? change / Math.abs(previous.netWorth) * 100 : null
  const hasRecord = trend.length > 0

  return (
    <section
      aria-label="순자산 요약"
      className="grid grid-cols-1 gap-6 overflow-hidden rounded-[20px] px-5 pb-5 pt-6 text-white shadow-[0_14px_32px_rgb(23_43_70/0.22)] sm:px-7 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:gap-8 lg:pb-4"
      style={{ background: 'radial-gradient(120% 140% at 100% 0%, #2c4f80 0%, #172b46 55%, #10203a 100%)' }}
    >
      <div className="min-w-0">
        <p className="text-[12px] font-bold tracking-[0.16em] text-[var(--color-gold)]">SAEMHUNHO · {formatMonth(current.month)}</p>
        <h1 className="mt-4 text-[15px] font-semibold text-white/75">우리 가족 순자산</h1>
        <p className="mt-1.5 whitespace-nowrap text-[38px] font-extrabold leading-none tracking-[-0.045em] tabular-nums sm:text-[46px]" title={krw(current.netWorth)}>
          <BigWon value={current.netWorth} />
        </p>
        {change !== null ? (
          <p className={`mt-3.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold tabular-nums ${change >= 0 ? 'bg-[#7ed3a8]/15 text-[#8ee0b5]' : 'bg-[#f08a83]/15 text-[#f5a29c]'}`}>
            {change >= 0 ? '▲' : '▼'} {signedWonShort(change).replace(/^[+-]/, '')}
            <span className="font-semibold opacity-80">· 지난달 대비 {changeRate === null ? '' : `${changeRate > 0 ? '+' : ''}${changeRate.toFixed(1)}%`}</span>
          </p>
        ) : (
          <p className="mt-3.5 text-[13px] text-white/60">{hasRecord ? '다음 달 기록부터 변화가 표시돼요' : '밸런스 시트에 첫 기록을 남겨 보세요'}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <MiniStat label="총자산" value={current.assets} />
          <MiniStat label="총부채" value={current.liabilities} />
        </div>

        <Composition slices={composition} total={current.assets} />
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3">
          <Link href="/net-worth" className="text-[12.5px] font-semibold text-white/70 hover:text-white">밸런스 시트 →</Link>
          <Link href="/budget" className="rounded-lg bg-white px-3.5 py-2 text-[13px] font-bold text-[var(--color-sidebar)] hover:bg-white/90">이번 달 기록하기</Link>
        </div>
        {trend.length < 2 ? (
          <TrendArea data={trend} width={680} />
        ) : (
          <>
            <div className="sm:hidden"><TrendArea data={trend} width={340} /></div>
            <div className="hidden flex-1 sm:flex"><TrendArea data={trend} width={680} /></div>
          </>
        )}
      </div>
    </section>
  )
}

function BigWon({ value }: { value: number }) {
  const text = wonShort(value)
  if (!text.endsWith('만')) return <>{text}</>
  return <>{text.slice(0, -1)}<span className="ml-0.5 text-[0.5em] font-bold text-white/70">만</span></>
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.07] px-3.5 py-3" title={krw(value)}>
      <p className="text-[12px] text-white/60">{label}</p>
      <p className="mt-1 whitespace-nowrap text-[16px] font-bold tabular-nums sm:text-[18px]">{wonShort(value)}</p>
    </div>
  )
}

function Composition({ slices, total }: { slices: CompositionSlice[]; total: number }) {
  const visible = slices.filter(slice => slice.value > 0)
  if (visible.length === 0 || total <= 0) return null
  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`자산 구성: ${visible.map(slice => `${slice.label} ${Math.round(slice.value / total * 100)}%`).join(', ')}`}>
        {visible.map((slice, index) => (
          <span key={slice.label} style={{ width: `${slice.value / total * 100}%`, backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-white/65">
        {visible.slice(0, 4).map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }} aria-hidden="true" />
            {slice.label} <span className="tabular-nums text-white/90">{Math.round(slice.value / total * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TrendArea({ data, width }: { data: TrendPoint[]; width: number }) {
  if (data.length < 2) {
    return (
      <div className="mt-4 flex min-h-[180px] flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 px-6 text-center text-[13px] leading-6 text-white/60">
        두 달 이상 기록하면 순자산 흐름이 그려져요.
      </div>
    )
  }
  const height = width < 500 ? 190 : 230
  const id = `hero-area-${width}`
  const top = 52
  const bottom = 30
  const values = data.map(point => point.netWorth)
  const rawMax = Math.max(...values)
  const rawMin = Math.min(...values)
  const pad = Math.max((rawMax - rawMin) * 0.25, Math.abs(rawMax) * 0.02, 1)
  const max = rawMax + pad
  const min = rawMin - pad
  const x = (index: number) => 6 + index / (data.length - 1) * (width - 12)
  const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom)
  const line = data.map((point, index) => `${x(index).toFixed(1)},${y(point.netWorth).toFixed(1)}`).join(' ')
  const last = data.at(-1)!
  const lastX = x(data.length - 1)
  const lastY = y(last.netWorth)
  const labelStep = Math.max(1, Math.ceil(data.length / (width < 500 ? 4 : 6)))
  const bubbleWidth = 116
  const bubbleX = Math.min(Math.max(lastX - bubbleWidth + 10, 0), width - bubbleWidth)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full flex-1" role="img" aria-label={`최근 ${data.length}개월 순자산 흐름, 현재 ${wonShort(last.netWorth)}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8fb3e3" stopOpacity="0.45" />
          <stop offset="1" stopColor="#8fb3e3" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.6, 0.95].map(ratio => {
        const value = max - (max - min) * ratio
        const lineY = y(value)
        return (
          <g key={ratio}>
            <line x1="0" x2={width} y1={lineY} y2={lineY} stroke="rgb(255 255 255 / 0.08)" />
            <text x="2" y={lineY - 5} fill="rgb(255 255 255 / 0.4)" fontSize="11">{compactKrw(value)}</text>
          </g>
        )
      })}
      <path d={`M${line.split(' ').join(' L')} L${lastX.toFixed(1)},${height - bottom} L${x(0).toFixed(1)},${height - bottom}Z`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke="#cfe0f7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="6" fill="#ffffff" />
      <g>
        <rect x={bubbleX} y={Math.max(lastY - 42, 0)} width={bubbleWidth} height="26" rx="8" fill="rgb(255 255 255 / 0.14)" />
        <text x={bubbleX + bubbleWidth / 2} y={Math.max(lastY - 42, 0) + 17.5} textAnchor="middle" fill="#ffffff" fontSize="12.5" fontWeight="700">{wonShort(last.netWorth)}</text>
      </g>
      {data.map((point, index) => index % labelStep === 0 || index === data.length - 1 ? (
        <text key={point.month} x={x(index)} y={height - 8} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} fill="rgb(255 255 255 / 0.55)" fontSize="12">
          {Number(point.month.slice(5))}월
        </text>
      ) : null)}
    </svg>
  )
}
