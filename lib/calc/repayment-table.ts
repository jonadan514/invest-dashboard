import { amortizeMonth } from './mortgage-schedule.ts'
import { addMonths } from './home-insights.ts'
import { monthlyInterest } from './loan-interest.ts'

export interface RepaymentRow {
  month: string
  interest: number
  principal: number
  /** 그달 납부액 = 이자 + 정기 원금. */
  total: number
  /** 월간 기록에 적은 추가 원금 상환. */
  extra?: number
  /** 납부 후 잔액. 잔액 기록이 없는 달은 null. */
  balanceAfter: number | null
  kind: 'past' | 'future'
  /** 월간 기록에 적은 이자·원금을 그대로 썼다. */
  recorded?: boolean
}

/**
 * 상환 이력(past)과 앞으로의 월별 상환 예정(future).
 * - 이력: 월간 기록에 적은 이자·원금이 있으면 그 값을, 없으면 잔액 기록(history, 오래된 순)에서
 *   바로 이어진 두 달의 차이(원금)와 직전 잔액 × 연금리 ÷ 12(이자)로 만든다.
 * - 예정: balanceMonth 잔액에서 월 상환액(원리금 고정)으로 매달 이자를 떼고 남은 금액을 원금으로 갚는다.
 */
export function buildRepaymentTable(input: {
  balance: number
  balanceMonth: string
  annualRate: number | null
  monthlyPayment: number | null
  history: { month: string; amount: number }[]
  recorded?: { month: string; interest: number; principal: number; extra?: number }[]
  pastMonths?: number
  futureMonths?: number
}): { past: RepaymentRow[]; future: RepaymentRow[] } {
  const { balance, balanceMonth, annualRate, monthlyPayment, history, recorded = [], pastMonths = 12, futureMonths = 12 } = input
  const balanceOf = new Map(history.map(row => [row.month, row.amount]))
  const byMonth = new Map<string, RepaymentRow>()
  if (annualRate != null && annualRate >= 0) {
    for (let index = 1; index < history.length; index++) {
      const previous = history[index - 1]
      const current = history[index]
      if (current.month !== addMonths(previous.month, 1) || current.month > balanceMonth) continue
      const principal = Math.max(Math.round(previous.amount - current.amount), 0)
      const interest = monthlyInterest(previous.amount, annualRate)
      byMonth.set(current.month, { month: current.month, interest, principal, total: interest + principal, balanceAfter: current.amount, kind: 'past' })
    }
  }
  for (const row of recorded) {
    if (row.month > balanceMonth) continue
    const interest = Math.round(row.interest)
    const principal = Math.round(row.principal)
    byMonth.set(row.month, { month: row.month, interest, principal, total: interest + principal, extra: Math.round(row.extra ?? 0), balanceAfter: balanceOf.get(row.month) ?? null, kind: 'past', recorded: true })
  }
  const past = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, pastMonths)

  const future: RepaymentRow[] = []
  if (annualRate != null && annualRate >= 0 && monthlyPayment != null && monthlyPayment > 0) {
    let remaining = balance
    for (let step = 1; step <= futureMonths && remaining > 0; step++) {
      const month = addMonths(balanceMonth, step)
      const { interest, principal } = amortizeMonth(remaining, annualRate, monthlyPayment)
      remaining = Math.max(remaining - principal, 0)
      future.push({ month, interest, principal, total: interest + principal, balanceAfter: remaining, kind: 'future' })
      if (principal <= 0) break // 월 상환액이 이자보다 작으면 잔액이 줄지 않는다.
    }
  }
  return { past, future }
}
