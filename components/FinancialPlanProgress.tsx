import Link from 'next/link'
import { calcAllocation, getPlanPhase, type FinancialPlanSettings } from '@/lib/calc/budget'

interface Props {
  month: string
  emergencyFund: number
  jointContribution: number
  bonusToPlan: number
  settings: FinancialPlanSettings
}

export default function FinancialPlanProgress({ month, emergencyFund, jointContribution, bonusToPlan, settings }: Props) {
  const phase = getPlanPhase(emergencyFund, settings)
  const allocation = calcAllocation({ jointContribution, bonusToPlan, emergencyFund }, settings)
  const target = phase === 1 ? settings.stage1Target : settings.stage2Target
  const progress = Math.min(100, target > 0 ? (emergencyFund / target) * 100 : 0)

  return (
    <section className="app-card mb-5 p-4 sm:p-5" aria-labelledby="financial-progress-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--color-primary)]">Monthly plan check</p>
          <h2 id="financial-progress-title" className="mt-1 text-sm font-semibold">자금 배분 진행 상황</h2>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">{month.replace('-', '년 ')}월 기록 기준</p>
        </div>
        <Link href={`/budget?month=${month}`} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-primary)]">
          기록 확인 →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="현재 단계" value={phase === 3 ? '비상금 완료' : `${phase}단계`} />
        <Metric label="현재 비상금" value={krw(emergencyFund)} />
        <Metric label="이달 배분 가능액" value={krw(allocation.totalAllocatable)} />
        <Metric label="주담대 원금" value={krw(settings.mortgagePrincipal)} sub="자산형성 · 중복 합산 안 함" />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[10px] text-[var(--color-muted)]">
          <span>{phase === 3 ? '최종 목표 달성' : `${phase}단계 비상금 목표`}</span>
          <span>{krw(emergencyFund)} / {krw(target)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
          <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {allocation.totalAllocatable > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--color-muted)]">
          {allocation.emergencyFund > 0 ? <span>비상금 <b className="text-[var(--color-ink)]">{krw(allocation.emergencyFund)}</b></span> : null}
          {allocation.investmentAssets > 0 ? <span>투자자산 <b className="text-[var(--color-ink)]">{krw(allocation.investmentAssets)}</b></span> : null}
          {allocation.propertyFund > 0 ? <span>부동산 비용 <b className="text-[var(--color-ink)]">{krw(allocation.propertyFund)}</b></span> : null}
        </div>
      ) : null}
    </section>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)]/70 bg-[var(--color-surface)] p-3">
      <p className="text-[10px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[9px] text-[var(--color-subtle)]">{sub}</p> : null}
    </div>
  )
}

function krw(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value))}원`
}
