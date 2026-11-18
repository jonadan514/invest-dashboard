import type { AccountMonthlySnapshot } from '../types.ts'

export interface TrendPoint {
  month: string
  value: number
  /** 직전 기록 대비 증감(원). 첫 기록은 null. */
  change: number | null
}

/** 선택한 계좌들의 월간 평가액 합계 추이. 어떤 달에 기록이 없는 계좌는 직전 값을 이어서 쓴다. */
export function stockTrend(snapshots: AccountMonthlySnapshot[], accountIds: string[], months = 12): TrendPoint[] {
  const ids = new Set(accountIds)
  const rows = snapshots.filter(row => ids.has(row.account_id)).sort((a, b) => a.month.localeCompare(b.month))
  const monthList = [...new Set(rows.map(row => row.month))]
  const latest = new Map<string, number>()
  const points: TrendPoint[] = []
  for (const month of monthList) {
    for (const row of rows.filter(item => item.month === month)) latest.set(row.account_id, Number(row.evaluation_amount))
    const value = [...latest.values()].reduce((sum, amount) => sum + amount, 0)
    const previous = points.length > 0 ? points[points.length - 1].value : null
    points.push({ month, value, change: previous === null ? null : value - previous })
  }
  return points.slice(-months)
}
