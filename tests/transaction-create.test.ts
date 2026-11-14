import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNewAsset, buildTransactionInsert } from '../lib/transaction-edit.ts'

const owner = 'household'
const account = { id: 'acct', user_id: owner }
const usdAsset = { id: 'stock', user_id: owner, currency: 'USD' }
const krwAsset = { id: 'kr', user_id: owner, currency: 'KRW' }

function form(overrides: Record<string, string> = {}, omit: string[] = []) {
  const data = new FormData()
  const base: Record<string, string> = { date: '2026-11-14', account_id: 'acct', asset_id: 'stock', type: 'buy',
    quantity: '2', price: '30', fee: '1', tax: '0', fx_rate: '1400', currency: 'USD', ...overrides }
  for (const [key, value] of Object.entries(base)) if (!omit.includes(key)) data.set(key, value)
  return data
}

test('USD 매수는 종목 통화와 거래 당시 환율로 수량×단가를 저장한다', () => {
  const row = buildTransactionInsert(account, usdAsset, owner, form({ currency: 'KRW' }))
  assert.deepEqual(row, { user_id: owner, date: '2026-11-14', account_id: 'acct', asset_id: 'stock', type: 'buy',
    quantity: 2, price: 30, amount: 60, currency: 'USD', fx_rate: 1400, fee: 1, tax: 0 })
})

test('USD 거래의 환율 누락을 1로 저장하지 않고 거부한다', () => {
  assert.throws(() => buildTransactionInsert(account, usdAsset, owner, form({}, ['fx_rate'])), /환율/)
  assert.throws(() => buildTransactionInsert(account, usdAsset, owner, form({ fx_rate: '1' })), /환율/)
})

test('원화 종목은 폼 환율과 무관하게 환율 1로 저장한다', () => {
  const row = buildTransactionInsert(account, krwAsset, owner, form({ asset_id: 'kr', fx_rate: '9999' }))
  assert.equal(row.currency, 'KRW')
  assert.equal(row.fx_rate, 1)
})

test('다른 소유자의 계좌·종목과 위조된 종목 ID를 거부한다', () => {
  assert.throws(() => buildTransactionInsert(null, usdAsset, owner, form()), /계좌/)
  assert.throws(() => buildTransactionInsert({ ...account, user_id: 'other' }, usdAsset, owner, form()), /계좌/)
  assert.throws(() => buildTransactionInsert(account, { ...usdAsset, user_id: 'other' }, owner, form()), /종목/)
  assert.throws(() => buildTransactionInsert(account, usdAsset, owner, form({ asset_id: 'forged' })), /종목/)
  assert.throws(() => buildTransactionInsert(account, null, owner, form()), /종목을 선택/)
})

test('수량·단가·금액·날짜·유형의 잘못된 값을 거부한다', () => {
  const bads: Record<string, string>[] = [{ quantity: '0' }, { quantity: '-1' }, { price: 'abc' }, { price: 'Infinity' },
    { quantity: '1e308', price: '1e308' }]
  for (const bad of bads) {
    assert.throws(() => buildTransactionInsert(account, usdAsset, owner, form(bad)))
  }
  assert.throws(() => buildTransactionInsert(account, usdAsset, owner, form({ date: '2026-02-30' })), /날짜/)
  assert.throws(() => buildTransactionInsert(account, usdAsset, owner, form({ type: 'transfer' })), /유형/)
  assert.throws(() => buildTransactionInsert(account, null, owner,
    form({ type: 'deposit', currency: 'KRW', cash_amount: '0' })), /0보다/)
  assert.throws(() => buildTransactionInsert(account, null, owner,
    form({ type: 'deposit', currency: 'JPY', cash_amount: '100' })), /통화/)
})

test('현금 거래는 종목·수량·단가 없이 금액만 저장한다', () => {
  const row = buildTransactionInsert(account, null, owner,
    form({ type: 'deposit', cash_amount: '500000' }, ['currency', 'quantity', 'price']))
  assert.equal(row.asset_id, null)
  assert.equal(row.quantity, null)
  assert.equal(row.price, null)
  assert.equal(row.amount, 500000)
  assert.equal(row.currency, 'KRW')
  assert.equal(row.fx_rate, 1)
})

test('새 종목 입력은 이름·자산군·통화를 검증한다', () => {
  const data = new FormData()
  data.set('asset_name', ' Apple ')
  data.set('asset_symbol', ' AAPL ')
  data.set('asset_class', 'us_stock')
  data.set('asset_currency', 'USD')
  assert.deepEqual(buildNewAsset(owner, data),
    { user_id: owner, name: 'Apple', symbol: 'AAPL', asset_class: 'us_stock', currency: 'USD', price_source: 'manual' })
  data.set('asset_class', 'bond')
  assert.throws(() => buildNewAsset(owner, data), /자산군/)
  data.set('asset_class', 'us_stock')
  data.set('asset_currency', 'EUR')
  assert.throws(() => buildNewAsset(owner, data), /통화/)
  data.set('asset_currency', 'USD')
  data.set('asset_name', '  ')
  assert.throws(() => buildNewAsset(owner, data), /이름/)
})
