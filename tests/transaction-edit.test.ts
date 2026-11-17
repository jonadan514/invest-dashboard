import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTransactionUpdate } from '../lib/transaction-edit.ts'

const owner = 'household'
const asset = { id: 'stock', user_id: owner, currency: 'USD' }
const buy = { type: 'buy', user_id: owner, asset_id: asset.id, currency: 'USD' }
const deposit = { type: 'deposit', user_id: owner, asset_id: null, currency: 'KRW' }
function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ date: '2026-10-19', type: 'buy', quantity: '2', price: '30',
    cash_amount: '100', fee: '1', tax: '2', fx_rate: '1400', ...overrides })) data.set(key, value)
  return data
}

test('현금→종목 및 종목→현금 유형 변경은 서버에서 거부한다', () => {
  for (const type of ['buy', 'sell', 'dividend']) {
    assert.throws(() => buildTransactionUpdate(deposit, null, owner, form({ type })), /새 거래로/)
  }
  for (const type of ['deposit', 'withdraw', 'interest', 'fee']) {
    assert.throws(() => buildTransactionUpdate(buy, asset, owner, form({ type })), /새 거래로/)
  }
})

test('거래 및 연결 종목의 소유자와 종목 식별자를 검증한다', () => {
  assert.throws(() => buildTransactionUpdate(null, asset, owner, form()), /찾을 수/)
  assert.throws(() => buildTransactionUpdate({ ...buy, user_id: 'other' }, asset, owner, form()), /찾을 수/)
  for (const invalid of [null, { ...asset, user_id: 'other' }, { ...asset, id: 'other' }]) {
    assert.throws(() => buildTransactionUpdate(buy, invalid, owner, form()), /종목을 확인/)
  }
  assert.throws(() => buildTransactionUpdate({ ...buy, asset_id: null }, asset, owner, form()), /종목을 확인/)
})

test('기존의 잘못된 종목 연결 현금 거래를 묵시적으로 저장하지 않는다', () => {
  assert.throws(() => buildTransactionUpdate({ ...deposit, asset_id: asset.id }, asset, owner,
    form({ type: 'interest' })), /금액과 통화를 확인하여 새 거래로/)
})

test('매수→매도는 보유 종목 통화와 거래 당시 환율로 수량×단가를 저장한다', () => {
  const result = buildTransactionUpdate(buy, asset, owner, form({ type: 'sell', currency: 'KRW', asset_id: 'forged' }))
  assert.deepEqual(result, { date: '2026-10-19', type: 'sell', asset_id: 'stock', currency: 'USD',
    quantity: 2, price: 30, amount: 60, fee: 1, tax: 2, fx_rate: 1400 })
})

test('배당은 수량 없이 수령액을 수정하고 매수에서 전환할 때 수량과 단가를 지운다', () => {
  const result = buildTransactionUpdate({ ...buy, type: 'dividend' }, asset, owner,
    form({ type: 'dividend', quantity: '', price: '', cash_amount: '12.5' }))
  assert.equal(result.amount, 12.5)
  assert.equal(result.quantity, null)
  assert.equal(result.price, null)
  assert.equal(result.asset_id, asset.id)
  assert.equal(buildTransactionUpdate(buy, asset, owner, form({ type: 'dividend' })).amount, 100)
})

test('현금 유형 수정은 불필요한 수량/단가를 제거하며 원화 환율은 1로 맞춘다', () => {
  const result = buildTransactionUpdate(deposit, null, owner, form({ type: 'withdraw', cash_amount: '0' }))
  assert.equal(result.amount, 0)
  assert.equal(result.asset_id, null)
  assert.equal(result.quantity, null)
  assert.equal(result.price, null)
  assert.equal(result.currency, 'KRW')
  assert.equal(result.fx_rate, 1)
})

test('유효한 USD 현금 거래는 기존 통화와 환율을 보존한다', () => {
  const result = buildTransactionUpdate({ ...deposit, currency: 'USD' }, null, owner, form({ type: 'interest' }))
  assert.equal(result.currency, 'USD')
  assert.equal(result.fx_rate, 1400)
})

test('매수·매도 필수 숫자 누락, 음수, 무한대와 금액 오버플로를 거부한다', () => {
  for (const name of ['quantity', 'price', 'fee', 'tax']) {
    for (const value of ['-1', 'NaN', 'Infinity']) {
      assert.throws(() => buildTransactionUpdate(buy, asset, owner, form({ [name]: value })), /유효한 숫자/)
    }
  }
  for (const name of ['quantity', 'price']) {
    assert.throws(() => buildTransactionUpdate(buy, asset, owner, form({ [name]: '' })), /입력해/)
  }
  assert.throws(() => buildTransactionUpdate(buy, asset, owner, form({ quantity: '1e308', price: '1e308' })), /너무 큽니다/)
  for (const type of ['buy', 'sell']) {
    for (const name of ['quantity', 'price']) {
      assert.throws(() => buildTransactionUpdate(buy, asset, owner, form({ type, [name]: '0' })), /0보다 커야/)
    }
  }
})

test('유효하지 않은 유형, 날짜, 현금 금액 및 USD 환율을 거부한다', () => {
  assert.throws(() => buildTransactionUpdate(buy, asset, owner, form({ type: 'unknown' })), /거래 유형/)
  assert.throws(() => buildTransactionUpdate(buy, asset, owner, form({ date: '2026-02-30' })), /거래 날짜/)
  for (const cash_amount of ['', '-2', 'Infinity']) {
    assert.throws(() => buildTransactionUpdate(deposit, null, owner, form({ type: 'deposit', cash_amount })))
  }
  for (const fx_rate of ['', '1', '-1', 'NaN']) {
    assert.throws(() => buildTransactionUpdate(buy, asset, owner, form({ fx_rate })), /환율/)
  }
})
