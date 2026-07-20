export interface TrendPoint { month: string; value: number }

export function buildCostTrend(
  transactions: { type: string; date: string; amount?: number | null; currency?: string }[],
  usdKrw: number,
): TrendPoint[] {
  const monthMap = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== 'buy' && tx.type !== 'deposit') continue
    const month = (tx.date as string).slice(0, 7)
    const amt = (tx.amount ?? 0) * (tx.currency === 'USD' ? usdKrw : 1)
    monthMap.set(month, (monthMap.get(month) ?? 0) + amt)
  }
  let cum = 0
  return Array.from(monthMap.keys()).sort().map(m => {
    cum += monthMap.get(m) ?? 0
    return { month: m, value: cum }
  })
}
