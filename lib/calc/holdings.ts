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
  fx_rate?: number | null
}

function transactionFx(currency: string, txFx: number | null | undefined, fallbackUsdKrw: number): number {
  if (currency !== 'USD') return 1
  const fx = Number(txFx ?? 0)
  // 기존 데이터는 fx_rate default=1로 저장된 건이 있어 현재 환율로 임시 fallback.
  // 신규/수정 거래는 실제 거래시점 환율을 저장한다.
  return fx > 100 ? fx : fallbackUsdKrw
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

  // 계좌+종목별 이동평균 원가. native와 KRW 원가를 별도로 고정한다.
  const stateMap = new Map<string, {
    quantity: number
    avg_cost: number
    avg_cost_krw: number
  }>()

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of sorted) {
    if (!tx.asset_id) continue
    if (tx.type !== 'buy' && tx.type !== 'sell') continue

    const qty = Number(tx.quantity ?? 0)
    if (qty <= 0) continue

    const asset = assetMap.get(tx.asset_id)
    if (!asset) continue

    const key = `${tx.account_id}:${tx.asset_id}`
    const s = stateMap.get(key) ?? { quantity: 0, avg_cost: 0, avg_cost_krw: 0 }

    if (tx.type === 'buy') {
      const price = Number(tx.price ?? (tx.amount && qty > 0 ? Number(tx.amount) / qty : 0))
      if (price <= 0) continue

      const fx = transactionFx(asset.currency, tx.fx_rate, usdKrw)
      const unitCostKrw = price * fx
      const newQty = s.quantity + qty

      s.avg_cost = newQty > 0
        ? (s.avg_cost * s.quantity + price * qty) / newQty
        : price
      s.avg_cost_krw = newQty > 0
        ? (s.avg_cost_krw * s.quantity + unitCostKrw * qty) / newQty
        : unitCostKrw
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

    const currentFx = asset.currency === 'USD' ? usdKrw : 1
    const total_cost = state.avg_cost * state.quantity
    const total_cost_krw = state.avg_cost_krw * state.quantity

    const priceRow = priceMap?.get(asset_id)
    const current_price = priceRow?.price ?? null
    const prev_close = priceRow?.prev_close ?? null
    const market_value_krw = current_price !== null
      ? current_price * state.quantity * currentFx
      : null
    const unrealized_pnl_krw = market_value_krw !== null
      ? market_value_krw - total_cost_krw
      : null
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
      avg_cost_krw: state.avg_cost_krw,
      total_cost,
      total_cost_krw,
      current_price,
      prev_close,
      market_value_krw,
      unrealized_pnl_krw,
      unrealized_pnl_pct,
      fx_rate: currentFx,
    })
  }

  return holdings.sort((a, b) => {
    const av = a.market_value_krw ?? a.total_cost_krw
    const bv = b.market_value_krw ?? b.total_cost_krw
    return bv - av
  })
}
