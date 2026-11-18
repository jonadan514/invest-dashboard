import { addMonths } from './home-insights.ts'
import { dailyInterest } from './loan-interest.ts'

export interface MortgageInput {
  balance: number
  /** 연 금리(%) */
  annualRate: number
  /** 매월 내는 원리금 합계. */
  monthlyPayment: number
  /** 이번 달에 한 번 더 갚는 금액. */
  lumpSum?: number
  /** 매월 추가로 더 갚는 금액. */
  extraMonthly?: number
  /** 첫 상환 달('YYYY-MM'). 주면 이자를 달 일수로 계산한다(잔액 × 연금리 × 일수/365). */
  startMonth?: string
}

export interface MortgageResult {
  /** 완납까지 걸리는 개월 수. 갚을 수 없으면 null. */
  months: number | null
  totalInterest: number | null
  /** 첫 달 이자. 월 납입액이 이보다 작으면 원금이 줄지 않는다. */
  firstMonthInterest: number
}

const MAX_MONTHS = 600

/** 원리금균등 상환을 가정해 월 단위로 잔액을 줄여 완납 시점과 총이자를 계산한다. 중도상환수수료는 반영하지 않는다. */
export function simulateMortgage(input: MortgageInput): MortgageResult {
  const monthlyRate = Math.max(input.annualRate, 0) / 100 / 12
  let balance = Math.max(input.balance - Math.max(input.lumpSum ?? 0, 0), 0)
  const payment = Math.max(input.monthlyPayment, 0) + Math.max(input.extraMonthly ?? 0, 0)
  const firstMonthInterest = balance * monthlyRate
  if (balance <= 0) return { months: 0, totalInterest: 0, firstMonthInterest: 0 }
  if (payment <= firstMonthInterest || payment <= 0) return { months: null, totalInterest: null, firstMonthInterest }

  let totalInterest = 0
  for (let month = 1; month <= MAX_MONTHS; month++) {
    // startMonth이 있으면 이자는 그달 일수로, 정기 원금은 기준 이자(잔액 × 연금리/12)를 뺀 값으로 정한다.
    const standard = balance * monthlyRate
    const interest = input.startMonth ? dailyInterest(balance, input.annualRate, addMonths(input.startMonth, month - 1)) : standard
    totalInterest += interest
    balance -= payment - standard
    if (balance <= 0.5) return { months: month, totalInterest: Math.round(totalInterest), firstMonthInterest }
  }
  return { months: null, totalInterest: null, firstMonthInterest }
}

/** 최근 이자와 잔액으로 연 금리를 추정한다. */
export function estimateAnnualRate(balance: number, monthlyInterest: number) {
  if (balance <= 0 || monthlyInterest <= 0) return null
  return Math.round(monthlyInterest * 12 / balance * 100 * 100) / 100
}
