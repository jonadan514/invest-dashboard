import assert from 'node:assert/strict'
import test from 'node:test'
import { estimateFee, estimateTax, formatRate, inferFeeRates, krStockSellTaxRate, taxRule } from '../lib/calc/trade-costs.ts'

test('계좌·통화별 최근 거래로 수수료율을 추정한다', () => {
  const rates = inferFeeRates([
    { account_id: 'a', type: 'buy', quantity: 10, price: 70_000, fee: 105, currency: 'KRW', date: '2026-11-01' },
    { account_id: 'a', type: 'sell', quantity: 10, price: 30_000, fee: 45, currency: 'KRW', date: '2026-10-01' },
    { account_id: 'a', type: 'dividend', quantity: null, price: null, fee: 0, currency: 'KRW', date: '2026-10-02' },
    { account_id: 'a', type: 'buy', quantity: 2, price: 200, fee: 1, currency: 'USD', date: '2026-10-03' },
    { account_id: 'b', type: 'buy', quantity: 5, price: 10_000, fee: 0, currency: 'KRW', date: '2026-10-03' },
  ])
  assert.deepEqual(rates, { 'a:KRW': 0.00015, 'a:USD': 0.0025 })
})

test('최근 거래만 표본으로 쓴다', () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => ({ account_id: 'a', type: 'buy', quantity: 1, price: 100_000, fee: 15, currency: 'KRW', date: `2026-11-0${i + 1}` })),
    { account_id: 'a', type: 'buy', quantity: 1, price: 100_000, fee: 500, currency: 'KRW', date: '2025-01-01' },
  ]
  assert.deepEqual(inferFeeRates(rows), { 'a:KRW': 0.00015 })
})

test('수수료는 원 미만 절사, 달러는 센트 반올림', () => {
  assert.equal(estimateFee(1_234_567, 0.00015, 'KRW'), 185)
  assert.equal(estimateFee(1_234.5, 0.0025, 'USD'), 3.09)
  assert.equal(estimateFee(0, 0.00015, 'KRW'), 0)
})

test('증권거래세율은 거래일 기준', () => {
  assert.equal(krStockSellTaxRate('2026-03-02'), 0.002)
  assert.equal(krStockSellTaxRate('2025-06-30'), 0.0015)
  assert.equal(krStockSellTaxRate('2024-06-30'), 0.0018)
})

test('거래 종류·계좌별 세금 규칙', () => {
  const base = { currency: 'KRW', assetClass: 'kr_stock', accountType: 'general', date: '2026-11-18' }
  assert.equal(taxRule({ ...base, type: 'buy' }).rate, 0)
  assert.equal(taxRule({ ...base, type: 'sell' }).rate, 0.002)
  assert.equal(taxRule({ ...base, assetClass: 'etf_kr', type: 'sell' }).rate, 0)
  assert.equal(taxRule({ ...base, currency: 'USD', assetClass: 'us_stock', type: 'sell' }).rate, 0)
  assert.equal(taxRule({ ...base, type: 'dividend' }).rate, 0.154)
  assert.equal(taxRule({ ...base, accountType: 'isa', type: 'dividend' }).rate, 0)
  assert.equal(taxRule({ ...base, currency: 'USD', assetClass: 'us_stock', accountType: 'isa', type: 'dividend' }).rate, 0.15)
})

test('세금 금액 계산', () => {
  const krDividend = taxRule({ type: 'dividend', currency: 'KRW', assetClass: 'kr_stock', accountType: 'general', date: '2026-11-18' })
  // 소득세 floor(123,456×0.14, 10원)=17,280, 지방세 floor(1,728, 10원)=1,720
  assert.equal(estimateTax(123_456, krDividend, 'dividend', 'KRW'), 19_000)
  const sell = taxRule({ type: 'sell', currency: 'KRW', assetClass: 'kr_stock', accountType: 'general', date: '2026-11-18' })
  assert.equal(estimateTax(1_234_567, sell, 'sell', 'KRW'), 2_469)
  const usDividend = taxRule({ type: 'dividend', currency: 'USD', assetClass: 'us_stock', accountType: 'general', date: '2026-11-18' })
  assert.equal(estimateTax(12.34, usDividend, 'dividend', 'USD'), 1.85)
})

test('세율 표기', () => {
  assert.equal(formatRate(0.00015), '0.015%')
  assert.equal(formatRate(0.002), '0.2%')
  assert.equal(formatRate(0.0000364), '0.00364%')
})
