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

/** 항목 색: 순자산·총자산·총부채를 숫자와 그래프 선에서 같은 색으로 맞춘다. */
export const HERO_COLORS = { netWorth: '#8ee0b5', assets: '#8fb3e3', liabilities: '#f5a29c' } as const

/** 자산 구성 막대는 항목 색과 겹치지 않도록 금·회색 계열을 쓴다. */
const SLICE_COLORS = ['#e3c48d', '#b9c7da', '#a68a5b', '#7d8ea6', '#f1e2c3', '#5f7089']

/** 홈 맨 위 순자산 카드: 순자산·총자산·총부채를 색으로 구분하고 같은 색의 추이 선을 함께 보여 준다. */
export default function NetWorthHero({ current, previous, trend, composition }: Props) {
  const change = previous ? current.netWorth - previous.netWorth : null
  const changeRate = change !== null && previous && previous.netWorth !== 0 ? change / Math.abs(previous.netWorth) * 100 : null
  const hasRecord = trend.length > 0

  return (
    <section
      aria-label="순자산 요약"
      className="grid grid-cols-1 gap-5 overflow-hidden rounded-[18px] px-5 py-5 text-white shadow-[0_10px_26px_rgb(23_43_70/0.2)] sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] lg:gap-7"
      style={{ background: 'radial-gradient(120% 140% at 100% 0%, #2c4f80 0%, #172b46 55%, #10203a 100%)' }}
    >
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold tracking-[0.16em] text-[var(--color-gold)]">SAEMHUNHO · {formatMonth(current.month)}</p>

        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white/75">
              <Dot color={HERO_COLORS.netWorth} /> 순자산
            </p>
            <p className="mt-1 whitespace-nowrap text-[32px] font-extrabold leading-none tracking-[-0.045em] tabular-nums sm:text-[36px]" title={krw(current.netWorth)}>
              <BigWon value={current.netWorth} />
            </p>
          </div>
          {change !== null ? (
            <p className={`mb-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-bold tabular-nums ${change >= 0 ? 'bg-[#7ed3a8]/15 text-[#8ee0b5]' : 'bg-[#f08a83]/15 text-[#f5a29c]'}`}>
              {change >= 0 ? '▲' : '▼'} {signedWonShort(change).replace(/^[+-]/, '')}
              <span className="font-semibold opacity-80">{changeRate === null ? '' : `(${changeRate > 0 ? '+' : ''}${changeRate.toFixed(1)}%)`}</span>
            </p>
          ) : (
            <p className="mb-0.5 text-[12.5px] text-white/60">{hasRecord ? '다음 달부터 변화 표시' : '첫 기록을 남겨 보세요'}</p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <ItemStat label="총자산" value={current.assets} color={HERO_COLORS.assets} />
          <ItemStat label="총부채" value={current.liabilities} color={HERO_COLORS.liabilities} />
        </div>

        <Composition slices={composition} total={current.assets} />
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ul className="hidden gap-3 text-[12px] text-white/70 sm:flex" aria-label="그래프 범례">
            <li className="flex items-center gap-1.5"><Dot color={HERO_COLORS.netWorth} />순자산</li>
            <li className="flex items-center gap-1.5"><Dot color={HERO_COLORS.assets} />총자산</li>
            <li className="flex items-center gap-1.5"><Dot color={HERO_COLORS.liabilities} />총부채</li>
          </ul>
          <div className="flex items-center gap-3">
            <Link href="/net-worth" className="text-[12.5px] font-semibold text-white/70 hover:text-white">밸런스 시트 →</Link>
            <Link href="/budget" className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-bold text-[var(--color-sidebar)] hover:bg-white/90">이번 달 기록하기</Link>
          </div>
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

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
}

function BigWon({ value }: { value: number }) {
  const text = wonShort(value)
  if (!text.endsWith('만')) return <>{text}</>
  return <>{text.slice(0, -1)}<span className="ml-0.5 text-[0.5em] font-bold text-white/70">만</span></>
}

function ItemStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.07] px-3 py-2.5" style={{ boxShadow: `inset 3px 0 0 ${color}` }} title={krw(value)}>
      <p className="flex items-center gap-1.5 text-[12px] text-white/65"><Dot color={color} />{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[16px] font-bold tabular-nums" style={{ color }}>{wonShort(value)}</p>
    </div>
  )
}

function Composition({ slices, total }: { slices: CompositionSlice[]; total: number }) {
  const visible = slices.filter(slice => slice.value > 0)
  if (visible.length === 0 || total <= 0) return null
  return (
    <div className="mt-3.5 flex items-center gap-3">
      <span className="shrink-0 text-[11.5px] text-white/55">자산 구성</span>
      <div className="min-w-0 flex-1">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`자산 구성: ${visible.map(slice => `${slice.label} ${Math.round(slice.value / total * 100)}%`).join(', ')}`}>
          {visible.map((slice, index) => (
            <span key={slice.label} style={{ width: `${slice.value / total * 100}%`, backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }} />
          ))}
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-white/60">
          {visible.slice(0, 4).map((slice, index) => (
            <li key={slice.label} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }} aria-hidden="true" />
              {slice.label} <span className="tabular-nums text-white/85">{Math.round(slice.value / total * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function TrendArea({ data, width }: { data: TrendPoint[]; width: number }) {
  if (data.length < 2) {
    return (
      <div className="mt-3 flex min-h-[130px] flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 px-6 text-center text-[13px] leading-6 text-white/60">
        두 달 이상 기록하면 순자산·총자산·총부채 흐름이 그려져요.
      </div>
    )
  }
  const compact = width < 500
  const height = compact ? 140 : 168
  const top = compact ? 24 : 30
  const bottom = 24
  const values = data.flatMap(point => [point.netWorth, point.assets, point.liabilities])
  const rawMax = Math.max(...values)
  const rawMin = Math.min(...values)
  const pad = Math.max((rawMax - rawMin) * 0.08, Math.abs(rawMax) * 0.02, 1)
  const max = rawMax + pad
  const min = rawMin - pad
  const left = compact ? 4 : 6
  const x = (index: number) => left + index / (data.length - 1) * (width - left * 2)
  const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom)
  const line = (key: 'netWorth' | 'assets' | 'liabilities') => data.map((point, index) => `${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ')
  const netLine = line('netWorth')
  const last = data.at(-1)!
  const lastX = x(data.length - 1)
  const lastY = y(last.netWorth)
  const labelStep = Math.max(1, Math.ceil(data.length / (compact ? 4 : 6)))
  const id = `hero-area-${width}`
  const bubbleWidth = 104
  const bubbleX = Math.min(Math.max(lastX - bubbleWidth + 8, 0), width - bubbleWidth)
  const bubbleY = Math.max(lastY - 34, 0)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full flex-1" role="img" aria-label={`최근 ${data.length}개월 추이. 순자산 ${wonShort(last.netWorth)}, 총자산 ${wonShort(last.assets)}, 총부채 ${wonShort(last.liabilities)}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={HERO_COLORS.netWorth} stopOpacity="0.32" />
          <stop offset="1" stopColor={HERO_COLORS.netWorth} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.08, 0.5, 0.86].map(ratio => {
        const value = max - (max - min) * ratio
        const lineY = y(value)
        return (
          <g key={ratio}>
            <line x1="0" x2={width} y1={lineY} y2={lineY} stroke="rgb(255 255 255 / 0.07)" />
            <text x="2" y={lineY - 4} fill="rgb(255 255 255 / 0.38)" fontSize="10.5">{compactKrw(value)}</text>
          </g>
        )
      })}
      <polyline points={line('assets')} fill="none" stroke={HERO_COLORS.assets} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      <polyline points={line('liabilities')} fill="none" stroke={HERO_COLORS.liabilities} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      <path d={`M${netLine.split(' ').join(' L')} L${lastX.toFixed(1)},${height - bottom} L${x(0).toFixed(1)},${height - bottom}Z`} fill={`url(#${id})`} />
      <polyline points={netLine} fill="none" stroke={HERO_COLORS.netWorth} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="5" fill={HERO_COLORS.netWorth} stroke="#10203a" strokeWidth="2" />
      <rect x={bubbleX} y={bubbleY} width={bubbleWidth} height="22" rx="7" fill="rgb(255 255 255 / 0.14)" />
      <text x={bubbleX + bubbleWidth / 2} y={bubbleY + 15} textAnchor="middle" fill="#ffffff" fontSize="11.5" fontWeight="700">{wonShort(last.netWorth)}</text>
      {data.map((point, index) => index % labelStep === 0 || index === data.length - 1 ? (
        <text key={point.month} x={x(index)} y={height - 6} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} fill="rgb(255 255 255 / 0.5)" fontSize="11">
          {Number(point.month.slice(5))}월
        </text>
      ) : null)}
    </svg>
  )
}
