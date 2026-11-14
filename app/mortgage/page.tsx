import Link from 'next/link'
import { DEFAULT_FINANCIAL_PLAN } from '@/lib/calc/budget'
import { estimateAnnualRate } from '@/lib/calc/mortgage'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { FinancialPlanSettingsRow, MonthlyBudget, NetWorthItem, NetWorthSnapshot } from '@/lib/types'
import MortgageSimulator, { type MortgageLoan } from './MortgageSimulator'

export default async function MortgagePage() {
  const { supabase, userId } = await getHouseholdContext()
  const currentMonth = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date())

  const [{ data: itemRows }, { data: budgetRows }, { data: planRow }] = await Promise.all([
    supabase.from('net_worth_items').select('*').eq('user_id', userId).eq('category', 'mortgage').order('sort_order').throwOnError(),
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).lte('month', currentMonth).order('month', { ascending: false }).limit(1).throwOnError(),
    supabase.from('financial_plan_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
  ])

  const items = ((itemRows ?? []) as NetWorthItem[])
    .filter(item => item.is_active && (!item.inactive_from_month || currentMonth < item.inactive_from_month))
  const latestBudget = ((budgetRows ?? []) as MonthlyBudget[])[0] ?? null
  const plan = planRow as FinancialPlanSettingsRow | null

  const { data: snapshotRows } = items.length > 0
    ? await supabase.from('net_worth_snapshots').select('*').eq('user_id', userId)
      .in('item_id', items.map(item => item.id)).lte('month', currentMonth).order('month').throwOnError()
    : { data: [] }
  const snapshots = (snapshotRows ?? []) as NetWorthSnapshot[]

  // 월간 기록의 이자·원금은 대출이 하나일 때만 그 대출의 값으로 본다.
  const budgetInterest = Number(latestBudget?.mortgage_interest ?? plan?.mortgage_interest ?? DEFAULT_FINANCIAL_PLAN.mortgageInterest)
  const budgetPrincipal = Number(latestBudget?.mortgage_principal ?? plan?.mortgage_principal ?? DEFAULT_FINANCIAL_PLAN.mortgagePrincipal)
  const loans: MortgageLoan[] = items.flatMap(item => {
    const latest = snapshots.filter(snapshot => snapshot.item_id === item.id).at(-1)
    if (!latest || Number(latest.amount) <= 0) return []
    const balance = Number(latest.amount)
    const single = items.length === 1
    const estimatedRate = single ? estimateAnnualRate(balance, budgetInterest) : null
    const rate = item.interest_rate != null ? Number(item.interest_rate) : estimatedRate
    const payment = item.monthly_payment != null
      ? Number(item.monthly_payment)
      : single && budgetInterest + budgetPrincipal > 0 ? budgetInterest + budgetPrincipal : null
    return [{
      id: item.id,
      name: item.name,
      balance,
      balanceMonth: latest.month,
      annualRate: rate,
      rateSource: item.interest_rate != null ? 'item' : estimatedRate != null ? 'estimated' : 'none',
      monthlyPayment: payment,
      paymentSource: item.monthly_payment != null ? 'item' : payment != null ? (latestBudget ? 'budget' : 'plan') : 'none',
      maturityDate: item.maturity_date,
    }]
  })

  return (
    <div className="page-container max-w-[1040px]">
      <header className="mb-5">
        <p className="page-eyebrow">Mortgage payoff</p>
        <h1 className="page-title">대출 상환 계획</h1>
        <p className="page-subtitle">지금 갚는 속도로 언제 끝나는지, 더 갚으면 이자를 얼마나 아끼는지 계산합니다.</p>
      </header>

      {loans.length === 0 ? (
        <div className="app-card p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">잔액이 기록된 주택담보대출이 없어요.</p>
          <p className="mt-1 text-xs text-[var(--color-subtle)]">밸런스 시트에서 분류가 ‘주택담보대출’인 부채를 추가하고 잔액을 기록해 주세요.</p>
          <Link href="/net-worth" className="mt-3 inline-block text-xs font-semibold text-[var(--color-primary)] hover:underline">밸런스 시트로 →</Link>
        </div>
      ) : (
        <MortgageSimulator loans={loans} />
      )}
    </div>
  )
}
