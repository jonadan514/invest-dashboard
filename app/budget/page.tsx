import { Suspense } from 'react'
import { DEFAULT_FINANCIAL_PLAN, type FinancialPlanSettings } from '@/lib/calc/budget'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { Account, AccountMonthlySnapshot, FinancialPlanSettingsRow, MonthlyBudget } from '@/lib/types'
import { expectedMortgagePayment } from '@/lib/calc/mortgage-schedule'
import { buildHoldings, type PriceRow } from '@/lib/calc/holdings'
import { stockValueByAccount, type AccountStockValue } from '@/lib/calc/stock-valuation'
import type { Asset } from '@/lib/types'
import MonthlyForm from './MonthlyForm'
import PlanSettingsForm from './PlanSettingsForm'
import { trySyncMortgageSchedule } from '@/lib/mortgage-sync'

export const metadata = { title: '월간 기록' }

function formatKrw(value: number) {
  return `₩${new Intl.NumberFormat('ko-KR').format(Math.round(value))}`
}

function generateMonths(count = 18) {
  const months: string[] = []
  const now = new Date()
  for (let index = -2; index < count; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
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
  const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : currentMonth()
  const { supabase, userId } = await getHouseholdContext()
  await trySyncMortgageSchedule(supabase, userId)

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
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).lte('month', month).order('month').throwOnError(),
    supabase.from('net_worth_items').select('id, interest_rate, monthly_payment, maturity_date').eq('user_id', userId).eq('category', 'mortgage').eq('is_active', true).throwOnError(),
  ])

  const entry = (entryData ?? null) as MonthlyBudget | null
  const history = (historyData ?? []) as MonthlyBudget[]
  const settingsRow = (settingsData ?? null) as FinancialPlanSettingsRow | null
  const settings = toSettings(settingsRow)
  const accounts = (accountData ?? []) as Account[]
  const accountSnapshots = (accountSnapshotData ?? []) as AccountMonthlySnapshot[]
  const latestByAccount = new Map<string, AccountMonthlySnapshot>()
  const exactByAccount = new Map<string, AccountMonthlySnapshot>()
  for (const snapshot of accountSnapshots) latestByAccount.set(snapshot.account_id, snapshot)
  for (const snapshot of accountSnapshots) {
    if (snapshot.month === month) exactByAccount.set(snapshot.account_id, snapshot)
  }
  const initialAccountValues = Object.fromEntries(accounts.map(account => {
    const snapshot = latestByAccount.get(account.id)
    const exact = exactByAccount.get(account.id)
    return [account.id, {
      evaluationAmount: Number(snapshot?.evaluation_amount ?? 0),
      monthlyAllocation: Number(exact?.monthly_allocation ?? 0),
      ytdContribution: snapshot?.month.startsWith(`${month.slice(0, 4)}-`)
        ? Number(snapshot.ytd_contribution)
        : 0,
    }]
  }))
  const hasAccountSnapshot = accountSnapshots.some(snapshot => snapshot.month === month)

  // 주담대가 하나이고 금리가 있으면, 직전 달 잔액으로 이번 달 이자(잔액 × 금리 ÷ 12, 원 미만 버림)와 원금(월 상환액 또는 만기로 계산)을 미리 채운다.
  const mortgageItems = (mortgageItemData ?? []) as { id: string; interest_rate: number | null; monthly_payment: number | null; maturity_date: string | null }[]
  let mortgageDefaults: { interest: number; principal: number | null } | null = null
  if (mortgageItems.length === 1) {
    const { data: previousSnapshot } = await supabase.from('net_worth_snapshots').select('amount')
      .eq('user_id', userId).eq('item_id', mortgageItems[0].id).lt('month', month)
      .order('month', { ascending: false }).limit(1).maybeSingle().throwOnError()
    mortgageDefaults = expectedMortgagePayment(previousSnapshot ? Number(previousSnapshot.amount) : null, mortgageItems[0], month)
  }

  // 주식 계좌 화면의 보유종목 평가액. 현재가는 '지금' 값이라 이번 달 기록에서만 불러오기를 제공한다.
  const stockValues: Record<string, AccountStockValue & { priceDate: string | null }> = {}
  if (month === currentMonth()) {
    const [{ data: assetRows }, { data: tradeRows }, { data: fxRow }] = await Promise.all([
      supabase.from('assets').select('*').eq('user_id', userId).throwOnError(),
      supabase.from('transactions').select('date, created_at, account_id, asset_id, type, quantity, price, amount, fee, tax, fx_rate')
        .eq('user_id', userId).in('type', ['buy', 'sell']).throwOnError(),
      supabase.from('fx_rates').select('rate').eq('pair', 'USDKRW').maybeSingle().throwOnError(),
    ])
    const assets = (assetRows ?? []) as Asset[]
    if (assets.length > 0 && (tradeRows ?? []).length > 0) {
      const { data: priceRows } = await supabase.from('prices').select('asset_id, price, prev_close, currency, as_of')
        .in('asset_id', assets.map(asset => asset.id)).throwOnError()
      const usdKrw = fxRow ? Number(fxRow.rate) : null
      const priceMap = new Map<string, PriceRow>()
      const priceDates = new Map<string, string>()
      for (const row of priceRows ?? []) {
        if (row.currency === 'USD' && usdKrw === null) continue
        priceMap.set(row.asset_id, { asset_id: row.asset_id, price: Number(row.price), prev_close: row.prev_close, currency: row.currency })
        priceDates.set(row.asset_id, row.as_of)
      }
      const holdings = buildHoldings(tradeRows ?? [], assets, accounts, priceMap, usdKrw ?? 1)
      for (const [accountId, value] of Object.entries(stockValueByAccount(holdings))) {
        const dates = holdings.filter(holding => holding.account_id === accountId).map(holding => priceDates.get(holding.asset_id)).filter((date): date is string => Boolean(date))
        stockValues[accountId] = { ...value, priceDate: dates.length > 0 ? dates.sort()[0] : null }
      }
    }
  }

  return (
    <>
      <div className="page-container max-w-[1240px]">
        <div className="mb-5">
          <p className="page-eyebrow">Monthly household record</p>
          <h1 className="page-title">월간 기록</h1>
          <p className="page-subtitle">매월 자금 흐름과 계좌 평가금액을 한 번에 기록합니다.</p>
        </div>

        <PlanSettingsForm settings={settings} />

        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-[#ffffff]" />}>
          <MonthlyForm
            key={`${month}-${settingsRow?.updated_at ?? 'default'}`}
            month={month}
            entry={entry}
            months={generateMonths()}
            settings={settings}
            accounts={accounts}
            initialAccountValues={initialAccountValues}
            hasAccountSnapshot={hasAccountSnapshot}
            mortgageDefaults={mortgageDefaults}
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
                const stage = emergencyFund >= settings.stage2Target ? '5천만 달성' : emergencyFund >= settings.stage1Target ? '3천만 달성' : '달성 전'
                return (
                  <li key={record.id} className={`px-4 py-3.5 ${record.month === month ? 'bg-[var(--color-primary-soft)]' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <a href={`/budget?month=${record.month}`} className="inline-flex min-h-8 items-center text-[14px] font-bold text-[var(--color-ink)]">
                        {Number(record.month.slice(0, 4))}년 {Number(record.month.slice(5))}월
                      </a>
                      <span className="rounded-full bg-[var(--color-section)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-muted)]">비상금 {stage}</span>
                    </div>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
                      <div className="flex justify-between gap-2"><dt className="text-[var(--color-muted)]">비상금</dt><dd className="tabular-nums">{formatKrw(record.cash_balance)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[var(--color-muted)]">공금</dt><dd className="tabular-nums">{formatKrw(record.joint_savings)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[var(--color-muted)]">성과급</dt><dd className="tabular-nums">{record.bonus_to_plan > 0 ? formatKrw(record.bonus_to_plan) : '-'}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[var(--color-muted)]">원금 상환</dt><dd className="tabular-nums">{principal > 0 ? formatKrw(principal) : '-'}</dd></div>
                    </dl>
                    {record.memo ? <p className="mt-1.5 text-[12.5px] leading-5 text-[var(--color-muted)]">{record.memo}</p> : null}
                  </li>
                )
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-section)] text-[var(--color-muted)]">
                    <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">월</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">비상금</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">공금</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">성과급 포함</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">주담대 원금</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-center font-medium">비상금 목표</th>
                    <th className="px-3 py-2.5 text-left font-medium">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(record => {
                    const [year, monthNumber] = record.month.split('-')
                    const emergencyFund = Number(record.cash_balance)
                    return (
                      <tr key={record.id} className={`border-b border-[var(--color-section)] last:border-0 ${record.month === month ? 'bg-blue-50' : ''}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[var(--color-ink)]">
                          {year}년 {Number(monthNumber)}월
                          {record.month === month ? <span className="ml-1 text-[11.5px] text-[var(--color-primary)]">●</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-ink)]">{formatKrw(record.cash_balance)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-ink)]">{formatKrw(record.joint_savings)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-spouse)]">
                          {record.bonus_to_plan > 0 ? formatKrw(record.bonus_to_plan) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--color-ink)]">{Number(record.mortgage_principal) + Number(record.mortgage_extra_principal) > 0 ? formatKrw(Number(record.mortgage_principal) + Number(record.mortgage_extra_principal)) : '-'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${emergencyFund >= settings.stage2Target ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : emergencyFund >= settings.stage1Target ? 'bg-amber-100 text-amber-700' : 'bg-[var(--color-section)] text-[var(--color-muted)]'}`}>
                            {emergencyFund >= settings.stage2Target ? '5천만 달성' : emergencyFund >= settings.stage1Target ? '3천만 달성' : '달성 전'}
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
      </div>
    </>
  )
}
