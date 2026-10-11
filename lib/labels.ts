import type { AssetClass } from '@/lib/types'

export const TX_LABEL: Record<string, string> = {
  buy: '매수', sell: '매도', dividend: '배당',
  deposit: '입금', withdraw: '출금', interest: '이자', fee: '수수료',
}

export const TX_COLOR: Record<string, string> = {
  buy:      'bg-red-50 text-[#d31f47]',
  sell:     'bg-blue-50 text-[#1763c9]',
  dividend: 'bg-blue-50 text-[#3f7fc3]',
  deposit:  'bg-[#edf3f8] text-[#65758a]',
  withdraw: 'bg-[#edf3f8] text-[#65758a]',
  interest: 'bg-blue-50 text-[#3f7fc3]',
  fee:      'bg-[#edf3f8] text-[#65758a]',
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  cash: '입출금·공동계좌', mmf: 'CMA·MMF', general: '주식·증권계좌', pension: '연금저축', irp: 'IRP',
  isa: 'ISA', crypto: '코인', savings: '예적금',
}

export const CLASS_LABEL: Record<AssetClass, string> = {
  kr_stock: '국내주식', us_stock: '미국주식',
  etf_kr: '국내ETF', etf_us: '미국ETF',
  crypto: '코인', deposit: '예적금', other: '기타',
}

// 보유종목 페이지 등 이모지 포함 버전
export const CLASS_LABEL_ICON: Record<AssetClass, string> = {
  kr_stock: '🇰🇷 국내주식', us_stock: '🇺🇸 미국주식',
  etf_kr: '🇰🇷 국내ETF', etf_us: '🇺🇸 미국ETF',
  crypto: '🪙 코인', deposit: '🏦 예적금', other: '기타',
}

export function pnlColor(v: number | null): string {
  if (v === null || v === 0) return 'text-[#65758a]'
  return v > 0 ? 'text-[#d31f47]' : 'text-[#1763c9]'
}

export function krw(n: number): string {
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n))
}
