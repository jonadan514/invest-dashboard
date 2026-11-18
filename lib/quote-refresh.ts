import { fetchQuote, fetchUsdKrw, yahooSymbols, type FetchLike, type QuoteAsset } from './quotes.ts'

// supabase-js 클라이언트 중 여기서 쓰는 부분만.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { from: (table: string) => any }

export interface QuoteRefreshResult {
  updated: number
  failed: string[]
  skipped: number
  usdKrw: number | null
}

/** 종목 코드가 있는 주식 종목의 현재가와 원/달러 환율을 가져와 저장한다. */
export async function refreshQuotes(supabase: Client, userId: string, fetcher: FetchLike = fetch): Promise<QuoteRefreshResult> {
  const { data, error } = await supabase.from('assets').select('id, name, symbol, asset_class, currency, is_active').eq('user_id', userId)
  if (error) throw new Error(error.message)
  const assets = ((data ?? []) as (QuoteAsset & { is_active: boolean })[]).filter(asset => asset.is_active !== false)
  const targets = assets.filter(asset => yahooSymbols(asset).length > 0)

  const failed: string[] = []
  const rows: { asset_id: string; price: number; prev_close: number | null; currency: string; as_of: string }[] = []
  for (const asset of targets) {
    const quote = await fetchQuote(fetcher, asset)
    if (quote) rows.push({ asset_id: asset.id, price: quote.price, prev_close: quote.prevClose, currency: quote.currency, as_of: quote.asOf })
    else failed.push(asset.name)
  }
  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from('prices').upsert(rows, { onConflict: 'asset_id' })
    if (upsertError) throw new Error(upsertError.message)
  }

  let usdKrw: number | null = null
  if (assets.some(asset => asset.currency === 'USD')) {
    const fx = await fetchUsdKrw(fetcher)
    if (fx) {
      usdKrw = fx.price
      const { error: fxError } = await supabase.from('fx_rates').upsert({ pair: 'USDKRW', rate: fx.price, prev_close: fx.prevClose, as_of: fx.asOf }, { onConflict: 'pair' })
      if (fxError) throw new Error(fxError.message)
    } else {
      failed.push('원/달러 환율')
    }
  }
  return { updated: rows.length, failed, skipped: assets.length - targets.length, usdKrw }
}
