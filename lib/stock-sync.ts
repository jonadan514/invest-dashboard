// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { from: (table: string) => any }

/**
 * 이번 달 월간 기록이 이미 있는 계좌의 평가액을 보유종목 평가액으로 맞춘다.
 * 기록이 없는 계좌, 현재가가 빠진 종목이 있는 계좌, 값이 같은 계좌는 건드리지 않는다.
 * 평가액 외 항목(납입액·메모)은 그대로 둔다.
 */
export async function syncStockEvaluations(
  supabase: Client,
  userId: string,
  month: string,
  values: Record<string, { value: number; holdings: number; missing: number }>,
) {
  const { data, error } = await supabase.from('account_monthly_snapshots').select('id, account_id, evaluation_amount')
    .eq('user_id', userId).eq('month', month)
  if (error) throw new Error(error.message)
  const updated: string[] = []
  for (const row of (data ?? []) as { id: string; account_id: string; evaluation_amount: number }[]) {
    const stock = values[row.account_id]
    if (!stock || stock.missing > 0 || stock.holdings === 0 || stock.value <= 0) continue
    if (Math.round(Number(row.evaluation_amount)) === stock.value) continue
    const { error: updateError } = await supabase.from('account_monthly_snapshots')
      .update({ evaluation_amount: stock.value, updated_at: new Date().toISOString() }).eq('id', row.id).eq('user_id', userId)
    if (updateError) throw new Error(updateError.message)
    updated.push(row.account_id)
  }
  return updated
}

import { buildHoldings, type PriceRow } from './calc/holdings.ts'
import { stockValueByAccount } from './calc/stock-valuation.ts'
import type { Account, Asset } from './types.ts'

/** 현재가 갱신 직후 호출: 보유종목 평가액을 이번 달(한국 시간) 월간 기록에 반영한다. */
export async function syncCurrentMonthStockValues(supabase: Client, userId: string, now = new Date()) {
  const month = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul' }).format(now)
  const [accounts, assets, trades, fx] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('assets').select('*').eq('user_id', userId),
    supabase.from('transactions').select('date, created_at, account_id, asset_id, type, quantity, price, amount, fee, tax, fx_rate').eq('user_id', userId).in('type', ['buy', 'sell']),
    supabase.from('fx_rates').select('rate').eq('pair', 'USDKRW').maybeSingle(),
  ])
  for (const result of [accounts, assets, trades, fx]) if (result.error) throw new Error(result.error.message)
  const assetRows = (assets.data ?? []) as Asset[]
  if (assetRows.length === 0 || (trades.data ?? []).length === 0) return []
  const prices = await supabase.from('prices').select('asset_id, price, prev_close, currency').in('asset_id', assetRows.map(asset => asset.id))
  if (prices.error) throw new Error(prices.error.message)
  const usdKrw = fx.data ? Number(fx.data.rate) : null
  const priceMap = new Map<string, PriceRow>()
  for (const row of prices.data ?? []) {
    if (row.currency === 'USD' && usdKrw === null) continue
    priceMap.set(row.asset_id, { asset_id: row.asset_id, price: Number(row.price), prev_close: row.prev_close, currency: row.currency })
  }
  const holdings = buildHoldings(trades.data ?? [], assetRows, (accounts.data ?? []) as Account[], priceMap, usdKrw ?? 1)
  return syncStockEvaluations(supabase, userId, month, stockValueByAccount(holdings))
}
