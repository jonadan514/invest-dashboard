import Link from 'next/link'
import { buildAccountTotalTrend, latestSnapshotsAtMonth, latestYearContributions } from '@/lib/calc/account-snapshots'
import { DEFAULT_FINANCIAL_PLAN } from '@/lib/calc/budget'
import { calcDeductible, TOTAL_DEDUCT_LIMIT } from '@/lib/calc/pension'
import { krw } from '@/lib/labels'
import { getHouseholdContext } from '@/lib/supabase/server'
import type {
  Account,
  AccountMonthlySnapshot,
  FinancialPlanSettingsRow,
  MonthlyBudget,
  NetWorthItem,
  NetWorthSnapshot,
} from '@/lib/types'

interface TrendPoint {
  month: string
  assets: number
  liabilities: number
  netWorth: number
}

interface CompositionItem {
  label: string
  value: number
  color: string
}

const CATEGORY_LABEL: Record<string, string> = {
  cash: '현금',
  savings: '예·적금',
  deposit: '예금',
  real_estate: '부동산',
  vehicle: '차량',
  other_asset: '기타 자산',
}

const COMPOSITION_COLORS = ['#3f7fc3', '#1f3858', '#78a8d6', '#9ab9d3', '#8aa59a', '#becbda']

export default async function DashboardPage() {
  const { supabase, userId } = await getHouseholdContext()
  const now = new Date()
  const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(now))
  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(now)

  const [
    { data: accountsRaw },
    { data: budgetsRaw },
    { data: planRaw },
    { data: netWorthItemsRaw },
    { data: netWorthSnapshotsRaw },
    { data: accountSnapshotsRaw },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order').throwOnError(),
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).order('month', { ascending: false }).limit(12).throwOnError(),
    supabase.from('financial_plan_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('net_worth_items').select('*').eq('user_id', userId).order('sort_order').throwOnError(),
    supabase.from('net_worth_snapshots').select('*').eq('user_id', userId).order('month').throwOnError(),
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).order('month').throwOnError(),
  ])

  const accounts = (accountsRaw ?? []) as Account[]
  const budgets = (budgetsRaw ?? []) as MonthlyBudget[]
  const plan = planRaw as FinancialPlanSettingsRow | null
  const netWorthItems = (netWorthItemsRaw ?? []) as NetWorthItem[]
  const netWorthSnapshots = (netWorthSnapshotsRaw ?? []) as NetWorthSnapshot[]
  const accountSnapshots = (accountSnapshotsRaw ?? []) as AccountMonthlySnapshot[]
  const accountTotals = buildAccountTotalTrend(accounts, accountSnapshots)

  const trend = buildTrend(netWorthItems, netWorthSnapshots, accountTotals)
  const current = trend.at(-1) ?? { month: currentMonth, assets: 0, liabilities: 0, netWorth: 0 }
  const previous = trend.at(-2)
  const netWorthChange = previous ? current.netWorth - previous.netWorth : 0

  const latestBudget = budgets[0] ?? null
  const emergencyAccounts = accounts.filter(account => account.is_emergency_fund)
  const emergencySnapshots = latestSnapshotsAtMonth(accountSnapshots, latestBudget?.month ?? current.month)
  const emergencyFund = emergencyAccounts.length > 0
    ? emergencyAccounts.reduce((sum, account) => sum + Number(emergencySnapshots.get(account.id)?.evaluation_amount ?? 0), 0)
    : latestBudget
      ? Number(latestBudget.cash_balance)
      : Number(plan?.current_emergency_fund ?? DEFAULT_FINANCIAL_PLAN.currentEmergencyFund)
  const stage1Target = Number(plan?.stage1_target ?? DEFAULT_FINANCIAL_PLAN.stage1Target)
  const stage2Target = Number(plan?.stage2_target ?? DEFAULT_FINANCIAL_PLAN.stage2Target)
  const emergencyTarget = emergencyFund < stage1Target ? stage1Target : stage2Target
  const emergencyStage = emergencyFund < stage1Target ? '3천만 목표' : emergencyFund < stage2Target ? '5천만 목표' : '목표 완료'

  const pensionAccounts = accounts.filter(account => account.type === 'pension' || account.type === 'irp')
  const pensionAccountMap = new Map(pensionAccounts.map(account => [account.id, account]))
  const pensionSnapshots = latestYearContributions(accounts, accountSnapshots, String(currentYear))
  let mePensionSavings = 0
  let meIrp = 0
  let spousePensionSavings = 0
  let spouseIrp = 0
  for (const [accountId, snapshot] of pensionSnapshots) {
    const account = pensionAccountMap.get(accountId)
    if (!account) continue
    const amount = Number(snapshot.ytd_contribution)
    if (account.owner === 'spouse') {
      if (account.type === 'pension') spousePensionSavings += amount
      else spouseIrp += amount
    } else {
      if (account.type === 'pension') mePensionSavings += amount
      else meIrp += amount
    }
  }
  const meDeductible = calcDeductible(mePensionSavings, meIrp).total
  const spouseDeductible = calcDeductible(spousePensionSavings, spouseIrp).total
  const totalPension = meDeductible + spouseDeductible
  const householdPensionTarget = TOTAL_DEDUCT_LIMIT * 2

  const composition = buildComposition(netWorthItems, netWorthSnapshots, accountTotals, current.month)
  const latestSnapshotMonth = netWorthSnapshots.at(-1)?.month ?? null
  const latestAccountMonth = accountSnapshots.at(-1)?.month ?? null
  const activeAccountIds = accounts.map(account => account.id)
  const currentAccountIds = new Set(accountSnapshots.filter(snapshot => snapshot.month === currentMonth).map(snapshot => snapshot.account_id))
  const hasCurrentAccountRecord = activeAccountIds.length === 0 || activeAccountIds.every(id => currentAccountIds.has(id))
  const hasCurrentPensionRecord = pensionAccounts.length > 0 && pensionAccounts.every(account => currentAccountIds.has(account.id))
  const today = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  }).format(now)

  return (
    <>
      <div className="page-container dashboard-layout max-w-[1600px]">
        <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end lg:mb-0">
          <div>
            <p className="page-eyebrow">Household finance</p>
            <h1 className="page-title">샘훈호 자산현황</h1>
            <p className="page-subtitle">{today} · 가족 자산의 현재 위치입니다</p>
          </div>
          <Link
            href="/budget"
            className="inline-flex min-h-10 w-fit items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-strong)]"
          >
            이번 달 기록하기
          </Link>
        </header>

        <section aria-label="자산 요약" className="metric-strip dashboard-metrics grid grid-cols-2 lg:grid-cols-4">
          <MetricCard label="순자산" value={current.netWorth} description={`${formatMonth(current.month)} 기준`} tone="net" />
          <MetricCard label="총자산" value={current.assets} description="금융계좌 포함" tone="asset" />
          <MetricCard label="총부채" value={current.liabilities} description="현재 잔액 기준" tone="liability" />
          <MetricCard
            label="최근 월 변화"
            value={netWorthChange}
            description={previous ? `${formatMonth(previous.month)} 대비` : '비교 기록 필요'}
            signed
            unavailable={!previous}
          />
        </section>

        <section className="mt-4 grid min-h-0 grid-cols-1 gap-4 lg:mt-0 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)] lg:gap-3">
          <div className="app-card flex min-h-[340px] flex-col p-5 sm:p-6 lg:min-h-[280px] lg:p-4">
            <CardHeading
              title="밸런스 시트 추이"
              description="월별 기록을 기준으로 샘훈호의 순자산 흐름을 비교합니다"
              href="/net-worth"
              linkLabel="밸런스 시트 보기"
            />
            <HouseholdTrendChart data={trend.slice(-12)} />
          </div>

          <div className="app-card flex min-h-[340px] flex-col p-5 sm:p-6 lg:min-h-[280px] lg:p-4">
            <CardHeading title="자산 구성" description={`${formatMonth(current.month)} 기준`} />
            <AssetComposition items={composition} total={current.assets} />
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:mt-0 lg:grid-cols-3 lg:gap-3">
          <ProgressCard
            eyebrow={`비상금 ${emergencyStage}`}
            title="비상금 목표"
            current={emergencyFund}
            target={emergencyTarget}
            color="var(--color-positive-bright)"
            footer={emergencyFund >= stage2Target ? '5천만 원 목표를 달성했습니다' : `목표까지 ${krw(Math.max(emergencyTarget - emergencyFund, 0))}`}
            href="/budget"
          />

          <PensionProgressCard
            year={currentYear}
            me={meDeductible}
            spouse={spouseDeductible}
            total={totalPension}
            target={householdPensionTarget}
          />

          <MonthlyCheckCard
            currentMonth={currentMonth}
            budgetMonth={latestBudget?.month ?? null}
            netWorthMonth={latestSnapshotMonth}
            accountMonth={latestAccountMonth}
            hasCurrentAccountRecord={hasCurrentAccountRecord}
            hasCurrentPensionRecord={hasCurrentPensionRecord}
            year={currentYear}
          />
        </section>
      </div>
    </>
  )
}

function MetricCard({
  label,
  value,
  description,
  tone,
  signed = false,
  unavailable = false,
}: {
  label: string
  value: number
  description: string
  tone?: 'net' | 'asset' | 'liability'
  signed?: boolean
  unavailable?: boolean
}) {
  const valueColor = tone === 'net'
    ? 'text-[var(--color-positive-strong)]'
    : tone === 'asset'
      ? 'text-[var(--color-primary)]'
      : tone === 'liability'
        ? 'text-[var(--color-negative)]'
        : value > 0
          ? 'text-[var(--color-positive-strong)]'
          : value < 0
            ? 'text-[var(--color-negative)]'
            : 'text-[var(--color-ink)]'
  const accentColor = tone === 'net'
    ? 'border-t-[var(--color-positive-bright)]'
    : tone === 'asset'
      ? 'border-t-[var(--color-primary)]'
      : tone === 'liability'
        ? 'border-t-[var(--color-negative)]'
        : value > 0
          ? 'border-t-[var(--color-positive)]'
          : value < 0
            ? 'border-t-[var(--color-negative)]'
            : 'border-t-[var(--color-border)]'
  const markerColor = tone === 'net'
    ? 'bg-[var(--color-positive-bright)]'
    : tone === 'asset'
      ? 'bg-[var(--color-primary)]'
      : tone === 'liability'
        ? 'bg-[var(--color-negative)]'
        : value > 0
          ? 'bg-[var(--color-positive)]'
          : value < 0
            ? 'bg-[var(--color-negative)]'
            : 'bg-[var(--color-subtle)]'

  return (
    <article className={`metric-cell border-t-[3px] px-4 py-4 sm:px-5 sm:py-5 lg:py-3.5 ${accentColor}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-sm ${markerColor}`} aria-hidden="true" />
        <h2 className="text-sm font-extrabold tracking-[-0.015em] text-[var(--color-ink)]">{label}</h2>
      </div>
      <p className={`mt-2.5 text-xl font-bold tracking-[-0.035em] tabular-nums sm:text-2xl ${valueColor}`}>
        {unavailable ? '—' : `${signed && value > 0 ? '+' : ''}${krw(value)}`}
      </p>
      <p className="mt-1.5 text-[11px] font-medium text-[var(--color-muted)]">{description}</p>
    </article>
  )
}

function CardHeading({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string
  description: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-5 flex shrink-0 items-start justify-between gap-4 lg:mb-2.5">
      <div>
        <h2 className="text-base font-bold tracking-[-0.015em] text-[var(--color-ink)]">{title}</h2>
        <p className="mt-1 text-[11px] text-[var(--color-muted)] sm:text-xs">{description}</p>
      </div>
      {href && linkLabel ? (
        <Link href={href} className="shrink-0 text-[10px] font-semibold text-[var(--color-primary)] hover:underline">
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  )
}

function HouseholdTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-lg bg-[var(--color-section)] px-5 py-6 text-center">
        <p className="text-sm font-semibold text-[var(--color-ink)]">{data.length === 1 ? '첫 자산 기록이 준비되었습니다' : '가족 자산의 흐름을 기록해 보세요'}</p>
        <p className="mt-2 text-xs leading-6 text-[var(--color-muted)]">{data.length === 1 ? `${formatMonth(data[0].month)} 기준 · 순자산 ${krw(data[0].netWorth)}` : '밸런스 시트에서 현재 자산과 부채를 입력해 주세요.'}<br />다음 월 기록부터 자산 변화 그래프가 표시됩니다.</p>
        <Link href="/net-worth" className="mt-4 rounded-sm border border-[var(--color-border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]">밸런스 시트 기록하기 →</Link>
      </div>
    )
  }

  const width = 760
  const height = 250
  const left = 58
  const right = 14
  const top = 16
  const bottom = 32
  const values = data.flatMap(point => [point.assets, point.liabilities, point.netWorth])
  const max = Math.max(...values, 1)
  const min = Math.min(0, ...values)
  const range = max - min || 1
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const x = (index: number) => left + (index / (data.length - 1)) * plotWidth
  const y = (value: number) => top + ((max - value) / range) * plotHeight
  const points = (key: 'assets' | 'liabilities' | 'netWorth') => data
    .map((point, index) => `${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`)
    .join(' ')
  const ticks = [max, min + range / 2, min]
  const labelStep = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap gap-4 text-[10px] text-[var(--color-muted)]">
        <Legend color="#3f7fc3" label="총자산" />
        <Legend color="#dc3f4a" label="총부채" />
        <Legend color="#84cc16" label="순자산" />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-h-0 w-full lg:flex-1" role="img" aria-label="월별 자산, 부채, 순자산 추이">
        {ticks.map((tick, index) => (
          <g key={index}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#d7e1eb" strokeWidth="1" />
            <text x={left - 8} y={y(tick) + 3} textAnchor="end" fill="#93a2b5" fontSize="9">{compactKrw(tick)}</text>
          </g>
        ))}
        <polyline points={points('assets')} fill="none" stroke="#3f7fc3" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={points('liabilities')} fill="none" stroke="#dc3f4a" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={points('netWorth')} fill="none" stroke="#84cc16" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((point, index) => index % labelStep === 0 || index === data.length - 1 ? (
          <text
            key={point.month}
            x={x(index)}
            y={height - 8}
            textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
            fill="#93a2b5"
            fontSize="9"
          >
            {point.month.slice(2).replace('-', '.')}
          </text>
        ) : null)}
      </svg>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function AssetComposition({ items, total }: { items: CompositionItem[]; total: number }) {
  const visibleItems = items.filter(item => item.value > 0)
  const donut = buildConicGradient(visibleItems)

  return (
    <div className="flex min-h-[245px] flex-1 flex-col justify-center lg:min-h-0">
      {visibleItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-canvas)]/55 px-4 py-10 text-center">
          <p className="text-xs text-[var(--color-muted)]">자산 기록을 추가하면 구성이 표시됩니다</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto h-32 w-32 shrink-0 rounded-full lg:h-28 lg:w-28 xl:h-32 xl:w-32" style={{ background: donut }}>
            <div className="absolute inset-[20px] flex flex-col items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-center lg:inset-[18px]">
              <span className="text-[10px] text-[var(--color-muted)]">총자산</span>
              <strong className="mt-1 text-sm tracking-[-0.03em] text-[var(--color-ink)]">{compactKrw(total)}</strong>
            </div>
          </div>
          <div className="mt-4 space-y-2 lg:mt-3">
            {visibleItems.map(item => (
              <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-2 text-[var(--color-muted)]">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="font-semibold tabular-nums text-[var(--color-ink)]">{compactKrw(item.value)}</span>
                <span className="w-10 text-right tabular-nums text-[var(--color-subtle)]">{total > 0 ? Math.round(item.value / total * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ProgressCard({
  eyebrow,
  title,
  current,
  target,
  color,
  footer,
  href,
}: {
  eyebrow: string
  title: string
  current: number
  target: number
  color: string
  footer: string
  href: string
}) {
  const percent = target > 0 ? Math.min(current / target * 100, 100) : 0
  return (
    <article className="app-card p-5 lg:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{eyebrow}</p>
          <h2 className="mt-1 text-sm font-bold text-[var(--color-ink)]">{title}</h2>
        </div>
        <strong className="text-lg tabular-nums text-[var(--color-ink)]">{Math.round(percent)}%</strong>
      </div>
      <div className="mt-6 flex items-end justify-between gap-3 lg:mt-4">
        <strong className="text-base tracking-[-0.025em] text-[var(--color-ink)]">{krw(current)}</strong>
        <span className="text-[10px] text-[var(--color-subtle)]">목표 {krw(target)}</span>
      </div>
      <ProgressBar value={percent} color={color} />
      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] lg:mt-3">
        <span className="text-[var(--color-muted)]">{footer}</span>
        <Link href={href} className="shrink-0 font-semibold text-[var(--color-primary)] hover:underline">기록 →</Link>
      </div>
    </article>
  )
}

function PensionProgressCard({
  year,
  me,
  spouse,
  total,
  target,
}: {
  year: number
  me: number
  spouse: number
  total: number
  target: number
}) {
  const percent = target > 0 ? Math.min(total / target * 100, 100) : 0
  return (
    <article className="app-card p-5 lg:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{year}년 세액공제 기준</p>
          <h2 className="mt-1 text-sm font-bold text-[var(--color-ink)]">연금 납입 달성률</h2>
        </div>
        <strong className="text-lg tabular-nums text-[var(--color-ink)]">{Math.round(percent)}%</strong>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 lg:mt-3">
        <strong className="text-base tracking-[-0.025em] text-[var(--color-ink)]">{krw(total)}</strong>
        <span className="text-[11px] text-[var(--color-subtle)]">부부 목표 {krw(target)}</span>
      </div>
      <ProgressBar value={percent} color="var(--color-positive-bright)" />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:mt-3 lg:gap-2">
        <PersonPension label="나" value={me} />
        <PersonPension label="아내" value={spouse} />
      </div>
      <div className="mt-4 text-right lg:mt-2">
        <Link href="/pension" className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline">연금 현황 →</Link>
      </div>
    </article>
  )
}

function PersonPension({ label, value }: { label: string; value: number }) {
  const percent = Math.min(value / TOTAL_DEDUCT_LIMIT * 100, 100)
  return (
    <div className="rounded-lg bg-[var(--color-canvas)]/75 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="font-semibold text-[var(--color-ink)]">{label}</span>
        <span className="tabular-nums text-[var(--color-muted)]">{Math.round(percent)}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 truncate text-[9px] tabular-nums text-[var(--color-subtle)]">{compactKrw(value)} / 900만</p>
    </div>
  )
}

function MonthlyCheckCard({
  currentMonth,
  budgetMonth,
  netWorthMonth,
  accountMonth,
  hasCurrentAccountRecord,
  hasCurrentPensionRecord,
  year,
}: {
  currentMonth: string
  budgetMonth: string | null
  netWorthMonth: string | null
  accountMonth: string | null
  hasCurrentAccountRecord: boolean
  hasCurrentPensionRecord: boolean
  year: number
}) {
  const hasCurrentBudget = budgetMonth === currentMonth
  const monthlyRecordDone = hasCurrentBudget && hasCurrentAccountRecord
  const monthlyDetail = monthlyRecordDone
    ? `${formatMonth(currentMonth)} 완료`
    : !hasCurrentBudget
      ? '자금 기록 필요'
      : `계좌 평가 필요${accountMonth ? ` · 최근 ${formatMonth(accountMonth)}` : ''}`
  return (
    <article className="app-card p-5 lg:p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">Monthly check</p>
        <h2 className="mt-1 text-sm font-bold text-[var(--color-ink)]">이번 달 기록</h2>
      </div>
      <div className="mt-5 divide-y divide-[var(--color-border)]/75 lg:mt-3">
        <CheckRow label="자금·계좌" href="/budget" done={monthlyRecordDone} detail={monthlyDetail} />
        <CheckRow label="밸런스 시트" href="/net-worth" done={netWorthMonth === currentMonth} detail={netWorthMonth ? `${formatMonth(netWorthMonth)} 기록` : '기록 없음'} />
        <CheckRow label="연금 누적 납입" href="/budget" done={hasCurrentPensionRecord} detail={hasCurrentPensionRecord ? `${year}년 누적액 반영` : `${formatMonth(currentMonth)} 입력 필요`} />
      </div>
    </article>
  )
}

function CheckRow({ label, href, done, detail }: { label: string; href: string; done: boolean; detail: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-center justify-between gap-3 py-2 text-[11px] hover:text-[var(--color-primary)] lg:min-h-10 lg:py-1.5">
      <div>
        <p className="font-semibold text-[var(--color-ink)]">{label}</p>
        <p className="mt-0.5 text-[10px] text-[var(--color-subtle)]">{detail}</p>
      </div>
      <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${done ? 'bg-[var(--color-positive-soft)] text-[var(--color-positive-strong)]' : 'bg-[var(--color-negative-soft)] text-[var(--color-negative-strong)]'}`}>
        {done ? '완료' : '필요'}
      </span>
    </Link>
  )
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--color-border)]/75">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(value, 100))}%`, backgroundColor: color }} />
    </div>
  )
}

function buildTrend(
  items: NetWorthItem[],
  snapshots: NetWorthSnapshot[],
  accountTotals: { month: string; amount: number }[],
): TrendPoint[] {
  const itemMap = new Map(items.map(item => [item.id, item]))
  const snapshotsByMonth = new Map<string, NetWorthSnapshot[]>()
  for (const snapshot of snapshots) {
    const list = snapshotsByMonth.get(snapshot.month) ?? []
    list.push(snapshot)
    snapshotsByMonth.set(snapshot.month, list)
  }

  const portfolioByMonth = new Map(accountTotals.map(snapshot => [snapshot.month, Number(snapshot.amount)]))
  const months = [...new Set([...snapshotsByMonth.keys(), ...portfolioByMonth.keys()])].sort()
  const latestAmounts = new Map<string, number>()
  let latestPortfolio = 0

  return months.map(month => {
    for (const snapshot of snapshotsByMonth.get(month) ?? []) {
      latestAmounts.set(snapshot.item_id, Number(snapshot.amount))
    }
    if (portfolioByMonth.has(month)) latestPortfolio = portfolioByMonth.get(month) ?? 0

    let assets = latestPortfolio
    let liabilities = 0
    for (const [itemId, amount] of latestAmounts) {
      const item = itemMap.get(itemId)
      if (!item || (item.inactive_from_month && month >= item.inactive_from_month)) continue
      if (item.kind === 'asset') assets += amount
      else liabilities += amount
    }
    return { month, assets, liabilities, netWorth: assets - liabilities }
  })
}

function buildComposition(
  items: NetWorthItem[],
  snapshots: NetWorthSnapshot[],
  accountTotals: { month: string; amount: number }[],
  month: string,
): CompositionItem[] {
  const values = new Map<string, number>()
  for (const snapshot of snapshots) {
    if (snapshot.month <= month) values.set(snapshot.item_id, Number(snapshot.amount))
  }

  const grouped = new Map<string, number>()
  const portfolioValue = [...accountTotals].reverse().find(snapshot => snapshot.month <= month)?.amount ?? 0
  if (Number(portfolioValue) > 0) grouped.set('금융계좌', Number(portfolioValue))

  for (const item of items) {
    if (item.kind !== 'asset' || (item.inactive_from_month && month >= item.inactive_from_month)) continue
    const value = values.get(item.id) ?? 0
    if (value <= 0) continue
    const label = CATEGORY_LABEL[item.category] ?? item.name
    grouped.set(label, (grouped.get(label) ?? 0) + value)
  }

  return [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, color: COMPOSITION_COLORS[index % COMPOSITION_COLORS.length] }))
}

function buildConicGradient(items: CompositionItem[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return 'conic-gradient(#d7e1eb 0 100%)'
  let start = 0
  const stops = items.map(item => {
    const end = start + item.value / total * 100
    const stop = `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    start = end
    return stop
  })
  return `conic-gradient(${stops.join(', ')})`
}

function formatMonth(month: string) {
  const [year, value] = month.split('-')
  return `${year}년 ${Number(value)}월`
}

function compactKrw(value: number) {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute >= 100_000_000) {
    const eok = absolute / 100_000_000
    return `${sign}${Number.isInteger(eok) ? eok.toFixed(0) : eok.toFixed(1)}억`
  }
  if (absolute >= 10_000) return `${sign}${Math.round(absolute / 10_000).toLocaleString('ko-KR')}만`
  return `${sign}${Math.round(absolute).toLocaleString('ko-KR')}원`
}
