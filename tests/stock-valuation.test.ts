import assert from 'node:assert/strict'
import test from 'node:test'
import { stockValueByAccount } from '../lib/calc/stock-valuation.ts'

test('계좌별로 현재가가 있는 종목 평가액만 더하고 빠진 종목 수를 센다', () => {
  assert.deepEqual(stockValueByAccount([
    { account_id: 'a', market_value_krw: 8_700_000 },
    { account_id: 'a', market_value_krw: 4_779_270.4 },
    { account_id: 'b', market_value_krw: null },
  ]), {
    a: { value: 13_479_270, holdings: 2, missing: 0 },
    b: { value: 0, holdings: 1, missing: 1 },
  })
  assert.deepEqual(stockValueByAccount([]), {})
})
