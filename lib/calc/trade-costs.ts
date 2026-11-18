/**
 * 주식 거래 입력 때 수수료·세금을 미리 채우기 위한 계산.
 * 화면에서는 계산값을 기본으로 넣고, 증권사 체결 내역과 다르면 직접 고쳐 쓴다.
 */

export type TradeType = 'buy' | 'sell' | 'dividend'

/** 지난 거래가 없을 때 쓰는 기본 수수료율(비대면 온라인 기준 흔한 값). */
export const DEFAULT_FEE_RATE: Record<string, number> = { KRW: 0.00015, USD: 0.0025 }

/** 배당 원천징수가 없는(과세이연) 계좌 유형. */
const TAX_DEFERRED_ACCOUNTS = new Set(['pension', 'irp', 'isa'])

export interface FeeHistoryRow {
  account_id: string
  type: string
  quantity: number | null
  price: number | null
  fee: number | null
  currency: string | null
  date: string
}

export function feeRateKey(accountId: string, currency: string) {
  return `${accountId}:${currency}`
}

/**
 * 계좌·통화별 최근 매수·매도 5건(수수료가 있는 거래)의 수수료 합 ÷ 거래금액 합.
 * 작은 거래의 원 단위 절사 오차를 줄이려고 한 건이 아닌 여러 건을 합쳐 본다.
 */
export function inferFeeRates(rows: FeeHistoryRow[], sample = 5): Record<string, number> {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  const groups = new Map<string, { fee: number; gross: number; count: number }>()
  for (const row of sorted) {
    if (row.type !== 'buy' && row.type !== 'sell') continue
    const gross = Number(row.quantity ?? 0) * Number(row.price ?? 0)
    const fee = Number(row.fee ?? 0)
    if (!(gross > 0) || !(fee > 0)) continue
    const key = feeRateKey(row.account_id, row.currency ?? 'KRW')
    const group = groups.get(key) ?? { fee: 0, gross: 0, count: 0 }
    if (group.count >= sample) continue
    group.fee += fee
    group.gross += gross
    group.count += 1
    groups.set(key, group)
  }
  const result: Record<string, number> = {}
  for (const [key, group] of groups) result[key] = Math.round(group.fee / group.gross * 1e7) / 1e7
  return result
}

/** 국내 상장 주식 매도 시 증권거래세(농어촌특별세 포함) 합계 세율. */
export function krStockSellTaxRate(date: string) {
  if (date >= '2026-01-01') return 0.002
  if (date >= '2025-01-01') return 0.0015
  if (date >= '2024-01-01') return 0.0018
  return 0.002
}

export interface TaxRule {
  rate: number
  note: string
}

export function taxRule(input: { type: TradeType; currency: string; assetClass: string; accountType: string | null; date: string }): TaxRule {
  const { type, currency, assetClass, accountType, date } = input
  if (type === 'buy') return { rate: 0, note: '매수는 세금이 없어요.' }
  if (type === 'sell') {
    if (currency === 'USD') return { rate: 0, note: '미국 주식 매도는 세금 0. SEC 수수료가 찍혔으면 직접 넣어 주세요.' }
    if (assetClass === 'kr_stock') {
      const rate = krStockSellTaxRate(date)
      return { rate, note: `증권거래세 ${formatRate(rate)} 자동 계산` }
    }
    if (assetClass === 'etf_kr') return { rate: 0, note: '국내 ETF는 증권거래세가 없어요.' }
    return { rate: 0, note: '세금이 있으면 직접 넣어 주세요.' }
  }
  if (currency === 'USD') return { rate: 0.15, note: '미국 배당 원천징수 15% 자동 계산' }
  if (accountType && TAX_DEFERRED_ACCOUNTS.has(accountType)) return { rate: 0, note: '연금·IRP·ISA 계좌는 배당 원천징수가 없어요.' }
  return { rate: 0.154, note: '배당소득세 15.4%(지방세 포함) 자동 계산' }
}

/** 수수료: 원화는 원 미만 절사, 달러는 센트 반올림. */
export function estimateFee(gross: number, rate: number, currency: string) {
  if (!(gross > 0) || !(rate > 0)) return 0
  const fee = gross * rate
  return currency === 'USD' ? Math.round(fee * 100) / 100 : Math.floor(fee)
}

/**
 * 세금. 원화 배당은 소득세 14%·지방소득세(소득세의 10%)를 각각 10원 미만 절사,
 * 그 밖의 원화 세금은 원 미만 절사, 달러는 센트 반올림.
 */
export function estimateTax(base: number, rule: TaxRule, type: TradeType, currency: string) {
  if (!(base > 0) || !(rule.rate > 0)) return 0
  if (currency === 'USD') return Math.round(base * rule.rate * 100) / 100
  if (type === 'dividend' && rule.rate === 0.154) {
    const income = Math.floor(base * 0.14 / 10) * 10
    return income + Math.floor(income * 0.1 / 10) * 10
  }
  return Math.floor(base * rule.rate)
}

/** 0.00015 → '0.015%' */
export function formatRate(rate: number) {
  return `${Number((rate * 100).toFixed(5))}%`
}
