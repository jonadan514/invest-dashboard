/**
 * 야후 파이낸스 차트 API(비공식)로 현재가·원/달러 환율을 가져온다.
 * 종목 코드만 보내며 보유 수량 등은 보내지 않는다. 실패한 종목은 직접 입력으로 남긴다.
 */

export interface QuoteAsset {
  id: string
  name: string
  symbol: string | null
  asset_class: string
  currency: string
}

export interface Quote {
  price: number
  prevClose: number | null
  currency: string
  asOf: string
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

const QUOTE_CLASSES = new Set(['kr_stock', 'etf_kr', 'us_stock', 'etf_us'])

/** 조회할 야후 심볼 후보. 국내 6자리 코드는 코스피(.KS) → 코스닥(.KQ) 순서로 시도한다. */
export function yahooSymbols(asset: QuoteAsset): string[] {
  const symbol = asset.symbol?.trim().toUpperCase()
  if (!symbol || !QUOTE_CLASSES.has(asset.asset_class)) return []
  if (asset.currency === 'KRW') {
    if (/\.(KS|KQ)$/.test(symbol)) return [symbol]
    if (/^[0-9A-Z]{6}$/.test(symbol)) return [`${symbol}.KS`, `${symbol}.KQ`]
    return []
  }
  // 미국: BRK.B → BRK-B
  return [symbol.replace(/\./g, '-')]
}

/** 차트 응답에서 가격을 꺼낸다. 통화가 기대와 다르면 버린다(잘못 매칭된 심볼 방지). */
export function parseChart(json: unknown, expectedCurrency: string): Quote | null {
  const meta = (json as { chart?: { result?: { meta?: Record<string, unknown> }[] | null } })?.chart?.result?.[0]?.meta
  if (!meta) return null
  const price = Number(meta.regularMarketPrice)
  const currency = String(meta.currency ?? '').toUpperCase()
  if (!(price > 0) || currency !== expectedCurrency) return null
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose)
  const time = Number(meta.regularMarketTime)
  return {
    price,
    prevClose: prev > 0 ? prev : null,
    currency,
    asOf: Number.isFinite(time) && time > 0 ? new Date(time * 1000).toISOString() : new Date().toISOString(),
  }
}

async function fetchChart(fetcher: FetchLike, symbol: string, expectedCurrency: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`
  try {
    const response = await fetcher(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; household-dashboard)' }, cache: 'no-store' })
    if (!response.ok) return null
    return parseChart(await response.json(), expectedCurrency)
  } catch {
    return null
  }
}

export async function fetchQuote(fetcher: FetchLike, asset: QuoteAsset) {
  for (const symbol of yahooSymbols(asset)) {
    const quote = await fetchChart(fetcher, symbol, asset.currency)
    if (quote) return quote
  }
  return null
}

export async function fetchUsdKrw(fetcher: FetchLike) {
  return fetchChart(fetcher, 'KRW=X', 'KRW')
}
