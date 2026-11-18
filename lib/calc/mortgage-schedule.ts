import { addMonths } from './home-insights.ts'
import { levelPayment, monthlyInterest, monthsBetween } from './loan-interest.ts'

export interface MortgageItemTerms {
  id: string
  /** 연 금리(%). 없으면 스케줄을 만들 수 없다. */
  interest_rate: number | null
  /** 매달 내는 원리금 합계. 없으면 만기로 계산한다. */
  monthly_payment: number | null
  /** 약정 만기일('YYYY-MM-DD'). 월 상환액이 없을 때 남은 회차를 구하는 데 쓴다. */
  maturity_date?: string | null
  inactive_from_month: string | null
}

export interface MortgageSnapshotRow {
  month: string
  amount: number
  source: 'manual' | 'mortgage_auto' | string
}

export interface ScheduledMonth {
  month: string
  balance: number
  interest: number
  principal: number
  /** budget: 월간 기록의 원금(정기+추가)을 썼다. schedule: 원리금균등 스케줄로 계산했다. */
  basis: 'budget' | 'schedule'
}

/** 원리금균등 한 달: 이자는 잔액 × 연금리 ÷ 12(원 미만 버림), 원금은 월 상환액에서 이자를 뺀 값(잔액을 넘지 않음). */
export function amortizeMonth(balance: number, annualRatePercent: number, monthlyPayment: number) {
  const interest = monthlyInterest(balance, annualRatePercent)
  const principal = Math.max(Math.min(Math.round(monthlyPayment - interest), Math.max(balance, 0)), 0)
  return { interest, principal }
}

/**
 * 월 상환액. 직접 입력한 값이 있으면 그 값을, 없으면 balanceMonth 잔액과 만기까지 남은 회차로 계산한다.
 * balanceMonth는 그 잔액이 '납부 후' 잔액인 달이다(다음 달부터 남은 회차를 센다).
 */
export function resolveMonthlyPayment(
  item: Pick<MortgageItemTerms, 'interest_rate' | 'monthly_payment' | 'maturity_date'>,
  balance: number,
  balanceMonth: string,
) {
  if (item.monthly_payment != null && Number(item.monthly_payment) > 0) return { amount: Number(item.monthly_payment), source: 'item' as const }
  if (item.interest_rate == null || !item.maturity_date) return null
  const amount = levelPayment(balance, Number(item.interest_rate), monthsBetween(balanceMonth, item.maturity_date.slice(0, 7)))
  return amount === null ? null : { amount, source: 'maturity' as const }
}

/**
 * 직접 입력한 잔액(수동 기록)을 기준점으로 throughMonth까지 매달 잔액을 만든다.
 * - 수동 기록이 있는 달은 그 값을 그대로 쓰고 결과에 넣지 않는다(덮어쓰지 않는다).
 * - 월간 기록의 원금이 있는 달은 그 금액만큼 줄인다.
 * - 그 외의 달은 금리와 월 납입액으로 원리금균등 원금을 계산해 줄인다. 조건이 없으면 그달은 건너뛴다.
 * 결과는 자동으로 저장할 달(mortgage_auto)의 목록이다.
 */
export function buildMortgageSchedule(input: {
  item: MortgageItemTerms
  snapshots: MortgageSnapshotRow[]
  /** 월별 원금(정기+추가). 주담대가 하나일 때만 넘긴다. */
  budgetPrincipal: Map<string, number> | null
  throughMonth: string
}): ScheduledMonth[] {
  const manual = new Map(input.snapshots.filter(row => row.source === 'manual').map(row => [row.month, Number(row.amount)]))
  if (manual.size === 0) return []
  const start = [...manual.keys()].sort()[0]
  const rate = input.item.interest_rate != null ? Number(input.item.interest_rate) : null
  const payment = resolveMonthlyPayment(input.item, manual.get(start)!, start)?.amount ?? null
  const canSchedule = rate != null && rate >= 0 && payment != null && payment > 0

  const result: ScheduledMonth[] = []
  let balance = manual.get(start)!
  for (let month = addMonths(start, 1); month <= input.throughMonth; month = addMonths(month, 1)) {
    if (input.item.inactive_from_month && month >= input.item.inactive_from_month) break
    const anchor = manual.get(month)
    if (anchor !== undefined) {
      balance = anchor
      continue
    }
    if (balance <= 0) continue
    const fromBudget = input.budgetPrincipal?.get(month)
    if (fromBudget !== undefined) {
      const interest = rate != null ? monthlyInterest(balance, rate) : 0
      const principal = Math.min(Math.max(fromBudget, 0), balance)
      balance -= principal
      result.push({ month, balance, interest, principal, basis: 'budget' })
    } else if (canSchedule) {
      const { interest, principal } = amortizeMonth(balance, rate!, payment!)
      balance -= principal
      result.push({ month, balance, interest, principal, basis: 'schedule' })
    }
  }
  return result
}

/**
 * 선택한 달 직전 잔액으로 그달 이자와 원금 예상치를 구한다(월간 기록 자동 채우기용).
 * 월 상환액은 직접 입력한 값, 없으면 만기로 계산한 값을 쓴다. 둘 다 없으면 이자만 채우고 원금은 null이다.
 */
export function expectedMortgagePayment(
  previousBalance: number | null,
  item: Pick<MortgageItemTerms, 'interest_rate' | 'monthly_payment' | 'maturity_date'> | null,
  month: string,
): { interest: number; principal: number | null } | null {
  if (!item || previousBalance == null || previousBalance <= 0 || item.interest_rate == null) return null
  const rate = Number(item.interest_rate)
  const payment = resolveMonthlyPayment(item, previousBalance, addMonths(month, -1))
  if (!payment) return { interest: monthlyInterest(previousBalance, rate), principal: null }
  return amortizeMonth(previousBalance, rate, payment.amount)
}
