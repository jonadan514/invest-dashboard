export interface DividendTx {
  date: string
  type: string
  asset_id: string | null
  amount: number | null
  currency: string
  fx_rate: number | null
}

function toKrw(row: DividendTx) {
  const fx = row.currency === 'USD' ? Number(row.fx_rate ?? 0) : 1
  return Number(row.amount ?? 0) * fx
}

export interface DividendSummary {
  year: string
  years: string[]
  total: number
  count: number
  /** 1~12월 배당(원). */
  byMonth: number[]
  byAsset: { asset_id: string; total: number; count: number }[]
  /** 전년 합계. 전년 기록이 없으면 null. */
  previousTotal: number | null
}

/** 배당 거래를 연도 기준으로 월별·종목별로 합산한다(원화). */
export function summarizeDividends(rows: DividendTx[], year: string): DividendSummary {
  const dividends = rows.filter(row => row.type === 'dividend')
  const years = [...new Set(dividends.map(row => row.date.slice(0, 4)))].sort().reverse()
  const inYear = dividends.filter(row => row.date.startsWith(`${year}-`))
  const byMonth = Array<number>(12).fill(0)
  const assets = new Map<string, { asset_id: string; total: number; count: number }>()
  for (const row of inYear) {
    const krw = toKrw(row)
    byMonth[Number(row.date.slice(5, 7)) - 1] += krw
    const key = row.asset_id ?? ''
    const entry = assets.get(key) ?? { asset_id: key, total: 0, count: 0 }
    entry.total += krw
    entry.count += 1
    assets.set(key, entry)
  }
  const previous = dividends.filter(row => row.date.startsWith(`${Number(year) - 1}-`))
  return {
    year,
    years,
    total: byMonth.reduce((sum, value) => sum + value, 0),
    count: inYear.length,
    byMonth,
    byAsset: [...assets.values()].sort((a, b) => b.total - a.total),
    previousTotal: previous.length > 0 ? previous.reduce((sum, row) => sum + toKrw(row), 0) : null,
  }
}
