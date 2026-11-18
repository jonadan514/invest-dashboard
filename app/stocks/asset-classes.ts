/** 주식 계좌 화면에서 고를 수 있는 종목 구분. 통화는 구분에 따라 정해진다. */
export const STOCK_CLASSES = [
  { value: 'kr_stock', label: '국내주식', currency: 'KRW' },
  { value: 'etf_kr', label: '국내ETF', currency: 'KRW' },
  { value: 'us_stock', label: '미국주식', currency: 'USD' },
  { value: 'etf_us', label: '미국ETF', currency: 'USD' },
  { value: 'other', label: '기타', currency: 'KRW' },
] as const

const EXTRA_LABELS: Record<string, string> = { crypto: '코인', deposit: '예금' }

export function classLabel(value: string) {
  return STOCK_CLASSES.find(item => item.value === value)?.label ?? EXTRA_LABELS[value] ?? value
}
