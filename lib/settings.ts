export const ALLOCATION_CLASSES = [
  { key: 'kr_stock', label: '국내주식' },
  { key: 'us_stock', label: '미국주식' },
  { key: 'etf_kr', label: '국내ETF' },
  { key: 'etf_us', label: '미국ETF' },
  { key: 'crypto', label: '코인' },
  { key: 'deposit', label: '예적금' },
  { key: 'other', label: '기타' },
] as const

export const DEFAULT_TARGET_ALLOCATION: Record<string, number> = {
  kr_stock: 30,
  us_stock: 30,
  etf_kr: 10,
  etf_us: 10,
  crypto: 10,
  deposit: 10,
  other: 0,
}

