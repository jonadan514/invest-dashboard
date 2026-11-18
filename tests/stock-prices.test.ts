import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPriceUpdates, dividendTotalKrw } from '../lib/stock-prices.ts'

const assets = [{ id: 'kr', currency: 'KRW' }, { id: 'us', currency: 'USD' }, { id: 'skip', currency: 'KRW' }]
const form = (entries: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(entries)) data.set(k, v); return data }
const now = new Date('2026-11-17T00:00:00Z')

test('입력한 현재가만 저장하고 빈 칸은 그대로 둔다', () => {
  const result = buildPriceUpdates(form({ price_kr: '71,500', price_us: '182.35', price_skip: ' ', usd_krw: '1,385.5', price_unknown: '1' }), assets, now)
  assert.deepEqual(result.prices, [
    { asset_id: 'kr', price: 71500, currency: 'KRW', as_of: '2026-11-17T00:00:00.000Z' },
    { asset_id: 'us', price: 182.35, currency: 'USD', as_of: '2026-11-17T00:00:00.000Z' },
  ])
  assert.equal(result.usdKrw, 1385.5)
  assert.equal(buildPriceUpdates(form({}), assets, now).usdKrw, null)
})

test('잘못된 현재가와 환율은 거부한다', () => {
  assert.throws(() => buildPriceUpdates(form({ price_kr: '0' }), assets), /현재가/)
  assert.throws(() => buildPriceUpdates(form({ price_kr: 'abc' }), assets), /현재가/)
  assert.throws(() => buildPriceUpdates(form({ usd_krw: '1' }), assets), /환율/)
})

test('배당 합계는 해당 연도만 원화로 더한다', () => {
  const rows = [
    { date: '2026-03-02', type: 'dividend', amount: 50_000, currency: 'KRW', fx_rate: 1 },
    { date: '2026-06-02', type: 'dividend', amount: 10, currency: 'USD', fx_rate: 1_400 },
    { date: '2025-12-02', type: 'dividend', amount: 30_000, currency: 'KRW', fx_rate: 1 },
    { date: '2026-06-02', type: 'buy', amount: 1_000_000, currency: 'KRW', fx_rate: 1 },
  ]
  assert.equal(dividendTotalKrw(rows, '2026'), 64_000)
  assert.equal(dividendTotalKrw(rows), 94_000)
})
