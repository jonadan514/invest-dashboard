import { Suspense } from 'react'
import { DEFAULT_FINANCIAL_PLAN, type FinancialPlanSettings } from '@/lib/calc/budget'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { Account, AccountMonthlySnapshot, FinancialPlanSettingsRow, MonthlyBudget } from '@/lib/types'
import { expectedMortgagePayment } from '@/lib/calc/mortgage-schedule'
import { stockValueByAccount, type AccountStockValue } from '@/lib/calc/stock-valuation'
import MonthlyForm from './MonthlyForm'
import PlanSettingsForm from './PlanSettingsForm'
import { loadStockPortfolio } from '@/lib/stock-portfolio'
import { krw, kstMonth } from '@/lib/labels'
import { accountRecordState, stageLabel } from '@/lib/calc/monthly-record'
import { buildAccountTotalTrend } from '@/lib/calc/account-snapshots'

export const metadata = { title: '월간 기록' }

function generateMonths(count = 18) {
  // 한국 시간 기준 이번 달에서 2달 뒤부터 count달 전까지.
  const [year, month] = kstMonth().split('-').map(Number)
  const months: string[] = []
  for (let index = -2; index < count; index += 1) {
    const date = new Date(Date.UTC(year, month - 1 - index, 1))
    months.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function toSettings(row: FinancialPlanSettingsRow | null): FinancialPlanSettings {
  if (!row) return DEFAULT_FINANCIAL_PLAN
  return {
    monthlyFixedCost: Number(row.monthly_fixed_cost),
    mortgageInterest: Number(row.mortgage_interest),
    mortgagePrincipal: Number(row.mortgage_principal),
    monthlyJointContribution: Number(row.monthly_joint_contribution),
    currentEmergencyFund: Number(row.current_emergency_fund),
    stage1Target: Number(row.stage1_target),
    stage2Target: Number(row.stage2_target),
    stage2EmergencyRatio: Number(row.stage2_emergency_ratio),
    stage2InvestmentRatio: Number(row.stage2_investment_ratio),
    completedInvestmentRatio: Number(row.completed_investment_ratio),
    completedPropertyRatio: Number(row.completed_property_ratio),
  }
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: requestedMonth } = await searchParams
  const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : kstMonth()
  const { supabase, userId } = await getHouseholdContext()

  const [
    { data: entryData },
    { data: historyData },
    { data: settingsData },
    { data: accountData },
    { data: accountSnapshotData },
    { data: mortgageItemData },
  ] = await Promise.all([
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).eq('month', month).maybeSingle().throwOnError(),
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).order('month', { ascending: false }).limit(24).throwOnError(),
    supabase.from('financial_plan_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order').order('created_at').throwOnError(),
    // 지난 기록 비교와 월별 기록 표의 계좌 합계에 쓰도록 전체를 가져온다.
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).order('month').throwOnError(),
    supabase.from('net_worth_items').select('id, interest_rate, monthly_payment, maturity_date').eq('user_id', userId).eq('category', 'mortgage').eq('is_active', true).throwOnError(),
  ])

  const entry = (entryData ?? null) as MonthlyBudget | null
  const history = (historyData ?? []) as MonthlyBudget[]
  const settingsRow = (settingsData ?? null) as FinancialPlanSettingsRow | null
  const settings = toSettings(settingsRow)
  const accounts = (accountData ?? []) as Account[]
  const accountSnapshots = (accountSnapshotData ?? []) as AccountMonthlySnapshot[]
  // 연금저축·IRP에 매달 정기 납입액이 있으면 올해 누적 납입액을 자동으로 늘린다.
  const accountStates = Object.fromEntries(accounts.map(account => [account.id, accountRecordState(accountSnapshots, account.id, month,
    account.type === 'pension' || account.type === 'irp' ? (account.monthly_payment != null ? Number(account.monthly_payment) : null) : null,
    account.type === 'pension' || account.type === 'irp' ? account.contribution_start_month ?? null : null)]))
  const recordedMonths = [...new Set([...history.map(record => record.month), ...accountSnapshots.map(snapshot => snapshot.month)])]
  const accountTrend = buildAccountTotalTrend(accounts, accountSnapshots)
  const accountTotalByMonth = new Map(accountTrend.map((point, index) => [point.month, { total: point.amount, change: index > 0 ? point.amount - accountTrend[index - 1].amount : null }]))
  const hasAccountSnapshot = accountSnapshots.some(snapshot => snapshot.month === month)

  // 주담대가 하나이고 금리가 있으면, 직전 달 잔액으로 이번 달 이자(잔액 × 금리 ÷ 12, 원 미만 버림)와 원금(월 상환액 또는 만기로 계산)을 미리 채운다.
  const mortgageItems = (mortgageItemData ?? []) as { id: string; interest_rate: number | null; monthly_payment: number | null; maturity_date: string | null }[]
  let mortgageDefaults: { interest: number; principal: number | null } | null = null
  let mortgageBalance: { previous: number; previousMonth: string; manualThisMonth: boolean } | null = null
  if (mortgageItems.length === 1) {
    const [{ data: previousSnapshot }, { data: thisMonthSnapshot }] = await Promise.all([
      supabase.from('net_worth_snapshots').select('amount, month')
        .eq('user_id', userId).eq('item_id', mortgageItems[0].id).lt('month', month)
        .order('month', { ascending: false }).limit(1).maybeSingle().throwOnError(),
      supabase.from('net_worth_snapshots').select('source')
        .eq('user_id', userId).eq('item_id', mortgageItems[0].id).eq('month', month).maybeSingle().throwOnError(),
    ])
    mortgageDefaults = expectedMortgagePayment(previousSnapshot ? Number(previousSnapshot.amount) : null, mortgageItems[0], month)
    if (previousSnapshot) {
      mortgageBalance = { previous: Number(previousSnapshot.amount), previousMonth: previousSnapshot.month, manualThisMonth: thisMonthSnapshot?.source === 'manual' }
    }
  }

  // 주식 계좌 화면의 보유종목 평가액. 현재가는 '지금' 값이라 이번 달 기록에서만 불러오기를 제공한다.
  const stockValues: Record<string, AccountStockValue & { priceDate: string | null }> = {}
  if (month === kstMonth()) {
    const portfolio = await loadStockPortfolio(supabase, userId)
    for (const [accountId, value] of Object.entries(stockValueByAccount(portfolio.holdings))) {
      const dates = portfolio.holdings.filter(holding => holding.account_id === accountId).map(holding => portfolio.priceAsOf.get(holding.asset_id)).filter((date): date is string => Boolean(date))
      stockValues[accountId] = { ...value, priceDate: dates.length > 0 ? dates.sort()[0] : null }
    }
  }

  return (
    <>
      <div className="page-container max-w-[1240px]">
        <div className="mb-5">
          <h1 className="page-title">월간 기록</h1>
        </div>


        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-[#ffffff]" />}>
          <MonthlyForm
            key={`${month}-${settingsRow?.updated_at ?? 'default'}`}
            month={month}
            entry={entry}
            months={generateMonths()}
            settings={settings}
            accounts={accounts}
            accountStates={accountStates}
            recordedMonths={recordedMonths}
            hasAccountSnapshot={hasAccountSnapshot}
            mortgageDefaults={mortgageDefaults}
            mortgageBalance={mortgageBalance}
            stockValues={stockValues}
          />
        </Suspense>

        {history.length > 0 ? (
          <div className="app-card mt-5 overflow-hidden">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-section)] px-4 py-3.5">
              <h2 className="text-base font-bold text-[var(--color-ink)]">월별 기록</h2>
            </div>
            <ul className="divide-y divide-[var(--color-border)] sm:hidden">
              {history.map(record => {
                const emergencyFund = Number(record.cash_balance)
                const principal = Number(record.mortgage_principal) + Number(record.mortgage_extra_principal)
                const stage = emergencyFund >= settings.stage2Target ? stageLabel(settings.stage2Target) : emergencyFund >= settings.stage1Target ? stageLabel(settings.stage1Target) : '달성 전'
                return (
                  <li key={record.id} className={`px-4 py-3.5 ${record.month === month ? 'bg-[var(--color-primary-soft)]' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <a href={`/budget?month=${record.month}`} className="inline-flex min-h-8 items-center text-sm font-bold text-[var(--color-ink)]">
                        {Number(record.month.slice(0, 4))}년 {Number(record.month.slice(5))}월
                      </a>
                      <span className="rounded-full bg-[var(--color-section)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-muted)]">비상금 {stage}</span>
                    </div>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
                      <div className="flex justify-between gap-2"><dt className="text-[var(--color-muted)]">비상금</dt><dd className="tabular-nums">{krw(record.cash_balance)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[var(--color-muted)]">공금</dt><dd className="tabular-nums">{krw(record.joint_savings)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[var(--color-muted)]">성과급</dt><dd className="tabular-nums">{record.bonus_to_plan > 0 ? krw(record.bonus_to_plan) : '-'}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[var(--color-muted)]">원금 상환</dt><dd className="tabular-nums">{principal > 0 ? krw(principal) : '-'}</dd></div>
                      {accountTotalByMonth.has(record.month) ? <div className="col-span-2 flex justify-between gap-2"><dt className="text-[var(--color-muted)]">계좌 평가 합계</dt><dd className="tabular-nums">{krw(accountTotalByMonth.get(record.month)!.total)}<Change value={accountTotalByMonth.get(record.month)!.change} /></dd></div> : null}
                    </dl>
                    {record.memo ? <p className="mt-1.5 text-[12.5px] leading-5 text-[var(--color-muted)]">{record.memo}</p> : null}
                  </li>
                )
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--color-section)] text-[var(--color-muted)]">
                    <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">월</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">비상금</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">공금</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">성과급 포함</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">주담대 원금</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">계좌 평가 합계</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-center font-medium">비상금 목표</th>
                    <th className="px-3 py-2.5 text-left font-medium">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(record => {
                    const [year, monthNumber] = record.month.split('-')
                    const emergencyFund = Number(record.cash_balance)
                    return (
                      <tr key={record.id} className={`border-b border-[var(--color-section)] last:border-0 ${record.month === month ? 'bg-[var(--color-primary-soft)]' : ''}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[var(--color-ink)]">
                          {year}년 {Number(monthNumber)}월
                          {record.month === month ? <span className="ml-1 text-[11.5px] text-[var(--color-primary)]">●</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-ink)]">{krw(record.cash_balance)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-ink)]">{krw(record.joint_savings)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-spouse)]">
                          {record.bonus_to_plan > 0 ? krw(record.bonus_to_plan) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-ink)]">{Number(record.mortgage_principal) + Number(record.mortgage_extra_principal) > 0 ? krw(Number(record.mortgage_principal) + Number(record.mortgage_extra_principal)) : '-'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-ink)]">
                          {accountTotalByMonth.has(record.month) ? <>{krw(accountTotalByMonth.get(record.month)!.total)}<Change value={accountTotalByMonth.get(record.month)!.change} /></> : '-'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${emergencyFund >= settings.stage2Target ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : emergencyFund >= settings.stage1Target ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'bg-[var(--color-section)] text-[var(--color-muted)]'}`}>
                            {emergencyFund >= settings.stage2Target ? stageLabel(settings.stage2Target) : emergencyFund >= settings.stage1Target ? stageLabel(settings.stage1Target) : '달성 전'}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-3 text-[var(--color-muted)]" title={record.memo || undefined}>{record.memo || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <div className="mt-5">
          <PlanSettingsForm settings={settings} />
        </div>
      </div>
    </>
  )
}

function Change({ value }: { value: number | null }) {
  if (value === null || value === 0) return null
  return <span className={`ml-1.5 text-[11.5px] font-semibold ${value > 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{value > 0 ? '+' : '−'}{krw(Math.abs(value))}</span>
}
