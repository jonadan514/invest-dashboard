import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHoldings } from '../lib/calc/holdings.ts'
import { buildRealizedPnL } from '../lib/calc/realized-pnl.ts'
import { buildXirrCashflows } from '../lib/calc/xirr.ts'
import type { Account, Asset } from '../lib/types.ts'

const account = { id: 'broker', name: 'Broker', owner: 'me' } as Account
const usdAsset = {
  id: 'usd-stock', symbol: 'USD', name: 'USD stock', asset_class: 'us_stock', currency: 'USD',
} as Asset
const krwAsset = {
  id: 'krw-stock', symbol: 'KRW', name: 'KRW stock', asset_class: 'kr_stock', currency: 'KRW',
} as Asset

type Trade = {
  id: string
  date: string
  created_at: string
  account_id: string
  asset_id: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  amount: number | null
  fx_rate: number | null
  fee: number
  tax: number
}

function trade(id: string, type: Trade['type'], asset: Asset, quantity: number, price: number,
  fx_rate: number | null, fee = 0, tax = 0, created_at = `2026-01-01T0${id}:00:00Z`): Trade {
  return {
    id, date: '2026-01-01', created_at, account_id: account.id, asset_id: asset.id,
    type, quantity, price, amount: price * quantity, fx_rate, fee, tax,
  }
}

test('USD 매수 원가는 매수 환율과 비용을, 매도 손익은 매도 환율과 비용을 사용한다', () => {
  const transactions = [
    trade('1', 'buy', usdAsset, 2, 100, 1200, 2, 1),
    trade('2', 'sell', usdAsset, 1, 130, 1300, 1, 1),
  ]
  const prices = new Map([[usdAsset.id, {
    asset_id: usdAsset.id, price: 140, prev_close: 135, currency: 'USD',
  }]])
  const [holding] = buildHoldings(transactions, [usdAsset], [account], prices, 1400)
  const [realized] = buildRealizedPnL(transactions, [usdAsset], 1400)

  assert.equal(holding.quantity, 1)
  assert.equal(holding.avg_cost, 101.5)
  assert.equal(holding.total_cost_krw, 121_800)
  assert.equal(holding.market_value_krw, 196_000)
  assert.equal(holding.unrealized_pnl_krw, 74_200)
  assert.equal(realized.pnl, 26.5)
  assert.equal(realized.pnl_krw, 44_600)
  assert.ok(Math.abs(realized.pnl_pct - (44_600 / 121_800) * 100) < 1e-10)
})

test('같은 날짜의 역순 입력도 created_at 순서로 이동평균과 실현손익을 계산한다', () => {
  const transactions = [
    trade('3', 'buy', krwAsset, 1, 200, 1, 0, 0, '2026-01-01T11:00:00Z'),
    trade('2', 'sell', krwAsset, 1, 130, 1, 0, 0, '2026-01-01T10:00:00Z'),
    trade('1', 'buy', krwAsset, 2, 100, 1, 0, 0, '2026-01-01T09:00:00Z'),
  ]
  const [holding] = buildHoldings(transactions, [krwAsset], [account])
  const [realized] = buildRealizedPnL(transactions, [krwAsset])

  assert.equal(holding.quantity, 2)
  assert.equal(holding.avg_cost, 150)
  assert.equal(holding.total_cost_krw, 300)
  assert.equal(realized.tx_id, '2')
  assert.equal(realized.pnl_krw, 30)
})

test('레거시 USD 환율 1과 null은 보유 원가와 실현손익에서 대체 환율을 사용한다', () => {
  const transactions = [
    trade('1', 'buy', usdAsset, 2, 100, 1),
    trade('2', 'buy', usdAsset, 2, 200, null),
    trade('3', 'sell', usdAsset, 1, 250, 1),
    trade('4', 'sell', usdAsset, 1, 250, null),
  ]
  const [holding] = buildHoldings(transactions, [usdAsset], [account], undefined, 1250)
  const realized = buildRealizedPnL(transactions, [usdAsset], 1250)

  assert.equal(holding.quantity, 2)
  assert.equal(holding.avg_cost, 150)
  assert.equal(holding.total_cost_krw, 375_000)
  assert.equal(realized.length, 2)
  assert.deepEqual(realized.map(row => row.pnl_krw), [125_000, 125_000])
})

test('KRW 자산은 거래 환율과 현재 USDKRW에 영향받지 않는다', () => {
  const transactions = [
    trade('1', 'buy', krwAsset, 2, 1000, 1500, 20, 10),
    trade('2', 'sell', krwAsset, 1, 1300, 1600, 5, 5),
  ]
  const [holding] = buildHoldings(transactions, [krwAsset], [account], undefined, 1700)
  const [realized] = buildRealizedPnL(transactions, [krwAsset], 1700)

  assert.equal(holding.quantity, 1)
  assert.equal(holding.total_cost, 1015)
  assert.equal(holding.total_cost_krw, 1015)
  assert.equal(holding.fx_rate, 1)
  assert.equal(realized.pnl, 275)
  assert.equal(realized.pnl_krw, 275)
})

test('XIRR 현금흐름에는 외부 입출금과 최종 평가액만 들어간다', () => {
  const transactions = [
    { date: '2025-01-01', type: 'deposit', amount: 1000, currency: 'KRW' },
    { date: '2025-02-01', type: 'buy', amount: 600, currency: 'KRW' },
    { date: '2025-03-01', type: 'dividend', amount: 30, currency: 'KRW' },
    { date: '2025-04-01', type: 'sell', amount: 700, currency: 'KRW' },
    { date: '2025-05-01', type: 'fee', amount: 5, currency: 'KRW' },
    { date: '2025-06-01', type: 'withdraw', amount: 200, currency: 'KRW' },
    { date: '2025-07-01', type: 'interest', amount: 10, currency: 'KRW' },
  ]
  const flows = buildXirrCashflows(transactions, 300)

  assert.equal(flows.length, 3)
  assert.deepEqual(flows.map(flow => flow.amount), [-1000, 200, 1235])
  assert.equal(flows[0].date.toISOString().slice(0, 10), '2025-01-01')
  assert.equal(flows[1].date.toISOString().slice(0, 10), '2025-06-01')
})
