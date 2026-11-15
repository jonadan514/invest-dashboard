import assert from 'node:assert/strict'
import test from 'node:test'
import { signedWonShort, wonShort } from '../lib/labels.ts'

test('큰 금액을 억·만 단위로 줄여 쓴다', () => {
  assert.equal(wonShort(536_700_000), '5억 3,670만')
  assert.equal(wonShort(854_200_000), '8억 5,420만')
  assert.equal(wonShort(300_000_000), '3억')
  assert.equal(wonShort(31_000_000), '3,100만')
  assert.equal(wonShort(500_000), '50만')
  assert.equal(wonShort(1_234_500_000_000), '12,345억')
  assert.equal(wonShort(9_500), '9,500원')
  assert.equal(wonShort(0), '0원')
  assert.equal(wonShort(-24_600_000), '-2,460만')
  assert.equal(wonShort(99_995_000), '1억', '만 단위 반올림이 억으로 올라간다')
})

test('증감은 부호를 붙인다', () => {
  assert.equal(signedWonShort(24_600_000), '+2,460만')
  assert.equal(signedWonShort(-700_000), '-70만')
  assert.equal(signedWonShort(0), '0원')
})
