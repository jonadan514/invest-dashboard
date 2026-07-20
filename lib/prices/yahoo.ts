interface YahooQuote {
  symbol: string
  price: number
  prev_close: number | null
}

export async function fetchYahooPrices(symbols: string[]): Promise<Map<string, YahooQuote>> {
  if (symbols.length === 0) return new Map()

  const results = await Promise.all(
    symbols.map(async (symbol): Promise<YahooQuote | null> => {
      // 점(.)이 없으면 KOSPI 기본 suffix 붙임. KOSDAQ은 심볼에 .KQ 직접 입력
      const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.KS`
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`,
          { cache: 'no-store' },
        )
        if (!res.ok) return null
        const data = await res.json()
        const meta = data?.chart?.result?.[0]?.meta
        if (!meta?.regularMarketPrice) return null
        return {
          symbol,
          price: meta.regularMarketPrice as number,
          prev_close: (meta.previousClose ?? meta.chartPreviousClose ?? null) as number | null,
        }
      } catch {
        return null
      }
    }),
  )

  const map = new Map<string, YahooQuote>()
  for (const r of results) {
    if (r) map.set(r.symbol, r)
  }
  return map
}
