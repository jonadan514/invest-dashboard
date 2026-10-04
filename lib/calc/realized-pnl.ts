import type { Asset } from '@/lib/types'

export interface RealizedPnLRow {
  tx_id: string
  date: string
  created_at?: string | null
  asset_id: string
  asset_name: string
  symbol: string | null
  quantity: number
  sell_price: number
  avg_cost: number
  currency: string
  pnl: number        // 자산 원화폐 기준
  pnl_krw: number    // 거래시점 환율을 반영한 KRW 손익
  pnl_pct: number    // KRW 원가 기준 수익률 %
}

interface TxRow {
  id: string
  date: string
  created_at?: string | null
  account_id: string
  asset_id: string | null
  type: string
  quantity: number | null
  price: number | null
  fx_rate?: number | null
  fee?: number | null
  tax?: number | null
}

function transactionFx(currency: string, txFx: number | null | undefined, fallbackUsdKrw: number): number {
  if (currency !== 'USD') return 1
  const fx = Number(txFx ?? 0)
  return fx > 100 ? fx : fallbackUsdKrw
}

/**
 * 매도 거래 실현손익 계산 (이동평균 원가 기준, 계좌별)
 * 해외자산은 매수·매도 각각의 거래시점 환율을 반영해 원화 손익을 계산한다.
 */
export function buildRealizedPnL(
  transactions: TxRow[],
  assets: Asset[],
  fallbackUsdKrw = 1,
): RealizedPnLRow[] {
  const assetMap = new Map(assets.map(a => [a.id, a]))

  const stateMap = new Map<string, {
    quantity: number
    avgCost: number
    avgCostKrw: number
  }>()
  const result: RealizedPnLRow[] = []

  const sorted = [...transactions].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date)
    if (dateCmp !== 0) return dateCmp
    return (a.created_at ?? '').localeCompare(b.created_at ?? '')
  })

  for (const tx of sorted) {
    if (!tx.asset_id) continue
    if (tx.type !== 'buy' && tx.type !== 'sell') continue

    const qty = Number(tx.quantity ?? 0)
    const price = Number(tx.price ?? 0)
    if (qty <= 0) continue

    const key = `${tx.account_id}:${tx.asset_id}`
    const s = stateMap.get(key) ?? { quantity: 0, avgCost: 0, avgCostKrw: 0 }
    const asset = assetMap.get(tx.asset_id)
    if (!asset) continue
    const fx = transactionFx(asset.currency, tx.fx_rate, fallbackUsdKrw)

    if (tx.type === 'buy') {
      if (price <= 0) continue
      const charges = Number(tx.fee ?? 0) + Number(tx.tax ?? 0)
      const grossCost = price * qty + charges
      const unitCost = grossCost / qty
      const newQty = s.quantity + qty
      s.avgCost = newQty > 0
        ? (s.avgCost * s.quantity + unitCost * qty) / newQty
        : unitCost
      s.avgCostKrw = newQty > 0
        ? (s.avgCostKrw * s.quantity + unitCost * fx * qty) / newQty
        : unitCost * fx
      s.quantity = newQty
    } else {
      if (s.quantity <= 0 || price <= 0) {
        s.quantity = Math.max(0, s.quantity - qty)
        stateMap.set(key, s)
        continue
      }

      const soldQty = Math.min(qty, s.quantity)
      const sellChargeRatio = qty > 0 ? soldQty / qty : 0
      const sellCharges = (Number(tx.fee ?? 0) + Number(tx.tax ?? 0)) * sellChargeRatio
      const netProceeds = price * soldQty - sellCharges
      const pnl = netProceeds - s.avgCost * soldQty
      const proceedsKrw = netProceeds * fx
      const costKrw = s.avgCostKrw * soldQty
      const pnlKrw = proceedsKrw - costKrw

      result.push({
        tx_id: tx.id,
        date: tx.date,
        asset_id: tx.asset_id,
        asset_name: asset.name,
        symbol: asset.symbol,
        quantity: soldQty,
        sell_price: price,
        avg_cost: s.avgCost,
        currency: asset.currency,
        pnl,
        pnl_krw: pnlKrw,
        pnl_pct: costKrw > 0 ? (pnlKrw / costKrw) * 100 : 0,
      })

      s.quantity = Math.max(0, s.quantity - qty)
    }

    stateMap.set(key, s)
  }

  return result.sort((a, b) => b.date.localeCompare(a.date))
}
