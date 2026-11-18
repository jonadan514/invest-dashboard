import type { Holding } from '../types.ts'

export interface AccountStockValue {
  /** 현재가가 있는 보유 종목 평가금액 합계(원). */
  value: number
  holdings: number
  /** 현재가가 없어 합계에서 빠진 종목 수. */
  missing: number
}

/** 보유 종목을 계좌별로 묶어 월간 기록의 '보유종목 평가액 불러오기'에 쓴다. */
export function stockValueByAccount(holdings: Pick<Holding, 'account_id' | 'market_value_krw'>[]) {
  const result: Record<string, AccountStockValue> = {}
  for (const holding of holdings) {
    const entry = result[holding.account_id] ??= { value: 0, holdings: 0, missing: 0 }
    entry.holdings += 1
    if (holding.market_value_krw === null) entry.missing += 1
    else entry.value += holding.market_value_krw
  }
  for (const entry of Object.values(result)) entry.value = Math.round(entry.value)
  return result
}
