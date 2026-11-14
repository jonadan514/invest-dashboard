import type { TrendPoint } from './home-insights.ts'

export interface AnnualNetWorth {
  year: string
  /** 비교 기준: 전년도 마지막 기록, 없으면 그해 첫 기록. */
  start: TrendPoint | null
  /** 그해 마지막 기록(오늘 이후 달 제외). */
  end: TrendPoint | null
  /** 그해 각 기록 월의 순자산과 직전 기록 대비 변화. */
  months: { month: string; netWorth: number; change: number | null }[]
  /** 아직 12월 기록 전인 해. */
  inProgress: boolean
}

export function annualNetWorth(trend: TrendPoint[], year: string, cutoffMonth: string): AnnualNetWorth {
  const sorted = [...trend].filter(point => point.month <= cutoffMonth).sort((a, b) => a.month.localeCompare(b.month))
  const baseline = sorted.filter(point => point.month < `${year}-01`).at(-1) ?? null
  const inYear = sorted.filter(point => point.month.startsWith(`${year}-`))
  const start = baseline ?? inYear[0] ?? null
  const end = inYear.at(-1) ?? null
  let previous = baseline
  const months = inYear.map(point => {
    const change = previous ? point.netWorth - previous.netWorth : null
    previous = point
    return { month: point.month, netWorth: point.netWorth, change }
  })
  return { year, start, end, months, inProgress: !end || end.month < `${year}-12` }
}

/** 기록이 있는 연도 목록(최근 연도 먼저). */
export function reportYears(trend: TrendPoint[], cutoffMonth: string) {
  return [...new Set(trend.filter(point => point.month <= cutoffMonth).map(point => point.month.slice(0, 4)))].sort().reverse()
}
