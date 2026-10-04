import type { AssetClass } from '@/lib/types'

export const TX_LABEL: Record<string, string> = {
  buy: '매수', sell: '매도', dividend: '배당',
  deposit: '입금', withdraw: '출금', interest: '이자', fee: '수수료',
}

export const TX_COLOR: Record<string, string> = {
  buy:      'bg-red-50 text-[#d31f47]',
  sell:     'bg-blue-50 text-[#1763c9]',
  dividend: 'bg-emerald-50 text-[#1c6b4a]',
  deposit:  'bg-[#f0ead8] text-[#9c9484]',
  withdraw: 'bg-[#f0ead8] text-[#9c9484]',
  interest: 'bg-emerald-50 text-[#1c6b4a]',
  fee:      'bg-[#f0ead8] text-[#9c9484]',
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  general: '일반', pension: '연금저축', irp: 'IRP',
  isa: 'ISA', crypto: '코인', savings: '예적금',
  debt: '대출/부채', cash: '현금', mmf: 'MMF',
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
  if (v === null || v === 0) return 'text-[#9c9484]'
  return v > 0 ? 'text-[#d31f47]' : 'text-[#1763c9]'
}

export function krw(n: number): string {
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n))
}
