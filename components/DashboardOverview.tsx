import Link from 'next/link'
import { krw } from '@/lib/labels'

interface DashboardOverviewProps {
  totalValue: number
  totalCost: number
  totalPnl: number
  totalPnlPct: number
  hasPrice: boolean
  realizedPnl: number
  realizedCount: number
  xirr: number | null
}

function performanceTone(value: number) {
  if (value > 0) return 'text-[var(--color-positive)]'
  if (value < 0) return 'text-[var(--color-negative)]'
  return 'text-[var(--color-muted)]'
}

function signedKrw(value: number) {
  return `${value > 0 ? '+' : ''}${krw(value)}`
}

function signedPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

export default function DashboardOverview({
  totalValue,
  totalCost,
  totalPnl,
  totalPnlPct,
  hasPrice,
  realizedPnl,
  realizedCount,
  xirr,
}: DashboardOverviewProps) {
  return (
    <section aria-labelledby="portfolio-overview-title" className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p id="portfolio-overview-title" className="text-xs font-semibold text-[var(--color-ink)]">투자자산 요약</p>
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">활성 계좌 기준 · {hasPrice ? '현재 시세 반영' : '매입가 기준'}</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Link href="/holdings" className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)]">보유 종목</Link>
          <Link href="/net-worth" className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)]">밸런스 시트</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="투자자산" value={krw(totalValue)} detail={hasPrice ? '현재 평가금액' : '총 투자원금'} featured />
        <SummaryMetric label="투자 원금" value={krw(totalCost)} detail="누적 매수원금" />
        <SummaryMetric
          label="평가 손익"
          value={hasPrice ? signedKrw(totalPnl) : '-'}
          detail={hasPrice ? signedPercent(totalPnlPct) : '시세 미조회'}
          tone={hasPrice ? performanceTone(totalPnl) : undefined}
        />
        <SummaryMetric
          label="연환산 수익률"
          value={xirr !== null ? signedPercent(xirr * 100) : '-'}
          detail={xirr !== null ? '현금흐름 기반 XIRR' : realizedCount > 0 ? `실현손익 ${signedKrw(realizedPnl)}` : '거래 누적 후 산출'}
          tone={xirr !== null ? performanceTone(xirr) : undefined}
        />
      </div>
    </section>
  )
}

function SummaryMetric({
  label,
  value,
  detail,
  tone = 'text-[var(--color-ink)]',
  featured = false,
}: {
  label: string
  value: string
  detail?: string
  tone?: string
  featured?: boolean
}) {
  return (
    <div className={`app-card min-w-0 border-t-2 p-4 ${featured ? 'border-t-[var(--color-primary)]' : 'border-t-[#9dbbd7]'}`}>
      <p className="text-[10px] font-medium text-[var(--color-muted)]">{label}</p>
      <p className={`mt-2 truncate text-lg font-bold tracking-[-0.02em] tabular-nums ${tone}`}>{value}</p>
      {detail ? <p className="mt-1 truncate text-[10px] text-[var(--color-subtle)]">{detail}</p> : null}
    </div>
  )
}
