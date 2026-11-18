import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeReturns, viewHoldings } from '../lib/calc/holdings-view.ts'
import { summarizeDividends } from '../lib/calc/dividends.ts'
import { stockTrend } from '../lib/calc/stock-trend.ts'
import { syncStockEvaluations } from '../lib/stock-sync.ts'
import type { AccountMonthlySnapshot, Holding } from '../lib/types.ts'

const holding = (name: string, cls: string, cost: number, value: number | null): Holding => ({
  asset_id: name, symbol: null, name, asset_class: cls, currency: 'KRW', account_id: 'a', account_name: '계좌', owner: 'me',
  quantity: 1, avg_cost: cost, avg_cost_krw: cost, total_cost: cost, total_cost_krw: cost, current_price: value, prev_close: null,
  market_value_krw: value, unrealized_pnl_krw: value === null ? null : value - cost,
  unrealized_pnl_pct: value === null ? null : (value - cost) / cost * 100, fx_rate: 1,
}) as Holding

const rows = [holding('가', 'kr_stock', 100, 150), holding('나', 'us_stock', 200, 180), holding('다', 'kr_stock', 100, null), holding('라', 'etf_kr', 100, 300)]

test('정렬: 평가금액·수익률·손익·이름, 현재가 없는 종목은 뒤로', () => {
  assert.deepEqual(viewHoldings(rows, {}).map(h => h.name), ['라', '나', '가', '다'])
  assert.deepEqual(viewHoldings(rows, { sort: 'return' }).map(h => h.name), ['라', '가', '나', '다'])
  assert.deepEqual(viewHoldings(rows, { sort: 'pnl' }).map(h => h.name), ['라', '가', '나', '다'])
  assert.deepEqual(viewHoldings(rows, { sort: 'name' }).map(h => h.name), ['가', '나', '다', '라'])
})

test('필터: 이익/손실/구분', () => {
  assert.deepEqual(viewHoldings(rows, { filter: 'gain' }).map(h => h.name), ['라', '가'])
  assert.deepEqual(viewHoldings(rows, { filter: 'loss' }).map(h => h.name), ['나'])
  assert.deepEqual(viewHoldings(rows, { assetClass: 'kr_stock' }).map(h => h.name), ['가', '다'])
})

test('수익률 요약: 구분별 합계와 최고·최저 종목', () => {
  const result = summarizeReturns(rows, h => h.asset_class)
  const kr = result.byGroup.find(g => g.key === 'kr_stock')!
  assert.equal(kr.count, 1)
  assert.equal(kr.pnl, 50)
  assert.equal(result.best?.name, '라')
  assert.equal(result.worst?.name, '나')
  assert.equal(summarizeReturns([], h => h.asset_class).best, null)
})

test('배당: 월별·종목별 원화 합계와 전년 비교', () => {
  const s = summarizeDividends([
    { date: '2026-03-10', type: 'dividend', asset_id: 'x', amount: 10_000, currency: 'KRW', fx_rate: null },
    { date: '2026-03-20', type: 'dividend', asset_id: 'y', amount: 10, currency: 'USD', fx_rate: 1400 },
    { date: '2026-06-01', type: 'dividend', asset_id: 'x', amount: 5_000, currency: 'KRW', fx_rate: null },
    { date: '2025-12-01', type: 'dividend', asset_id: 'x', amount: 7_000, currency: 'KRW', fx_rate: null },
    { date: '2026-03-11', type: 'buy', asset_id: 'x', amount: 999, currency: 'KRW', fx_rate: null },
  ], '2026')
  assert.equal(s.total, 29_000)
  assert.equal(s.count, 3)
  assert.equal(s.byMonth[2], 24_000)
  assert.equal(s.byAsset[0].asset_id, 'x')
  assert.equal(s.previousTotal, 7_000)
  assert.deepEqual(s.years, ['2026', '2025'])
})

const snap = (account_id: string, month: string, amount: number) => ({ account_id, month, evaluation_amount: amount }) as AccountMonthlySnapshot

test('추이: 계좌 합계를 이어 붙이고 증감을 계산', () => {
  const t = stockTrend([snap('a', '2026-01', 100), snap('b', '2026-01', 50), snap('a', '2026-02', 130), snap('z', '2026-02', 999)], ['a', 'b'])
  assert.deepEqual(t, [{ month: '2026-01', value: 150, change: null }, { month: '2026-02', value: 180, change: 30 }])
})

test('평가액 자동 반영: 기록 있고 현재가 완비된 계좌만 갱신', async () => {
  const updates: string[] = []
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ eq: async () => ({ data: [
        { id: '1', account_id: 'a', evaluation_amount: 100 },
        { id: '2', account_id: 'b', evaluation_amount: 100 },
        { id: '3', account_id: 'c', evaluation_amount: 500 },
        { id: '4', account_id: 'd', evaluation_amount: 100 },
      ], error: null }) }) }),
      update: () => ({ eq: (_: string, id: string) => ({ eq: async () => { updates.push(id); return { error: null } } }) }),
    }),
  }
  const done = await syncStockEvaluations(client, 'u', '2026-11', {
    a: { value: 200, holdings: 1, missing: 0 },
    b: { value: 200, holdings: 2, missing: 1 },
    c: { value: 500, holdings: 1, missing: 0 },
  })
  assert.deepEqual(done, ['a'])
  assert.deepEqual(updates, ['1'])
})

import { allocate } from '../lib/calc/holdings-view.ts'
import { tradeLedger } from '../lib/calc/stock-detail.ts'
import { buildStockAlerts } from '../lib/calc/stock-alerts.ts'

test('비중: 묶음별 평가금액·비중·수익률, 현재가 없는 종목 제외', () => {
  const r = allocate(rows, h => h.asset_class, h => h.asset_class)
  assert.equal(r[0].key, 'etf_kr')
  assert.equal(Math.round(r.reduce((s, x) => s + x.share, 0)), 100)
  assert.equal(r.find(x => x.key === 'kr_stock')!.count, 1)
  assert.equal(r.find(x => x.key === 'kr_stock')!.rate, 50)
})

test('거래 원장: 거래 뒤 보유 수량을 최신순으로', () => {
  const l = tradeLedger([
    { id: '1', date: '2026-01-01', account_id: 'a', type: 'buy', quantity: 10, amount: 0 },
    { id: '2', date: '2026-02-01', account_id: 'a', type: 'sell', quantity: 4, amount: 0 },
    { id: '3', date: '2026-03-01', account_id: 'a', type: 'dividend', quantity: null, amount: 100 },
  ])
  assert.deepEqual(l.map(x => [x.id, x.runningQuantity]), [['3', null], ['2', 6], ['1', 10]])
})

test('알림: 환율·미입력·오래된 시세·급등락·기록 차이', () => {
  const now = new Date('2026-11-18T00:00:00Z')
  const usd = { ...holding('애플', 'us_stock', 100, 120), currency: 'USD', asset_id: 'aapl', current_price: 1, prev_close: 0.9 } as Holding
  const none = holding('없음', 'kr_stock', 100, null)
  const a = holding('삼성', 'kr_stock', 100, 100)
  const alerts = buildStockAlerts({
    holdings: [usd, none, { ...a, current_price: 100, prev_close: 90 } as Holding],
    priceAsOf: new Map([['삼성', '2026-11-10T00:00:00Z']]),
    usdKrw: null, now,
  })
  const ids = alerts.map(x => x.id)
  assert.ok(ids.includes('fx-missing') && ids.includes('price-missing') && ids.includes('price-stale'))
  assert.ok(ids.some(id => id.startsWith('move-')))
  assert.equal(alerts[0].level, 'warn')
  const gap = buildStockAlerts({ holdings: [a], priceAsOf: new Map(), usdKrw: 1, now, recorded: new Map([['a', { name: '계좌', amount: 200 }]]) })
  assert.ok(gap.some(x => x.id === 'gap-a'))
  assert.deepEqual(buildStockAlerts({ holdings: [], priceAsOf: new Map(), usdKrw: 1, now }), [])
})
