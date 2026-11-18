import assert from 'node:assert/strict'
import test from 'node:test'
import { parseChart, yahooSymbols } from '../lib/quotes.ts'
import { refreshQuotes } from '../lib/quote-refresh.ts'

const asset = (symbol: string | null, asset_class: string, currency: string) => ({ id: symbol ?? 'x', name: symbol ?? 'x', symbol, asset_class, currency })
const chart = (price: number, currency: string) => ({ chart: { result: [{ meta: { regularMarketPrice: price, currency, chartPreviousClose: price - 1, regularMarketTime: 1_795_000_000 } }] } })

test('야후 심볼 후보', () => {
  assert.deepEqual(yahooSymbols(asset('005930', 'kr_stock', 'KRW')), ['005930.KS', '005930.KQ'])
  assert.deepEqual(yahooSymbols(asset('0080G0', 'etf_kr', 'KRW')), ['0080G0.KS', '0080G0.KQ'])
  assert.deepEqual(yahooSymbols(asset('035720.KQ', 'kr_stock', 'KRW')), ['035720.KQ'])
  assert.deepEqual(yahooSymbols(asset('brk.b', 'us_stock', 'USD')), ['BRK-B'])
  assert.deepEqual(yahooSymbols(asset(null, 'kr_stock', 'KRW')), [])
  assert.deepEqual(yahooSymbols(asset('삼성', 'kr_stock', 'KRW')), [])
  assert.deepEqual(yahooSymbols(asset('BTC', 'crypto', 'KRW')), [])
})

test('차트 응답 해석: 통화가 다르거나 가격이 없으면 버린다', () => {
  assert.deepEqual(parseChart(chart(72500, 'KRW'), 'KRW'), { price: 72500, prevClose: 72499, currency: 'KRW', asOf: new Date(1_795_000_000_000).toISOString() })
  assert.equal(parseChart(chart(72500, 'USD'), 'KRW'), null)
  assert.equal(parseChart({ chart: { result: null } }, 'KRW'), null)
  assert.equal(parseChart(chart(0, 'KRW'), 'KRW'), null)
})

test('현재가·환율을 저장하고 실패한 종목을 알려 준다', async () => {
  const saved: Record<string, unknown> = {}
  const supabase = {
    from: (table: string) => ({
      select: () => ({ eq: async () => ({ data: [
        { ...asset('005930', 'kr_stock', 'KRW'), name: '삼성전자', is_active: true },
        { ...asset('035720', 'kr_stock', 'KRW'), name: '카카오', is_active: true },
        { ...asset('AAPL', 'us_stock', 'USD'), name: 'Apple', is_active: true },
        { ...asset('ZZZZ', 'us_stock', 'USD'), name: '없는 종목', is_active: true },
        { ...asset(null, 'other', 'KRW'), name: '코드 없음', is_active: true },
      ], error: null }) }),
      upsert: async (rows: unknown) => { saved[table] = rows; return { error: null } },
    }),
  }
  const responses: Record<string, unknown> = {
    '005930.KS': chart(72500, 'KRW'), '035720.KQ': chart(41000, 'KRW'), AAPL: chart(228.4, 'USD'), 'KRW%3DX': chart(1395.5, 'KRW'),
  }
  const fetcher = async (url: string) => {
    const symbol = url.split('/chart/')[1].split('?')[0]
    const body = responses[symbol]
    return { ok: Boolean(body), status: body ? 200 : 404, json: async () => body }
  }
  const result = await refreshQuotes(supabase, 'household', fetcher)
  assert.deepEqual(result, { updated: 3, failed: ['없는 종목'], skipped: 1, usdKrw: 1395.5 })
  assert.deepEqual((saved.prices as { price: number }[]).map(row => row.price), [72500, 41000, 228.4])
  assert.equal((saved.fx_rates as { rate: number }).rate, 1395.5)
})
