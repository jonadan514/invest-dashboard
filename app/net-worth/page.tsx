import { getHouseholdContext } from '@/lib/supabase/server'
import { buildAccountTotalTrend, latestSnapshotsAtMonth } from '@/lib/calc/account-snapshots'
import { DEFAULT_FINANCIAL_PLAN } from '@/lib/calc/budget'
import type { Account, AccountMonthlySnapshot, FinancialPlanSettingsRow, MonthlyBudget, NetWorthItem, NetWorthSnapshot } from '@/lib/types'
import NetWorthChart from './NetWorthChart'
import NetWorthManager from './NetWorthManager'

interface TrendPoint {
  month: string
  assets: number
  liabilities: number
  netWorth: number
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthOptions(selected: string) {
  const [year, month] = selected.split('-').map(Number)
  return Array.from({ length: 25 }, (_, index) => {
    const date = new Date(year, month - 1 - index, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}

function buildTrend(items: NetWorthItem[], snapshots: NetWorthSnapshot[], accountTotals: { month: string; amount: number }[]) {
  const itemMap = new Map(items.map(item => [item.id, item]))
  const byMonth = new Map<string, NetWorthSnapshot[]>()
  for (const snapshot of snapshots) {
    const list = byMonth.get(snapshot.month) ?? []
    list.push(snapshot)
    byMonth.set(snapshot.month, list)
  }
  const portfolioByMonth = new Map(accountTotals.map(snapshot => [snapshot.month, Number(snapshot.amount)]))
  const months = new Set([...byMonth.keys(), ...portfolioByMonth.keys()])

  const latest = new Map<string, number>()
  let latestPortfolio = 0
  const points: TrendPoint[] = []
  for (const month of [...months].sort()) {
    for (const snapshot of byMonth.get(month) ?? []) latest.set(snapshot.item_id, Number(snapshot.amount))
    if (portfolioByMonth.has(month)) latestPortfolio = portfolioByMonth.get(month) ?? 0
    let assets = latestPortfolio
    let liabilities = 0
    for (const [itemId, amount] of latest) {
      const item = itemMap.get(itemId)
      if (item?.inactive_from_month && month >= item.inactive_from_month) continue
      if (item?.kind === 'asset') assets += amount
      if (item?.kind === 'liability') liabilities += amount
    }
    points.push({ month, assets, liabilities, netWorth: assets - liabilities })
  }
  return points
}

export default async function NetWorthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const requested = (await searchParams).month
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentMonth()
  const { supabase, userId } = await getHouseholdContext()

  const [
    { data: itemRows },
    { data: snapshotRows },
    { data: planRow },
    { data: budgetRow },
    { data: accountRows },
    { data: accountSnapshotRows },
  ] = await Promise.all([
    supabase.from('net_worth_items').select('*').eq('user_id', userId).order('kind').order('sort_order').order('created_at').throwOnError(),
    supabase.from('net_worth_snapshots').select('*').eq('user_id', userId).lte('month', month).order('month').throwOnError(),
    supabase.from('financial_plan_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).eq('month', month).maybeSingle().throwOnError(),
    supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true).in('type', ['cash', 'mmf', 'general', 'pension', 'irp', 'isa', 'crypto']).order('sort_order').throwOnError(),
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).lte('month', month).order('month').throwOnError(),
  ])

  const items = (itemRows ?? []) as NetWorthItem[]
  const snapshots = (snapshotRows ?? []) as NetWorthSnapshot[]
  const accounts = (accountRows ?? []) as Account[]
  const accountSnapshots = (accountSnapshotRows ?? []) as AccountMonthlySnapshot[]
  const accountTotals = buildAccountTotalTrend(accounts, accountSnapshots)
  const latestAccountSnapshots = latestSnapshotsAtMonth(accountSnapshots, month)
  const latestAccountTotal = [...accountTotals].reverse().find(point => point.month <= month)
  const portfolioValue = latestAccountTotal?.amount ?? 0
  const activeItems = items.filter(item => item.is_active)
  const inactiveItems = items.filter(item => !item.is_active)
  const exactSnapshots = snapshots.filter(snapshot => snapshot.month === month)
  const latestAmounts: Record<string, number> = {}
  for (const snapshot of snapshots) latestAmounts[snapshot.item_id] = Number(snapshot.amount)

  const trend = buildTrend(items, snapshots, accountTotals)
  const exactCurrent = trend.find(point => point.month === month) ?? null
  const current = exactCurrent ?? trend.at(-1) ?? null
  const currentIndex = exactCurrent ? trend.findIndex(point => point.month === exactCurrent.month) : -1
  const previous = currentIndex > 0 ? trend[currentIndex - 1] : null
  const assetChange = current && previous ? current.assets - previous.assets : 0
  const debtReduction = current && previous ? previous.liabilities - current.liabilities : 0
  const netWorthChange = current && previous ? current.netWorth - previous.netWorth : 0
  const plan = planRow as FinancialPlanSettingsRow | null
  const budget = budgetRow as MonthlyBudget | null
  const mortgagePrincipal = Number(budget?.mortgage_principal ?? plan?.mortgage_principal ?? DEFAULT_FINANCIAL_PLAN.mortgagePrincipal)
  const fixedCost = Number(plan?.monthly_fixed_cost ?? DEFAULT_FINANCIAL_PLAN.monthlyFixedCost)
  const jointContribution = Number(budget?.joint_savings ?? plan?.monthly_joint_contribution ?? DEFAULT_FINANCIAL_PLAN.monthlyJointContribution)
  const plannedAllocation = Math.max(jointContribution - fixedCost, 0) + Number(budget?.bonus_to_plan ?? 0)

  return (
    <>
      <div className="page-container max-w-[1240px]">
        <div className="mb-5">
          <p className="page-eyebrow">Household balance sheet</p>
          <h1 className="page-title">밸런스 시트</h1>
          <p className="page-subtitle">금융계좌와 자산·부채를 한곳에서 관리하고 순자산 변화를 확인합니다.</p>
        </div>

        <NetWorthManager
          key={month}
          overview={(
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryCard label="총자산" value={current?.assets ?? 0} change={assetChange} tone="asset" hasPrevious={Boolean(previous)} />
                <SummaryCard label="총부채" value={current?.liabilities ?? 0} change={debtReduction} tone="liability" hasPrevious={Boolean(previous)} />
                <SummaryCard label="순자산" value={current?.netWorth ?? 0} change={netWorthChange} tone="net" hasPrevious={Boolean(previous)} />
              </div>
              {current && current.month !== month ? (
                <p className="text-right text-[11px] text-[var(--color-muted)]">상단 합계는 가장 최근 저장 기록인 {current.month.replace('-', '년 ')}월 기준입니다.</p>
              ) : null}

              {current && previous ? (
                <section className="app-card p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-[var(--color-ink)]">이번 달 순자산 변동</h2>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{previous.month} 월말과 {current.month} 월말의 실제 잔액 비교</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${netWorthChange > 0 ? 'bg-[var(--color-positive-soft)] text-[var(--color-positive-strong)]' : netWorthChange < 0 ? 'bg-[var(--color-negative-soft)] text-[var(--color-negative-strong)]' : 'bg-[var(--color-section)] text-[var(--color-muted)]'}`}>
                      순자산 {signedKrw(netWorthChange)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FlowItem label="자산 증감" value={assetChange} description="현금·투자·부동산 등" />
                    <FlowItem label="부채 상환" value={debtReduction} description="양수면 부채가 줄어든 금액" />
                    <FlowItem label="재무계획 배분액" value={plannedAllocation} description="공금−고정비+포함 성과급" />
                    <FlowItem label="계획된 주담대 원금" value={mortgagePrincipal} description="재무계획 기준 · 중복 합산하지 않음" />
                  </div>
                </section>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-muted)]">
                  두 달 이상 기록하면 자산 증가, 부채 상환, 순자산 변화를 나누어 보여드립니다. 이달 재무계획 배분액은 {krw(plannedAllocation)}, 주담대 원금 계획은 {krw(mortgagePrincipal)}입니다.
                </div>
              )}

              {trend.length >= 2 ? (
                <section className="app-card p-4 sm:p-5">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-[var(--color-ink)]">월별 순자산 추이</h2>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">항목별 월말 기록을 기준으로 계산합니다.</p>
                  </div>
                  <NetWorthChart data={trend} />
                </section>
              ) : null}
            </>
          )}
          month={month}
          months={monthOptions(month)}
          activeItems={activeItems}
          inactiveItems={inactiveItems}
          accounts={accounts}
          latestAccountSnapshots={Object.fromEntries([...latestAccountSnapshots.entries()].map(([accountId, snapshot]) => [accountId, {
            amount: Number(snapshot.evaluation_amount),
            month: snapshot.month,
          }]))}
          initialAmounts={latestAmounts}
          hasExactSnapshot={exactSnapshots.length > 0 || accountSnapshots.some(snapshot => snapshot.month === month)}
          investmentValue={portfolioValue}
          investmentRecordedMonth={latestAccountTotal?.month ?? null}
        />
      </div>
    </>
  )
}

function SummaryCard({ label, value, change, tone, hasPrevious }: { label: string; value: number; change: number; tone: 'asset' | 'liability' | 'net'; hasPrevious: boolean }) {
  const color = tone === 'asset' ? 'text-[var(--color-primary)]' : tone === 'liability' ? 'text-[var(--color-negative)]' : 'text-[var(--color-positive-strong)]'
  const accent = tone === 'asset' ? 'border-t-[var(--color-primary)]' : tone === 'liability' ? 'border-t-[var(--color-negative)]' : 'border-t-[var(--color-positive-bright)]'
  const labelColor = tone === 'liability' ? 'text-[var(--color-negative-strong)]' : tone === 'net' ? 'text-[var(--color-positive-strong)]' : 'text-[var(--color-ink)]'
  const previousValue = tone === 'liability' ? value + change : value - change
  const percent = hasPrevious && Math.abs(previousValue) > 0 ? change / Math.abs(previousValue) * 100 : 0
  const favorable = change > 0
  const changeText = tone === 'liability'
    ? `전월 대비 ${change >= 0 ? '감소' : '증가'} ${krw(Math.abs(change))} (${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%)`
    : `전월 대비 ${signedKrw(change)} (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)`
  return (
    <div className={`app-card border-t-4 p-4 ${accent}`}>
      <p className={`text-sm font-extrabold ${labelColor}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-[-0.025em] tabular-nums lg:text-2xl ${color}`}>{krw(value)}</p>
      <p className={`mt-2 text-[11px] font-medium tabular-nums ${!hasPrevious ? 'text-[var(--color-subtle)]' : favorable ? 'text-[var(--color-positive-strong)]' : change < 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-muted)]'}`}>
        {hasPrevious ? changeText : '전월 기록 없음'}
      </p>
    </div>
  )
}

function FlowItem({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="rounded-xl bg-white/60 px-4 py-3">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1 text-base font-bold ${value > 0 ? 'text-[var(--color-positive-strong)]' : value < 0 ? 'text-[var(--color-negative)]' : ''}`}>{signedKrw(value)}</p>
      <p className="mt-1 text-[10px] text-[var(--color-subtle)]">{description}</p>
    </div>
  )
}

function krw(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value))}원`
}

function signedKrw(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${krw(Math.abs(value))}`
}
