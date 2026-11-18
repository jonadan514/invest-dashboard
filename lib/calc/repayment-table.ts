import { amortizeMonth } from './mortgage-schedule.ts'
import { addMonths } from './home-insights.ts'
import { dailyInterest, interestDays } from './loan-interest.ts'

export interface RepaymentRow {
  month: string
  days: number
  interest: number
  principal: number
  /** 그달 납부액 = 이자 + 정기 원금. */
  total: number
  /** 그달 잔액 기록이 없으면 null. */
  balanceAfter: number | null
  kind: 'past' | 'future'
  /** 월간 기록에 적은 실제 이자·원금을 썼다. */
  recorded?: boolean
}

/**
 * 월별 상환 내역. 지난 달은 잔액 기록의 변화(원금)와 일수 이자로, 앞으로의 달은 월 상환액과 금리로 계산한다.
 * 지난 달은 월간 기록에 적은 실제 이자·원금(recorded)이 있으면 그 값을 쓰고, 없으면 잔액 기록(history, 오래된 순)에서
 * 바로 이어진 두 달의 차이로 만든다. 일수는 이자 기간(전달 일수)이다.
 */
export function buildRepaymentTable(input: {
  balance: number
  balanceMonth: string
  annualRate: number | null
  monthlyPayment: number | null
  history: { month: string; amount: number }[]
  recorded?: { month: string; interest: number; principal: number }[]
  pastMonths?: number
  futureMonths?: number
}): RepaymentRow[] {
  const { balance, balanceMonth, annualRate, monthlyPayment, history, recorded = [], pastMonths = 3, futureMonths = 12 } = input
  if (annualRate == null || annualRate < 0) return []

  const balanceOf = new Map(history.map(row => [row.month, row.amount]))
  const byMonth = new Map<string, RepaymentRow>()
  for (let index = 1; index < history.length; index++) {
    const previous = history[index - 1]
    const current = history[index]
    if (current.month !== addMonths(previous.month, 1) || current.month > balanceMonth) continue
    const principal = Math.max(Math.round(previous.amount - current.amount), 0)
    const interest = dailyInterest(previous.amount, annualRate, current.month)
    byMonth.set(current.month, { month: current.month, days: interestDays(current.month), interest, principal, total: interest + principal, balanceAfter: current.amount, kind: 'past' })
  }
  for (const row of recorded) {
    if (row.month > balanceMonth) continue
    const interest = Math.round(row.interest)
    const principal = Math.round(row.principal)
    byMonth.set(row.month, { month: row.month, days: interestDays(row.month), interest, principal, total: interest + principal, balanceAfter: balanceOf.get(row.month) ?? null, kind: 'past', recorded: true })
  }
  const past = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))

  const future: RepaymentRow[] = []
  if (monthlyPayment != null && monthlyPayment > 0) {
    let remaining = balance
    for (let step = 1; step <= futureMonths && remaining > 0; step++) {
      const month = addMonths(balanceMonth, step)
      const { interest, principal } = amortizeMonth(remaining, annualRate, monthlyPayment, month)
      remaining = Math.max(remaining - principal, 0)
      future.push({ month, days: interestDays(month), interest, principal, total: interest + principal, balanceAfter: remaining, kind: 'future' })
      if (principal <= 0) break // 월 상환액이 이자보다 작으면 잔액이 줄지 않으니 한 달만 보여 준다.
    }
  }
  return [...past.slice(-pastMonths), ...future]
}
