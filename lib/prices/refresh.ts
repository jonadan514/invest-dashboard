import { createClient } from '@/lib/supabase/server'
import { fetchUpbitPrices } from './upbit'
import { fetchFinnhubPrices } from './finnhub'
import { fetchYahooPrices } from './yahoo'
import { fetchUsdKrw } from './fx'
import type { Asset } from '@/lib/types'

export interface PriceRow {
  asset_id: string
  price: number
  prev_close: number | null
  currency: string
}

const STALE_MS = 10 * 60 * 1000 // 10분

export async function refreshPrices(assets: Asset[]): Promise<{
  priceMap: Map<string, PriceRow>
  usdKrw: number
}> {
  const supabase = await createClient()
  const finnhubKey = process.env.FINNHUB_API_KEY ?? ''
  const assetIds = assets.map(a => a.id)

  // 기존 DB 가격 먼저 로드 (stale check + fallback 용도 겸)
  const priceMap = new Map<string, PriceRow>()
  let latestAsOf = 0
  if (assetIds.length > 0) {
    const { data: dbPrices } = await supabase
      .from('prices')
      .select('*')
      .in('asset_id', assetIds)
    for (const p of dbPrices ?? []) {
      priceMap.set(p.asset_id, p)
      const t = p.as_of ? new Date(p.as_of).getTime() : 0
      if (t > latestAsOf) latestAsOf = t
    }
  }

  // 10분 이내 갱신됐으면 외부 API 호출 생략
  const isStale = Date.now() - latestAsOf > STALE_MS

  // USD/KRW 환율 (stale 여부 무관하게 항상 필요)
  let usdKrw = 0
  const usAssets = assets.filter(
    a => (a.asset_class === 'us_stock' || a.asset_class === 'etf_us') && a.symbol,
  )
  if (usAssets.length > 0) {
    if (isStale) {
      usdKrw = await fetchUsdKrw()
      if (usdKrw > 0) {
        await supabase.from('fx_rates').upsert({
          pair: 'USDKRW',
          rate: usdKrw,
          as_of: new Date().toISOString(),
        })
      }
    }
    if (usdKrw === 0) {
      const { data } = await supabase
        .from('fx_rates').select('rate').eq('pair', 'USDKRW').single()
      usdKrw = data?.rate ?? 1350
    }
  } else {
    // USD 자산 없으면 환율 DB에서만
    const { data } = await supabase
      .from('fx_rates').select('rate').eq('pair', 'USDKRW').single()
    usdKrw = data?.rate ?? 1350
  }

  if (!isStale) return { priceMap, usdKrw }

  // stale: 외부 API 호출
  const cryptoAssets = assets.filter(a => a.asset_class === 'crypto' && a.symbol)
  const krAssets = assets.filter(
    a => (a.asset_class === 'kr_stock' || a.asset_class === 'etf_kr') && a.symbol,
  )

  const priceUpdates: PriceRow[] = []

  if (cryptoAssets.length > 0) {
    const tickers = await fetchUpbitPrices(cryptoAssets.map(a => a.symbol!))
    for (const asset of cryptoAssets) {
      const t = tickers.get(asset.symbol!.toUpperCase())
      if (t) priceUpdates.push({ asset_id: asset.id, price: t.price, prev_close: t.prev_close, currency: 'KRW' })
    }
  }

  if (krAssets.length > 0) {
    const quotes = await fetchYahooPrices(krAssets.map(a => a.symbol!))
    for (const asset of krAssets) {
      const q = quotes.get(asset.symbol!)
      if (q) priceUpdates.push({ asset_id: asset.id, price: q.price, prev_close: q.prev_close, currency: 'KRW' })
    }
  }

  if (usAssets.length > 0 && finnhubKey) {
    const quotes = await fetchFinnhubPrices(usAssets.map(a => a.symbol!), finnhubKey)
    for (const asset of usAssets) {
      const q = quotes.get(asset.symbol!)
      if (q) priceUpdates.push({ asset_id: asset.id, price: q.price, prev_close: q.prev_close, currency: 'USD' })
    }
  }

  if (priceUpdates.length > 0) {
    await supabase.from('prices').upsert(
      priceUpdates.map(p => ({ ...p, as_of: new Date().toISOString() })),
    )
    for (const p of priceUpdates) priceMap.set(p.asset_id, p)
  }

  return { priceMap, usdKrw }
}
