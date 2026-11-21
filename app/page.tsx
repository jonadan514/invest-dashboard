import Link from 'next/link'
import { AlertCircle, CalendarPlus, Check } from 'lucide-react'
import { buildAccountTotalTrend, isAccountActiveAtMonth, latestSnapshotsAtMonth, latestYearContributions } from '@/lib/calc/account-snapshots'
import { DEFAULT_FINANCIAL_PLAN } from '@/lib/calc/budget'
import {
  accountSeries,
  buildTrend,
  goalProgress,
  INVESTMENT_ACCOUNT_TYPES,
  netWorthChangeDrivers,
  pickActiveGoal,
  type MonthValue,
} from '@/lib/calc/home-insights'
import { formatMonth } from '@/lib/labels'
import { getHouseholdContext } from '@/lib/supabase/server'
import ChangeDriversCard from '@/components/ChangeDriversCard'
import GoalCard from '@/components/GoalCard'
import NetWorthHero from '@/components/NetWorthHero'
import MonthEndBanner from '@/components/MonthEndBanner'
import { monthEndReminder } from '@/lib/calc/reminder'
import SavingsCard from '@/components/SavingsCard'
import { averageSavingsRate, buildSavingsSeries } from '@/lib/calc/savings'
import { PensionYearEndBanner } from '@/components/PensionYearEnd'
import type {
  Account,
  AccountMonthlySnapshot,
  FinancialPlanSettingsRow,
  HouseholdGoal,
  HouseholdSettings,
  MonthlyBudget,
  NetWorthItem,
  NetWorthSnapshot,
} from '@/lib/types'
import { trySyncMortgageSchedule } from '@/lib/mortgage-sync'
import { loadStockPortfolio } from '@/lib/stock-portfolio'
import { allocate } from '@/lib/calc/holdings-view'
import { buildStockAlerts } from '@/lib/calc/stock-alerts'
import StockAlerts from '@/components/StockAlerts'
import StockReturnCard from '@/components/StockReturnCard'

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
  await trySyncMortgageSchedule(supabase, userId)
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
    { data: goalsRaw },
    { data: householdSettingsRaw },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('sort_order').throwOnError(),
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).lte('month', currentMonth).order('month', { ascending: false }).limit(12).throwOnError(),
    supabase.from('financial_plan_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('net_worth_items').select('*').eq('user_id', userId).order('sort_order').throwOnError(),
    supabase.from('net_worth_snapshots').select('*').eq('user_id', userId).lte('month', currentMonth).order('month').throwOnError(),
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).lte('month', currentMonth).order('month').throwOnError(),
    supabase.from('household_goals').select('*').eq('user_id', userId).is('achieved_at', null).order('sort_order').order('created_at').throwOnError(),
    supabase.from('household_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
  ])

  const accounts = (accountsRaw ?? []) as Account[]
  const budgets = (budgetsRaw ?? []) as MonthlyBudget[]
  const plan = planRaw as FinancialPlanSettingsRow | null
  const netWorthItems = (netWorthItemsRaw ?? []) as NetWorthItem[]
  const netWorthSnapshots = (netWorthSnapshotsRaw ?? []) as NetWorthSnapshot[]
  const accountSnapshots = (accountSnapshotsRaw ?? []) as AccountMonthlySnapshot[]
  const goals = (goalsRaw ?? []) as HouseholdGoal[]
  const householdSettings = householdSettingsRaw as HouseholdSettings | null
  const accountTotals = buildAccountTotalTrend(accounts, accountSnapshots, currentMonth)
  const activeAccounts = accounts.filter(account => isAccountActiveAtMonth(account, currentMonth))

  const trend = buildTrend(netWorthItems, netWorthSnapshots, accountTotals, currentMonth)
  const current = trend.at(-1) ?? { month: currentMonth, assets: 0, liabilities: 0, netWorth: 0 }
  const previous = trend.at(-2)
  const netWorthChange = previous ? current.netWorth - previous.netWorth : 0

  const latestBudget = budgets[0] ?? null
  const emergencyAccounts = activeAccounts.filter(account => account.is_emergency_fund)
  const hasEmergencyAccounts = accounts.some(account => account.is_emergency_fund)
  const emergencySnapshots = latestSnapshotsAtMonth(accountSnapshots, currentMonth)
  const emergencyFund = hasEmergencyAccounts
    ? emergencyAccounts.reduce((sum, account) => sum + Number(emergencySnapshots.get(account.id)?.evaluation_amount ?? 0), 0)
    : latestBudget
      ? Number(latestBudget.cash_balance)
      : Number(plan?.current_emergency_fund ?? DEFAULT_FINANCIAL_PLAN.currentEmergencyFund)

  const pensionAccounts = accounts.filter(account => account.type === 'pension' || account.type === 'irp')
  const pensionAccountMap = new Map(pensionAccounts.map(account => [account.id, account]))
  const pensionSnapshots = latestYearContributions(accounts, accountSnapshots, String(currentYear), currentMonth)
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
  const pensionRecordMonth = [...pensionSnapshots.values()].reduce<string | null>(
    (latest, snapshot) => (pensionAccountMap.has(snapshot.account_id) && (!latest || snapshot.month > latest) ? snapshot.month : latest), null)
  const todayKst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)

  const composition = buildComposition(netWorthItems, netWorthSnapshots, accountTotals, current.month)
  const latestSnapshotMonth = netWorthSnapshots.at(-1)?.month ?? null
  const latestAccountMonth = accountSnapshots.at(-1)?.month ?? null
  const activeAccountIds = activeAccounts.map(account => account.id)
  const currentAccountIds = new Set(accountSnapshots.filter(snapshot => snapshot.month === currentMonth).map(snapshot => snapshot.account_id))
  const hasCurrentAccountRecord = activeAccountIds.length === 0 || activeAccountIds.every(id => currentAccountIds.has(id))
  const activePensionAccounts = pensionAccounts.filter(account => isAccountActiveAtMonth(account, currentMonth))
  const hasCurrentPensionRecord = activePensionAccounts.length > 0 && activePensionAccounts.every(account => currentAccountIds.has(account.id))
  const monthlyIncome = Number(householdSettings?.monthly_income ?? 0)
  const savingsPoints = buildSavingsSeries(budgets, monthlyIncome, Number(plan?.monthly_fixed_cost ?? DEFAULT_FINANCIAL_PLAN.monthlyFixedCost))
  const savingsAverage = averageSavingsRate(savingsPoints)

  const activeGoal = pickActiveGoal(goals)
  const goalTracking = activeGoal ? goalSeries(activeGoal) : null
  const activeGoalProgress = activeGoal && goalTracking ? goalProgress(Number(activeGoal.target), goalTracking.series) : null
  const changeDrivers = previous
    ? netWorthChangeDrivers({
      accounts,
      accountSnapshots,
      items: netWorthItems,
      itemSnapshots: netWorthSnapshots,
      fromMonth: previous.month,
      toMonth: current.month,
    })
    : []

  function goalSeries(goal: HouseholdGoal): { series: MonthValue[]; basis: string } | null {
    const accountMonths = accountTotals.map(point => point.month)
    switch (goal.type) {
      case 'net_worth':
        return { series: trend.map(point => ({ month: point.month, value: point.netWorth })), basis: '밸런스 시트 순자산 기준' }
      case 'investment':
        return {
          series: accountSeries(accounts, accountSnapshots, accountMonths, account => INVESTMENT_ACCOUNT_TYPES.includes(account.type)),
          basis: '주식·ISA·코인·연금 계좌 평가금액 합계',
        }
      case 'cash':
        if (hasEmergencyAccounts) {
          return { series: accountSeries(accounts, accountSnapshots, accountMonths, account => account.is_emergency_fund), basis: '비상금 계좌 평가금액 합계' }
        }
        return budgets.length > 0
          ? { series: budgets.map(budget => ({ month: budget.month, value: Number(budget.cash_balance) })), basis: '월간 기록의 현금 잔액 기준' }
          : { series: [{ month: currentMonth, value: emergencyFund }], basis: '재무계획의 현재 비상금 기준' }
      default:
        return null
    }
  }

  const reminder = monthEndReminder(todayKst, month => {
    if (!budgets.some(budget => budget.month === month)) return false
    const recorded = new Set(accountSnapshots.filter(snapshot => snapshot.month === month).map(snapshot => snapshot.account_id))
    return accounts.filter(account => isAccountActiveAtMonth(account, month)).every(account => recorded.has(account.id))
  })


  // 주식 계좌 수익률·알림. 조회가 실패해도 홈이 멈추지 않도록 막는다.
  const stock = await loadStockPortfolio(supabase, userId).catch(() => null)
  const stockAccounts = stock ? allocate(stock.holdings, holding => holding.account_id, holding => holding.account_name) : []
  const stockMissing = stock ? stock.holdings.filter(holding => holding.market_value_krw === null).length : 0
  const stockRecorded = new Map<string, { name: string; amount: number }>()
  if (stock) {
    for (const account of accounts) {
      const record = emergencySnapshots.get(account.id)
      if (record && record.month === currentMonth) stockRecorded.set(account.id, { name: account.name, amount: Number(record.evaluation_amount) })
    }
  }
  const stockAlerts = stock ? buildStockAlerts({ holdings: stock.holdings, priceAsOf: stock.priceAsOf, usdKrw: stock.usdKrw, now, recorded: stockRecorded }) : []

  return (
    <>
      <div className="page-container dashboard-layout max-w-[1600px]">
        <NetWorthHero
          current={current}
          previous={previous ?? null}
          trend={trend.slice(-12)}
          composition={composition.map(item => ({ label: item.label, value: item.value }))}
        />

        {/* 월말 기록·주식·연금 마감 알림을 한 상자로 묶는다. 알림이 하나도 없으면 상자도 보이지 않는다(empty:hidden). */}
        <section aria-label="알림" className="app-card divide-y divide-[var(--color-border)] overflow-hidden empty:hidden">
          <MonthEndBanner reminder={reminder} embedded />
          {stockAlerts.length > 0 ? <StockAlerts alerts={stockAlerts} limit={3} embedded /> : null}
          {pensionAccounts.length > 0 ? (
            <PensionYearEndBanner
              embedded
              persons={[{ label: '나', pension: mePensionSavings, irp: meIrp }, { label: '아내', pension: spousePensionSavings, irp: spouseIrp }]}
              today={todayKst}
              recordMonth={pensionRecordMonth}
            />
          ) : null}
        </section>

        <section aria-label="변화와 목표" className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <ChangeDriversCard
            fromMonth={previous?.month ?? null}
            toMonth={current.month}
            totalChange={netWorthChange}
            drivers={changeDrivers}
          />
          <GoalCard goal={activeGoal} progress={activeGoalProgress} basis={goalTracking?.basis ?? null} />
          <SavingsCard points={savingsPoints} average={savingsAverage} hasIncome={monthlyIncome > 0} />
        </section>

        <StockReturnCard accounts={stockAccounts} missing={stockMissing} />

        <section aria-label="이번 달 기록">
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
  const items = [
    { label: '자금·계좌', href: '/budget', done: monthlyRecordDone, detail: monthlyDetail },
    { label: '밸런스 시트', href: '/net-worth', done: netWorthMonth === currentMonth, detail: netWorthMonth ? `${formatMonth(netWorthMonth)} 기록` : '기록 없음' },
    { label: '연금 누적', href: '/budget', done: hasCurrentPensionRecord, detail: hasCurrentPensionRecord ? `${year}년 누적액 반영` : `${formatMonth(currentMonth)} 입력 필요` },
  ]
  const remaining = items.filter(item => !item.done).length
  return (
    <article className="app-card flex flex-col p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-[var(--color-ink)]">{formatMonth(currentMonth).replace(/^\d+년 /, '')} 기록</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${remaining === 0 ? 'bg-[var(--color-positive-soft)] text-[var(--color-positive)]' : 'bg-[var(--color-negative-soft)] text-[var(--color-negative)]'}`}>
          {remaining === 0 ? '모두 완료' : `${remaining}개 남음`}
        </span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {items.map(item => (
          <li key={item.label}>
            <Link
              href={item.href}
              title={item.detail}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-3 py-1 text-[12.5px] font-semibold ${item.done ? 'border-transparent bg-[var(--color-section)] text-[var(--color-muted)]' : 'border-[var(--color-negative)]/40 bg-white text-[var(--color-negative)]'}`}
            >
              {item.done ? <Check size={13} strokeWidth={2.5} aria-hidden="true" /> : <AlertCircle size={13} aria-hidden="true" />} {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <a href="/api/calendar/month-end" download className="mt-auto flex min-h-10 items-center gap-1.5 pt-2 text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">
        <CalendarPlus size={14} aria-hidden="true" /> 휴대폰 캘린더에 매달 말일 알림 추가
      </a>
    </article>
  )
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

