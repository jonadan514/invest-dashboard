export interface FinnhubQuote {
  symbol: string
  price: number
  prev_close: number
}

export async function fetchFinnhubPrices(
  symbols: string[],
  apiKey: string,
): Promise<Map<string, FinnhubQuote>> {
  if (symbols.length === 0 || !apiKey) return new Map()

  const results = await Promise.all(
    symbols.map(async symbol => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
          { cache: 'no-store' },
        )
        if (!res.ok) return null
        const data = await res.json() as { c: number; pc: number }
        if (!data.c) return null
        return { symbol, price: data.c, prev_close: data.pc } as FinnhubQuote
      } catch {
        return null
      }
    }),
  )

  const map = new Map<string, FinnhubQuote>()
  for (const q of results) {
    if (q) map.set(q.symbol, q)
  }
  return map
}
