import type { Asset } from '@/lib/types'

export interface RealizedPnLRow {
  tx_id: string
  date: string
  asset_id: string
  asset_name: string
  symbol: string | null
  quantity: number
  sell_price: number
  avg_cost: number
  currency: string
  pnl: number        // 자산 원화폐 기준
  pnl_krw: number    // KRW 환산
  pnl_pct: number    // 수익률 %
}

interface TxRow {
  id: string
  date: string
  account_id: string
  asset_id: string | null
  type: string
  quantity: number | null
  price: number | null
}

/**
 * 매도 거래 실현손익 계산 (이동평균 원가 기준, 계좌별)
 * buy/sell 순서로 처리하며 매도 시점의 avg_cost를 기록
 */
export function buildRealizedPnL(
  transactions: TxRow[],
  assets: Asset[],
  usdKrw = 1,
): RealizedPnLRow[] {
  const assetMap = new Map(assets.map(a => [a.id, a]))

  // 계좌+종목별 이동평균 원가 추적
  const stateMap = new Map<string, { quantity: number; avgCost: number }>()
  const result: RealizedPnLRow[] = []

  // 날짜 오름차순 정렬 (같은 날은 created_at 순서 유지)
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of sorted) {
    if (!tx.asset_id) continue
    if (tx.type !== 'buy' && tx.type !== 'sell') continue

    const qty = Number(tx.quantity ?? 0)
    const price = Number(tx.price ?? 0)
    if (qty <= 0) continue

    const key = `${tx.account_id}:${tx.asset_id}`
    const s = stateMap.get(key) ?? { quantity: 0, avgCost: 0 }
    const asset = assetMap.get(tx.asset_id)

    if (tx.type === 'buy') {
      if (price <= 0) continue
      const newQty = s.quantity + qty
      s.avgCost = newQty > 0
        ? (s.avgCost * s.quantity + price * qty) / newQty
        : price
      s.quantity = newQty
    } else {
      // sell — avg_cost는 유지, qty만 감소
      if (s.quantity <= 0 || price <= 0) {
        s.quantity = Math.max(0, s.quantity - qty)
        stateMap.set(key, s)
        continue
      }
      const soldQty = Math.min(qty, s.quantity)
      const pnl = (price - s.avgCost) * soldQty
      const fx = asset?.currency === 'USD' ? usdKrw : 1

      result.push({
        tx_id: tx.id,
        date: tx.date,
        asset_id: tx.asset_id,
        asset_name: asset?.name ?? '',
        symbol: asset?.symbol ?? null,
        quantity: soldQty,
        sell_price: price,
        avg_cost: s.avgCost,
        currency: asset?.currency ?? 'KRW',
        pnl,
        pnl_krw: pnl * fx,
        pnl_pct: s.avgCost > 0 ? ((price - s.avgCost) / s.avgCost) * 100 : 0,
      })

      s.quantity = Math.max(0, s.quantity - qty)
    }

    stateMap.set(key, s)
  }

  return result.sort((a, b) => b.date.localeCompare(a.date))
}
