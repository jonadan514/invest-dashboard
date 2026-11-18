import { addMonths } from './home-insights.ts'
import { amortizeMonth } from './mortgage-schedule.ts'
import { levelPayment, monthsBetween } from './loan-interest.ts'

export interface PayoffSummary {
  /** 남은 납부 횟수. */
  months: number
  /** 앞으로 낼 이자 합계. */
  totalInterest: number
  /** 마지막 납부 달. */
  lastMonth: string
}

const MAX_MONTHS = 720
const SETTLE_TOLERANCE = 10_000

/** firstMonth부터 매달 은행 방식(잔액 × 금리 ÷ 12 버림, 원리금 고정)으로 갚아 완납까지 돌린다. 끝나지 않으면 null. */
export function runPayoff(balance: number, annualRate: number, payment: number, firstMonth: string): PayoffSummary | null {
  if (balance <= 0) return { months: 0, totalInterest: 0, lastMonth: addMonths(firstMonth, -1) }
  let remaining = balance
  let totalInterest = 0
  let month = firstMonth
  for (let index = 1; index <= MAX_MONTHS; index++) {
    const { interest, principal } = amortizeMonth(remaining, annualRate, payment)
    if (principal <= 0) return null
    totalInterest += interest
    remaining -= principal
    // 월 상환액을 원 미만 버림으로 정해 생기는 몇천 원의 잔돈은 은행처럼 마지막 회차에 함께 정산한다.
    if (remaining <= SETTLE_TOLERANCE) return { months: index, totalInterest, lastMonth: month }
    month = addMonths(month, 1)
  }
  return null
}

/**
 * 중도상환수수료 = 상환액 × 수수료율 × (3년 − 경과일) ÷ 3년. 대출 시작일을 모르면 남은 기간 비율을 1로 본다.
 * 3년(1,095일)이 지나면 0원이다.
 */
export function prepaymentFee(amount: number, feeRatePercent: number, startDate: string | null, prepayDate: string) {
  if (!(amount > 0) || !(feeRatePercent > 0)) return 0
  let ratio = 1
  if (startDate) {
    const elapsed = Math.floor((Date.parse(prepayDate) - Date.parse(startDate)) / 86_400_000)
    ratio = Math.min(Math.max((1095 - elapsed) / 1095, 0), 1)
  }
  return Math.floor(amount * feeRatePercent / 100 * ratio)
}

export type PrepayMethod = 'shorten' | 'reduce'

export interface PrepaymentInput {
  /** balanceMonth 납부 후 잔액. */
  balance: number
  balanceMonth: string
  annualRate: number
  monthlyPayment: number
  amount: number
  /** 이 달 정기 납부 직후에 한 번 더 갚는다. */
  prepayMonth: string
  /** shorten: 월 상환액은 그대로, 기간이 줄어든다. reduce: 만기는 그대로, 월 상환액이 줄어든다. */
  method: PrepayMethod
  feeRatePercent: number
  startDate: string | null
}

export interface PrepaymentResult {
  base: PayoffSummary
  plan: PayoffSummary & { monthlyPayment: number }
  /** 실제로 갚는 금액(그때 잔액을 넘지 않음). */
  applied: number
  /** 갚기 직전 잔액. */
  balanceBefore: number
  interestSaved: number
  fee: number
  netSaving: number
  monthsSaved: number
}

/** 한 번에 더 갚을 때 남은 이자·기간·월 상환액이 어떻게 바뀌는지 계산한다. 조건이 맞지 않으면 null. */
export function simulatePrepayment(input: PrepaymentInput): PrepaymentResult | null {
  const { balance, balanceMonth, annualRate, monthlyPayment, amount, prepayMonth, method, feeRatePercent, startDate } = input
  if (!(balance > 0) || !(monthlyPayment > 0) || !(amount > 0) || annualRate < 0) return null
  const firstMonth = addMonths(balanceMonth, 1)
  const base = runPayoff(balance, annualRate, monthlyPayment, firstMonth)
  if (!base) return null

  // 상환 달까지 정기 납부를 먼저 한다.
  const regular = Math.max(monthsBetween(balanceMonth, prepayMonth), 0)
  let remaining = balance
  let interestBefore = 0
  for (let index = 0; index < regular && remaining > 0; index++) {
    const { interest, principal } = amortizeMonth(remaining, annualRate, monthlyPayment)
    interestBefore += interest
    remaining -= principal
  }
  const paidMonths = Math.min(regular, base.months)
  const balanceBefore = Math.max(remaining, 0)
  const applied = Math.min(amount, balanceBefore)
  const after = balanceBefore - applied
  const nextMonth = addMonths(balanceMonth, paidMonths + 1)

  let payment = monthlyPayment
  if (method === 'reduce' && after > 0) {
    payment = levelPayment(after, annualRate, Math.max(base.months - paidMonths, 1)) ?? monthlyPayment
  }
  const rest = after > 0 ? runPayoff(after, annualRate, payment, nextMonth) : { months: 0, totalInterest: 0, lastMonth: addMonths(balanceMonth, paidMonths) }
  if (!rest) return null

  const months = paidMonths + rest.months
  const totalInterest = interestBefore + rest.totalInterest
  const interestSaved = base.totalInterest - totalInterest
  const day = startDate ? startDate.slice(8, 10) : '01'
  const fee = prepaymentFee(applied, feeRatePercent, startDate, `${prepayMonth}-${Number(day) > 28 ? '28' : day}`)
  return {
    base,
    plan: { months, totalInterest, lastMonth: rest.months > 0 ? rest.lastMonth : addMonths(balanceMonth, paidMonths), monthlyPayment: after > 0 ? payment : 0 },
    applied,
    balanceBefore,
    interestSaved,
    fee,
    netSaving: interestSaved - fee,
    monthsSaved: base.months - months,
  }
}
