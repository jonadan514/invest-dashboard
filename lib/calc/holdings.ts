import type { Account, Asset, Holding } from '@/lib/types'
import type { PriceRow } from '@/lib/prices/refresh'

interface TxRow {
  type: string
  quantity: number | null
  price: number | null
  amount: number | null
  asset_id: string | null
  account_id: string
  date: string
}

export function buildHoldings(
  transactions: TxRow[],
  assets: Asset[],
  accounts: Account[],
  priceMap?: Map<string, PriceRow>,
  usdKrw = 1,
): Holding[] {
  const assetMap = new Map(assets.map(a => [a.id, a]))
  const accountMap = new Map(accounts.map(a => [a.id, a]))

  // 이동평균 원가 계산: key = `${account_id}:${asset_id}`
  const stateMap = new Map<string, { quantity: number; avg_cost: number }>()

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of sorted) {
    if (!tx.asset_id) continue
    if (tx.type !== 'buy' && tx.type !== 'sell') continue
    const qty = Number(tx.quantity ?? 0)
    if (qty <= 0) continue

    const key = `${tx.account_id}:${tx.asset_id}`
    const s = stateMap.get(key) ?? { quantity: 0, avg_cost: 0 }

    if (tx.type === 'buy') {
      const price = Number(tx.price ?? (tx.amount && qty > 0 ? Number(tx.amount) / qty : 0))
      const newQty = s.quantity + qty
      s.avg_cost = newQty > 0 ? (s.avg_cost * s.quantity + price * qty) / newQty : price
      s.quantity = newQty
    } else {
      s.quantity = Math.max(0, s.quantity - qty)
    }

    stateMap.set(key, s)
  }

  const holdings: Holding[] = []

  for (const [key, state] of stateMap) {
    if (state.quantity <= 0) continue
    const [account_id, asset_id] = key.split(':')
    const asset = assetMap.get(asset_id)
    const account = accountMap.get(account_id)
    if (!asset || !account) continue

    const fx = asset.currency === 'USD' ? usdKrw : 1
    const total_cost = state.avg_cost * state.quantity
    const total_cost_krw = total_cost * fx

    const priceRow = priceMap?.get(asset_id)
    const current_price = priceRow?.price ?? null
    const prev_close = priceRow?.prev_close ?? null
    const market_value_krw = current_price !== null ? current_price * state.quantity * fx : null
    const unrealized_pnl_krw = market_value_krw !== null ? market_value_krw - total_cost_krw : null
    const unrealized_pnl_pct =
      total_cost_krw > 0 && unrealized_pnl_krw !== null
        ? (unrealized_pnl_krw / total_cost_krw) * 100
        : null

    holdings.push({
      asset_id,
      symbol: asset.symbol,
      name: asset.name,
      asset_class: asset.asset_class,
      currency: asset.currency,
      account_id,
      account_name: account.name,
      owner: account.owner,
      quantity: state.quantity,
      avg_cost: state.avg_cost,
      total_cost,
      total_cost_krw,
      current_price,
      prev_close,
      market_value_krw,
      unrealized_pnl_krw,
      unrealized_pnl_pct,
      fx_rate: fx,
    })
  }

  // 평가금액 내림차순 → 투자원금 내림차순
  return holdings.sort((a, b) => {
    const av = a.market_value_krw ?? a.total_cost_krw
    const bv = b.market_value_krw ?? b.total_cost_krw
    return bv - av
  })
}
