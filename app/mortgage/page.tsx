import Link from 'next/link'
import TabNav from '@/components/TabNav'
import { DEFAULT_FINANCIAL_PLAN } from '@/lib/calc/budget'
import { estimateAnnualRate } from '@/lib/calc/mortgage'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { FinancialPlanSettingsRow, MonthlyBudget, NetWorthItem, NetWorthSnapshot } from '@/lib/types'
import LoanRepayment, { type LoanOverview } from './RepaymentTable'
import PrepaymentCalculator from './PrepaymentCalculator'
import { resolveMonthlyPayment } from '@/lib/calc/mortgage-schedule'
import { buildRepaymentTable } from '@/lib/calc/repayment-table'
import { monthsBetween } from '@/lib/calc/loan-interest'
import { trySyncMortgageSchedule } from '@/lib/mortgage-sync'

export const metadata = { title: '대출 상환' }

export default async function MortgagePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === 'prepay' ? 'prepay' : 'status'
  const { supabase, userId } = await getHouseholdContext()
  await trySyncMortgageSchedule(supabase, userId)
  const currentMonth = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date())

  const [{ data: itemRows }, { data: budgetRows }, { data: planRow }] = await Promise.all([
    supabase.from('net_worth_items').select('*').eq('user_id', userId).eq('category', 'mortgage').order('sort_order').throwOnError(),
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).lte('month', currentMonth).order('month', { ascending: false }).limit(12).throwOnError(),
    supabase.from('financial_plan_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
  ])

  const items = ((itemRows ?? []) as NetWorthItem[])
    .filter(item => item.is_active && (!item.inactive_from_month || currentMonth < item.inactive_from_month))
  const recentBudgets = (budgetRows ?? []) as MonthlyBudget[]
  const latestBudget = recentBudgets[0] ?? null
  const plan = planRow as FinancialPlanSettingsRow | null

  const { data: snapshotRows } = items.length > 0
    ? await supabase.from('net_worth_snapshots').select('*').eq('user_id', userId)
      .in('item_id', items.map(item => item.id)).lte('month', currentMonth).order('month').throwOnError()
    : { data: [] }
  const snapshots = (snapshotRows ?? []) as NetWorthSnapshot[]

  // 월간 기록의 이자·원금은 대출이 하나일 때만 그 대출의 값으로 본다.
  const budgetInterest = Number(latestBudget?.mortgage_interest ?? plan?.mortgage_interest ?? DEFAULT_FINANCIAL_PLAN.mortgageInterest)
  const budgetPrincipal = Number(latestBudget?.mortgage_principal ?? plan?.mortgage_principal ?? DEFAULT_FINANCIAL_PLAN.mortgagePrincipal)
  const loans = items.flatMap(item => {
    const itemSnapshots = snapshots.filter(snapshot => snapshot.item_id === item.id)
    const latest = itemSnapshots.at(-1)
    if (!latest || Number(latest.amount) <= 0) return []
    const balance = Number(latest.amount)
    const single = items.length === 1
    const estimatedRate = single ? estimateAnnualRate(balance, budgetInterest) : null
    const rate = item.interest_rate != null ? Number(item.interest_rate) : estimatedRate
    const resolved = resolveMonthlyPayment({ interest_rate: rate, monthly_payment: item.monthly_payment, maturity_date: item.maturity_date }, balance, latest.month)
    const budgetPayment = single && budgetInterest + budgetPrincipal > 0 ? budgetInterest + budgetPrincipal : null
    const payment = resolved?.amount ?? budgetPayment
    const overview: LoanOverview = {
      id: item.id,
      name: item.name,
      balance,
      balanceMonth: latest.month,
      annualRate: rate,
      rateSource: item.interest_rate != null ? 'item' : estimatedRate != null ? 'estimated' : 'none',
      monthlyPayment: payment,
      paymentSource: resolved?.source ?? (budgetPayment != null ? 'budget' : 'none'),
      maturityDate: item.maturity_date,
      remainingPayments: item.maturity_date ? Math.max(monthsBetween(latest.month, item.maturity_date.slice(0, 7)), 0) : null,
    }
    // 월간 기록의 이자·원금은 가구 전체 값이라 대출이 하나일 때만 그 대출의 실제 납부 내역으로 본다.
    const recorded = single
      ? recentBudgets.filter(row => Number(row.mortgage_interest) > 0 || Number(row.mortgage_principal) > 0 || Number(row.mortgage_extra_principal) > 0)
        .map(row => ({ month: row.month, interest: Number(row.mortgage_interest), principal: Number(row.mortgage_principal), extra: Number(row.mortgage_extra_principal) }))
      : []
    const table = buildRepaymentTable({
      balance, balanceMonth: latest.month, annualRate: rate, monthlyPayment: payment,
      history: itemSnapshots.map(snapshot => ({ month: snapshot.month, amount: Number(snapshot.amount) })), recorded,
    })
    return [{ overview, startDate: item.start_date, ...table }]
  })

  return (
    <div className="page-container max-w-[1240px]">
      <header className="mb-5">
        <p className="page-eyebrow">Mortgage payoff</p>
        <h1 className="page-title">대출 상환</h1>
        <p className="page-subtitle">대출 잔액과 상환 이력, 앞으로의 월별 상환 일정을 보여 줍니다. 대출 정보는 밸런스 시트에서 고쳐요.</p>
      </header>

      {loans.length === 0 ? (
        <div className="app-card p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">잔액이 기록된 주택담보대출이 없어요.</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-subtle)]">밸런스 시트에서 분류가 ‘주택담보대출’인 부채를 추가하고 잔액을 기록해 주세요.</p>
          <Link href="/net-worth?view=settings" className="mt-3 inline-block text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">밸런스 시트로 →</Link>
        </div>
      ) : (
        <>
          {(() => {
            const autoReady = items.length > 0 && items.every(item => item.interest_rate != null && (item.monthly_payment != null || item.maturity_date))
            return (
              <p className={`mb-4 rounded-xl px-4 py-3 text-[13px] leading-6 ${autoReady ? 'bg-[var(--color-positive-soft)] text-[var(--color-positive-strong)]' : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'}`}>
                {autoReady
                  ? '자동 상환 켜짐 · 매달 잔액이 줄고, 월간 기록의 이자·원금도 미리 채워져요. 직접 입력한 잔액이 있으면 그 값을 기준으로 다시 계산해요.'
                  : '밸런스 시트의 주택담보대출 항목에 연 금리와 월 상환액(또는 만기)을 입력하면 잔액과 월간 기록의 이자·원금이 매달 자동으로 채워져요.'}
              </p>
            )
          })()}
          <div className="mb-4">
            <TabNav label="대출 상환 탭" active={tab} items={[{ value: 'status', label: '상환 현황', href: '/mortgage' }, { value: 'prepay', label: '한 번에 더 갚기', href: '/mortgage?tab=prepay' }]} />
          </div>
          <div className="space-y-8">
            {loans.map(loan => tab === 'prepay' ? (
              <PrepaymentCalculator key={loan.overview.id} loan={{
                id: loan.overview.id, name: loan.overview.name, balance: loan.overview.balance, balanceMonth: loan.overview.balanceMonth,
                annualRate: loan.overview.annualRate, monthlyPayment: loan.overview.monthlyPayment, startDate: loan.startDate,
              }} />
            ) : (
              <LoanRepayment key={loan.overview.id} loan={loan.overview} past={loan.past} future={loan.future} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
