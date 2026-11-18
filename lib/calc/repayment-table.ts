import { amortizeMonth } from './mortgage-schedule.ts'
import { addMonths } from './home-insights.ts'
import { daysInMonth, dailyInterest } from './loan-interest.ts'

export interface RepaymentRow {
  month: string
  days: number
  interest: number
  principal: number
  /** 그달 납부액 = 이자 + 정기 원금. */
  total: number
  balanceAfter: number
  kind: 'past' | 'future'
}

/**
 * 월별 상환 내역. 지난 달은 잔액 기록의 변화(원금)와 일수 이자로, 앞으로의 달은 월 상환액과 금리로 계산한다.
 * history는 잔액 기록(오래된 순)이고, 바로 이어진 두 달이 있어야 그 달의 행을 만든다.
 */
export function buildRepaymentTable(input: {
  balance: number
  balanceMonth: string
  annualRate: number | null
  monthlyPayment: number | null
  history: { month: string; amount: number }[]
  pastMonths?: number
  futureMonths?: number
}): RepaymentRow[] {
  const { balance, balanceMonth, annualRate, monthlyPayment, history, pastMonths = 3, futureMonths = 12 } = input
  if (annualRate == null || annualRate < 0) return []

  const past: RepaymentRow[] = []
  for (let index = 1; index < history.length; index++) {
    const previous = history[index - 1]
    const current = history[index]
    if (current.month !== addMonths(previous.month, 1) || current.month > balanceMonth) continue
    const principal = Math.max(Math.round(previous.amount - current.amount), 0)
    const interest = dailyInterest(previous.amount, annualRate, current.month)
    past.push({ month: current.month, days: daysInMonth(current.month), interest, principal, total: interest + principal, balanceAfter: current.amount, kind: 'past' })
  }

  const future: RepaymentRow[] = []
  if (monthlyPayment != null && monthlyPayment > 0) {
    let remaining = balance
    for (let step = 1; step <= futureMonths && remaining > 0; step++) {
      const month = addMonths(balanceMonth, step)
      const { interest, principal } = amortizeMonth(remaining, annualRate, monthlyPayment, month)
      remaining = Math.max(remaining - principal, 0)
      future.push({ month, days: daysInMonth(month), interest, principal, total: interest + principal, balanceAfter: remaining, kind: 'future' })
      if (principal <= 0) break // 월 상환액이 이자보다 작으면 잔액이 줄지 않으니 한 달만 보여 준다.
    }
  }
  return [...past.slice(-pastMonths), ...future]
}
