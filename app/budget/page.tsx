import { Suspense } from 'react'
import { DEFAULT_FINANCIAL_PLAN, type FinancialPlanSettings } from '@/lib/calc/budget'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { Account, AccountMonthlySnapshot, FinancialPlanSettingsRow, MonthlyBudget } from '@/lib/types'
import MonthlyForm from './MonthlyForm'
import PlanSettingsForm from './PlanSettingsForm'

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

  const [
    { data: entryData },
    { data: historyData },
    { data: settingsData },
    { data: accountData },
    { data: accountSnapshotData },
  ] = await Promise.all([
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).eq('month', month).maybeSingle().throwOnError(),
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).order('month', { ascending: false }).limit(24).throwOnError(),
    supabase.from('financial_plan_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order').order('created_at').throwOnError(),
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).lte('month', month).order('month').throwOnError(),
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
          />
        </Suspense>

        {history.length > 0 ? (
          <div className="app-card mt-5 overflow-hidden">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-section)] px-4 py-3.5">
              <h2 className="text-base font-bold text-[var(--color-ink)]">월별 기록</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#edf3f8] text-[#65758a]">
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
                      <tr key={record.id} className={`border-b border-[#f3f7fb] last:border-0 ${record.month === month ? 'bg-blue-50' : ''}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[#172233]">
                          {year}년 {Number(monthNumber)}월
                          {record.month === month ? <span className="ml-1 text-[10px] text-[#3f7fc3]">●</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[#172233]">{formatKrw(record.cash_balance)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[#172233]">{formatKrw(record.joint_savings)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[#6b3fa0]">
                          {record.bonus_to_plan > 0 ? formatKrw(record.bonus_to_plan) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-[#172233]">{Number(record.mortgage_principal) + Number(record.mortgage_extra_principal) > 0 ? formatKrw(Number(record.mortgage_principal) + Number(record.mortgage_extra_principal)) : '-'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${emergencyFund >= settings.stage2Target ? 'bg-blue-100 text-blue-700' : emergencyFund >= settings.stage1Target ? 'bg-amber-100 text-amber-700' : 'bg-[#edf3f8] text-[#65758a]'}`}>
                            {emergencyFund >= settings.stage2Target ? '5천만 달성' : emergencyFund >= settings.stage1Target ? '3천만 달성' : '달성 전'}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-3 text-[#65758a]">{record.memo || '-'}</td>
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
