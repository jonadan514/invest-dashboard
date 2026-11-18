import { ASSET_CLASSES } from './transaction-edit.ts'

/** 구분에 따라 통화가 정해지는 종목. 그 밖(기타·코인·예금)은 기존 통화를 유지한다. */
const CLASS_CURRENCY: Record<string, string> = { kr_stock: 'KRW', etf_kr: 'KRW', us_stock: 'USD', etf_us: 'USD' }

export function currencyForClass(assetClass: string, fallback: string) {
  return CLASS_CURRENCY[assetClass] ?? fallback
}

type StoredAsset = { id: string; user_id: string; currency: string }

/**
 * 종목 수정 입력을 검증한다.
 * 거래가 있는 종목은 원화↔달러가 바뀌는 구분 변경을 막는다. 이미 적은 단가·배당금의 단위가 달라지기 때문이다.
 * duplicateSymbol: 같은 코드를 쓰는 다른 종목이 있으면 true.
 */
export function buildAssetUpdate(
  stored: StoredAsset | null, userId: string, form: FormData,
  context: { hasTransactions: boolean; duplicateSymbol: boolean },
) {
  if (!stored || stored.user_id !== userId) throw new Error('수정할 종목을 찾을 수 없습니다.')
  const name = form.get('name')
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) throw new Error('종목 이름을 확인해 주세요.')
  const rawSymbol = form.get('symbol')
  const symbol = typeof rawSymbol === 'string' && rawSymbol.trim() ? rawSymbol.trim() : null
  if (symbol && symbol.length > 64) throw new Error('종목 코드를 확인해 주세요.')
  if (symbol && context.duplicateSymbol) throw new Error(`코드 ${symbol}을(를) 쓰는 종목이 이미 있어요. 거래를 그 종목으로 옮긴 뒤 이 종목을 지워 주세요.`)
  const asset_class = form.get('asset_class')
  if (typeof asset_class !== 'string' || !(ASSET_CLASSES as readonly string[]).includes(asset_class)) {
    throw new Error('구분을 확인해 주세요.')
  }
  const currency = currencyForClass(asset_class, stored.currency)
  if (currency !== stored.currency && context.hasTransactions) {
    throw new Error(`거래가 있는 종목은 ${stored.currency === 'KRW' ? '원화' : '달러'} 종목에서 ${currency === 'KRW' ? '원화' : '달러'} 종목으로 바꿀 수 없어요. 새 종목으로 거래를 다시 입력해 주세요.`)
  }
  return { name: name.trim(), symbol, asset_class, currency, currencyChanged: currency !== stored.currency }
}

export function assertAssetDeletable(stored: StoredAsset | null, userId: string, hasTransactions: boolean) {
  if (!stored || stored.user_id !== userId) throw new Error('삭제할 종목을 찾을 수 없습니다.')
  if (hasTransactions) throw new Error('거래가 있는 종목은 지울 수 없어요. 거래를 먼저 지우거나 다른 종목으로 옮겨 주세요.')
}
