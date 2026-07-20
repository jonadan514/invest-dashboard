import { NextRequest, NextResponse } from 'next/server'

export interface SearchResult {
  symbol: string
  yahooSymbol: string
  name: string
  assetClass: string
  currency: string
  exchange: string
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://finance.yahoo.com/',
}

const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://finance.naver.com/',
  'Origin': 'https://finance.naver.com',
}

// ETF 운용사 이름 prefix로 ETF 감지
const ETF_PREFIXES = ['KODEX', 'TIGER', 'KBSTAR', 'RISE', 'ACE', 'HANARO', 'SOL', 'FOCUS',
  'KIWOOM', 'ARIRANG', 'KOSEF', 'PLUS', 'TIMEFOLIO', 'WOORI', 'NH', 'KTOP', 'TREX', 'TRUE']

function detectEtf(name: string): boolean {
  if (/ETF|ETN/i.test(name)) return true
  return ETF_PREFIXES.some(p => name.startsWith(p + ' '))
}

// ac.stock.naver.com — 현재 네이버 금융이 실제로 쓰는 API
// 실제 응답: { code, name, typeCode("KOSPI"|"KOSDAQ"), typeName, category }
async function naverStockSearch(q: string): Promise<SearchResult[] | null> {
  try {
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock%2Cindex%2Cetf%2Cetc`
    const res = await fetch(url, { cache: 'no-store', headers: NAVER_HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data.items)) return null

    return data.items.map((item: any) => {
      const code: string = item.code ?? ''
      const name: string = item.name ?? ''
      const typeCode: string = item.typeCode ?? ''   // "KOSPI" | "KOSDAQ"
      const isKosdaq = /KOSDAQ/i.test(typeCode)
      const symbol = isKosdaq ? `${code}.KQ` : code
      return {
        symbol,
        yahooSymbol: isKosdaq ? `${code}.KQ` : `${code}.KS`,
        name,
        assetClass: detectEtf(name) ? 'etf_kr' : 'kr_stock',
        currency: 'KRW',
        exchange: typeCode || 'KSE',
      }
    })
  } catch {
    return null
  }
}

// ac.finance.naver.com — 구버전 fallback
// 실제 응답: { items: [ [[종목명, 종목코드, 시장]], ... ] }
async function naverFinanceSearch(q: string): Promise<SearchResult[] | null> {
  try {
    const url = `https://ac.finance.naver.com/ac?q=${encodeURIComponent(q)}&q_enc=UTF-8&t_aid=stock&st=111&r_format=json&r_enc=UTF-8&r_unicode=0&t_tab=0`
    const res = await fetch(url, { cache: 'no-store', headers: NAVER_HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    const rows: any[][] = (data.items ?? []).flat()
    if (rows.length === 0) return null

    return rows
      .filter((r: any[]) => r[1])
      .map((r: any[]) => {
        const name: string = r[0]
        const code: string = r[1]
        const market: string = r[2] ?? ''
        const isKosdaq = /코스닥|KOSDAQ/i.test(market)
        const symbol = isKosdaq ? `${code}.KQ` : code
        return {
          symbol,
          yahooSymbol: isKosdaq ? `${code}.KQ` : `${code}.KS`,
          name,
          assetClass: detectEtf(name) ? 'etf_kr' : 'kr_stock',
          currency: 'KRW',
          exchange: market || 'KSE',
        }
      })
  } catch {
    return null
  }
}

// 영문/티커 입력 → Yahoo Finance
async function yahooSearch(q: string): Promise<any[]> {
  for (const host of ['query2', 'query1']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`
      const res = await fetch(url, { cache: 'no-store', headers: YAHOO_HEADERS })
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data?.quotes) && data.quotes.length > 0) return data.quotes
    } catch {
      // try next host
    }
  }
  return []
}

function mapYahooQuote(q: any): SearchResult | null {
  const yahooSymbol: string = q.symbol ?? ''
  if (!yahooSymbol) return null
  const name: string = q.shortname || q.longname || yahooSymbol
  const exchange: string = q.exchDisp ?? q.exchange ?? ''
  let symbol = yahooSymbol
  let assetClass = 'other'
  let currency = 'USD'

  if (yahooSymbol.endsWith('.KS')) {
    symbol = yahooSymbol.replace('.KS', '')
    assetClass = q.quoteType === 'ETF' ? 'etf_kr' : 'kr_stock'
    currency = 'KRW'
  } else if (yahooSymbol.endsWith('.KQ')) {
    symbol = yahooSymbol
    assetClass = 'kr_stock'
    currency = 'KRW'
  } else if (q.quoteType === 'CRYPTOCURRENCY') {
    const base = yahooSymbol.split('-')[0]
    if (/^\d{4,}$/.test(base)) return null   // 005930-USD 파생상품 제외
    symbol = base
    assetClass = 'crypto'
    currency = 'KRW'
  } else {
    symbol = yahooSymbol
    assetClass = q.quoteType === 'ETF' ? 'etf_us' : 'us_stock'
    currency = 'USD'
  }

  return { symbol, yahooSymbol, name, assetClass, currency, exchange }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  const debug = request.nextUrl.searchParams.get('debug') === '1'
  if (q.length < 1) return NextResponse.json({ results: [] })

  const isKorean = /[가-힯]/.test(q)
  const BAD_TYPES = new Set(['INDEX', 'CURRENCY', 'OPTION', 'FUTURE', 'MUTUALFUND'])

  if (isKorean) {
    // ac.stock.naver.com 먼저 시도, 실패하면 ac.finance.naver.com
    const results = (await naverStockSearch(q)) ?? (await naverFinanceSearch(q)) ?? []
    if (debug) {
      // 디버그: 원본 응답 확인용
      const rawUrl = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock%2Cindex%2Cetf%2Cetc`
      const rawRes = await fetch(rawUrl, { cache: 'no-store', headers: NAVER_HEADERS })
      const rawBody = rawRes.ok ? await rawRes.text() : `status:${rawRes.status}`
      return NextResponse.json({ results, debug: { url: rawUrl, status: rawRes.status, body: rawBody.slice(0, 500) } })
    }
    return NextResponse.json({ results })
  }

  const quotes = await yahooSearch(q)
  const results = quotes
    .filter((q: any) => !BAD_TYPES.has(q.quoteType ?? ''))
    .map(mapYahooQuote)
    .filter((r): r is SearchResult => r !== null)

  return NextResponse.json({ results })
}
