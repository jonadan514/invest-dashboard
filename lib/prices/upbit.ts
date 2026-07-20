export interface UpbitTicker {
  symbol: string
  price: number
  prev_close: number
}

export async function fetchUpbitPrices(symbols: string[]): Promise<Map<string, UpbitTicker>> {
  if (symbols.length === 0) return new Map()

  const markets = symbols.map(s => `KRW-${s.toUpperCase()}`).join(',')
  try {
    const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`, {
      cache: 'no-store',
    })
    if (!res.ok) return new Map()

    const data = await res.json() as Array<{
      market: string
      trade_price: number
      prev_closing_price: number
    }>

    const map = new Map<string, UpbitTicker>()
    for (const item of data) {
      const symbol = item.market.replace('KRW-', '')
      map.set(symbol, {
        symbol,
        price: item.trade_price,
        prev_close: item.prev_closing_price,
      })
    }
    return map
  } catch {
    return new Map()
  }
}
