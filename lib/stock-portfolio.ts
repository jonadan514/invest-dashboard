import { buildHoldings, type PriceRow } from './calc/holdings.ts'
import { INVESTMENT_ACCOUNT_TYPES } from './calc/home-insights.ts'
import type { Account, Asset, Holding } from './types.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { from: (table: string) => any }

export interface StockPortfolio {
  holdings: Holding[]
  usdKrw: number | null
  /** 종목별 현재가 갱신 시각(ISO). */
  priceAsOf: Map<string, string>
}

/** 홈처럼 주식 계좌 화면 밖에서 쓰는 보유 종목·현재가 묶음. 거래가 없으면 빈 보유 목록을 돌려준다. */
export async function loadStockPortfolio(supabase: Client, userId: string): Promise<StockPortfolio> {
  const [accounts, assets, trades, fx] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('assets').select('*').eq('user_id', userId),
    supabase.from('transactions').select('date, created_at, account_id, asset_id, type, quantity, price, amount, fee, tax, fx_rate').eq('user_id', userId).in('type', ['buy', 'sell']),
    supabase.from('fx_rates').select('rate').eq('pair', 'USDKRW').maybeSingle(),
  ])
  for (const result of [accounts, assets, trades, fx]) if (result.error) throw new Error(result.error.message)
  const assetRows = (assets.data ?? []) as Asset[]
  const usdKrw: number | null = fx.data ? Number(fx.data.rate) : null
  const priceAsOf = new Map<string, string>()
  if (assetRows.length === 0 || (trades.data ?? []).length === 0) return { holdings: [], usdKrw, priceAsOf }
  const prices = await supabase.from('prices').select('asset_id, price, prev_close, currency, as_of').in('asset_id', assetRows.map(asset => asset.id))
  if (prices.error) throw new Error(prices.error.message)
  const priceMap = new Map<string, PriceRow>()
  for (const row of prices.data ?? []) {
    if (row.currency === 'USD' && usdKrw === null) continue
    priceMap.set(row.asset_id, { asset_id: row.asset_id, price: Number(row.price), prev_close: row.prev_close, currency: row.currency })
    priceAsOf.set(row.asset_id, row.as_of)
  }
  const investmentAccounts = ((accounts.data ?? []) as Account[]).filter(account => INVESTMENT_ACCOUNT_TYPES.includes(account.type) && account.is_active)
  return { holdings: buildHoldings(trades.data ?? [], assetRows, investmentAccounts, priceMap, usdKrw ?? 1), usdKrw, priceAsOf }
}
