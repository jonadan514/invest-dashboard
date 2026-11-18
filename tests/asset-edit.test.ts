import assert from 'node:assert/strict'
import test from 'node:test'
import { assertAssetDeletable, buildAssetUpdate, currencyForClass } from '../lib/asset-edit.ts'

const owner = 'household'
const krAsset = { id: 'a', user_id: owner, currency: 'KRW' }
const free = { hasTransactions: false, duplicateSymbol: false }
function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ name: '삼성전자', symbol: '005930', asset_class: 'kr_stock', ...values })) data.set(key, value)
  return data
}

test('구분에 따라 통화가 정해진다', () => {
  assert.equal(currencyForClass('us_stock', 'KRW'), 'USD')
  assert.equal(currencyForClass('etf_kr', 'USD'), 'KRW')
  assert.equal(currencyForClass('other', 'USD'), 'USD')
})

test('이름·코드·구분을 정리해 수정한다', () => {
  assert.deepEqual(buildAssetUpdate(krAsset, owner, form({ name: '  삼성전자우 ', symbol: ' ', asset_class: 'etf_kr' }), free),
    { name: '삼성전자우', symbol: null, asset_class: 'etf_kr', currency: 'KRW', currencyChanged: false })
  assert.deepEqual(buildAssetUpdate(krAsset, owner, form({ name: 'Apple', symbol: 'AAPL', asset_class: 'us_stock' }), free),
    { name: 'Apple', symbol: 'AAPL', asset_class: 'us_stock', currency: 'USD', currencyChanged: true })
})

test('거래가 있으면 원화↔달러 변경을 막고, 같은 통화 안의 변경은 허용한다', () => {
  const used = { ...free, hasTransactions: true }
  assert.throws(() => buildAssetUpdate(krAsset, owner, form({ asset_class: 'us_stock' }), used), /원화 종목에서 달러 종목/)
  assert.equal(buildAssetUpdate(krAsset, owner, form({ asset_class: 'etf_kr' }), used).asset_class, 'etf_kr')
})

test('잘못된 입력과 남의 종목을 거부한다', () => {
  assert.throws(() => buildAssetUpdate(null, owner, form({}), free), /찾을 수/)
  assert.throws(() => buildAssetUpdate({ ...krAsset, user_id: 'x' }, owner, form({}), free), /찾을 수/)
  assert.throws(() => buildAssetUpdate(krAsset, owner, form({ name: ' ' }), free), /이름/)
  assert.throws(() => buildAssetUpdate(krAsset, owner, form({ asset_class: 'bond' }), free), /구분/)
  assert.throws(() => buildAssetUpdate(krAsset, owner, form({}), { ...free, duplicateSymbol: true }), /이미 있어요/)
})

test('거래가 있는 종목은 지울 수 없다', () => {
  assert.throws(() => assertAssetDeletable(krAsset, owner, true), /지울 수 없어요/)
  assert.throws(() => assertAssetDeletable(null, owner, false), /찾을 수/)
  assert.doesNotThrow(() => assertAssetDeletable(krAsset, owner, false))
})
