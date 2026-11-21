import type { MonthlyBudget } from '@/lib/types'

export interface SavingsPoint {
  month: string
  income: number
  /** 정기 잉여금(공금 − 실제 지출, 없으면 설정의 고정비)과 계획에 넣은 성과급의 합. */
  saving: number
  /** 고정비 안에 포함된 주담대 정기 원금. 대출 잔액을 줄이므로 저축으로 볼 수 있다. */
  principal: number
  /** 소득이 0이면 null. */
  rate: number | null
  rateWithPrincipal: number | null
}

/** 그달 지출: 실제 지출을 적었으면 그 값, 아니면 설정의 월 고정비. */
export function monthSpending(actualSpending: number | null | undefined, monthlyFixedCost: number) {
  return actualSpending != null && Number(actualSpending) > 0 ? Number(actualSpending) : monthlyFixedCost
}

/**
 * 월간 기록으로 월별 저축률을 계산한다.
 * 소득은 설정의 월 소득에 그달 성과급 총액을 더한 값이다. 추가 원금 상환은 배분 가능액에서 냈는지
 * 알 수 없어 중복을 피하려고 포함하지 않는다.
 */
export function buildSavingsSeries(
  budgets: Pick<MonthlyBudget, 'month' | 'joint_savings' | 'bonus_total' | 'bonus_to_plan' | 'mortgage_principal' | 'actual_spending'>[],
  monthlyIncome: number,
  monthlyFixedCost: number,
): SavingsPoint[] {
  return [...budgets]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(budget => {
      const income = Math.max(monthlyIncome, 0) + Math.max(Number(budget.bonus_total), 0)
      const saving = Math.max(Number(budget.joint_savings) - monthSpending(budget.actual_spending, monthlyFixedCost), 0) + Math.max(Number(budget.bonus_to_plan), 0)
      const principal = Math.max(Number(budget.mortgage_principal), 0)
      return {
        month: budget.month,
        income,
        saving,
        principal,
        rate: income > 0 ? saving / income * 100 : null,
        rateWithPrincipal: income > 0 ? (saving + principal) / income * 100 : null,
      }
    })
}

/** 최근 count개월(기록이 있는 달 기준)의 소득 가중 평균 저축률. */
export function averageSavingsRate(points: SavingsPoint[], count = 6) {
  const recent = points.slice(-count).filter(point => point.income > 0)
  const income = recent.reduce((sum, point) => sum + point.income, 0)
  if (income <= 0) return null
  return { months: recent.length, rate: recent.reduce((sum, point) => sum + point.saving, 0) / income * 100 }
}
