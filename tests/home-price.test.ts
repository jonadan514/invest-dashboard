import assert from 'node:assert/strict'
import test from 'node:test'
import { isAutoHomePrice, parseAptTrades, pickHomePrice, tradeMonths } from '../lib/calc/home-price.ts'

const item = (name: string, area: string, amount: string, day: string, cancel = '') =>
  `<item><aptNm>${name}</aptNm><excluUseAr>${area}</excluUseAr><dealAmount>${amount}</dealAmount><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>${day}</dealDay><cdealType>${cancel}</cdealType></item>`

test('실거래가 자동 갱신: 부동산이고 시군구 코드·단지명·면적이 모두 있을 때만', () => {
  const base = { category: 'real_estate', price_lawd_cd: '11680', price_apt_name: '래미안', price_area: 84.97 }
  assert.equal(isAutoHomePrice(base), true)
  assert.equal(isAutoHomePrice({ ...base, price_lawd_cd: '1168' }), false)
  assert.equal(isAutoHomePrice({ ...base, price_apt_name: ' ' }), false)
  assert.equal(isAutoHomePrice({ ...base, price_area: null }), false)
  assert.equal(isAutoHomePrice({ ...base, category: 'deposit' }), false)
})

test('조회 월: 기준 월부터 3개월, 해가 바뀌어도', () => {
  assert.deepEqual(tradeMonths('2026-01'), ['202601', '202512', '202511'])
})

test('응답 읽기: 만원 단위를 원으로, 해제 거래 표시, 오류 응답은 예외', () => {
  const xml = `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${item('래미안 퍼스티지', '84.93', '  355,000', '3')}${item('래미안퍼스티지', '84.93', '340,000', '9', 'O')}</items><totalCount>2</totalCount></body></response>`
  const { trades, totalCount } = parseAptTrades(xml)
  assert.equal(totalCount, 2)
  assert.deepEqual(trades[0], { name: '래미안 퍼스티지', area: 84.93, amount: 3_550_000_000, date: '2026-10-03', canceled: false })
  assert.equal(trades[1].canceled, true)
  assert.throws(() => parseAptTrades('<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>'), /SERVICE_KEY/)
  assert.throws(() => parseAptTrades('<response><header><resultCode>03</resultCode><resultMsg>NO DATA</resultMsg></header></response>'), /NO DATA/)
})

test('금액 고르기: 같은 단지·면적(±1㎡) 해제 안 된 거래의 중간값', () => {
  const { trades } = parseAptTrades(`<items>${[
    item('래미안퍼스티지', '84.93', '350,000', '1'),
    item('래미안 퍼스티지', '84.4', '360,000', '20'),
    item('래미안퍼스티지', '84.93', '900,000', '21', 'O'),
    item('래미안퍼스티지', '59.9', '250,000', '5'),
    item('반포자이', '84.9', '330,000', '7'),
  ].join('')}</items>`)
  const picked = pickHomePrice(trades, '래미안퍼스티지', 84)
  assert.equal(picked.amount, 3_550_000_000)
  assert.equal(picked.count, 2)
  assert.equal(picked.latestDate, '2026-10-20')

  const wrongArea = pickHomePrice(trades, '래미안퍼스티지', 114)
  assert.equal(wrongArea.amount, null)
  assert.equal(wrongArea.sameAptFound, true)
  assert.deepEqual(wrongArea.suggestions, ['84.93㎡', '84.4㎡', '59.9㎡'])

  const partialName = pickHomePrice(trades, '래미안', 84)
  assert.equal(partialName.amount, null)
  assert.deepEqual(partialName.suggestions, ['래미안퍼스티지', '래미안 퍼스티지'])
})
