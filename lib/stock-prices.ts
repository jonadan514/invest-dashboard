/** 현재가·환율 입력 검증. 폼 이름: price_<종목 id>, usd_krw. 빈 칸은 바꾸지 않는다. */
export function buildPriceUpdates(form: FormData, assets: { id: string; currency: string }[], now = new Date()) {
  const prices: { asset_id: string; price: number; currency: string; as_of: string }[] = []
  for (const asset of assets) {
    const raw = form.get(`price_${asset.id}`)
    if (raw === null || (typeof raw === 'string' && !raw.trim())) continue
    const price = typeof raw === 'string' ? Number(raw.replace(/,/g, '')) : NaN
    if (!Number.isFinite(price) || price <= 0) throw new Error('현재가는 0보다 큰 숫자로 입력해 주세요.')
    prices.push({ asset_id: asset.id, price, currency: asset.currency, as_of: now.toISOString() })
  }
  const rawFx = form.get('usd_krw')
  let usdKrw: number | null = null
  if (typeof rawFx === 'string' && rawFx.trim()) {
    usdKrw = Number(rawFx.replace(/,/g, ''))
    if (!Number.isFinite(usdKrw) || usdKrw < 100 || usdKrw > 10_000) throw new Error('원/달러 환율을 확인해 주세요.')
  }
  return { prices, usdKrw }
}

export interface DividendRow { date: string; amount: number | null; currency: string; fx_rate: number | null; type: string }

/** 배당 합계(원화). USD는 거래 때 입력한 환율로 환산한다. */
export function dividendTotalKrw(rows: DividendRow[], year?: string) {
  return rows
    .filter(row => row.type === 'dividend' && (!year || row.date.startsWith(`${year}-`)))
    .reduce((sum, row) => sum + Number(row.amount ?? 0) * (row.currency === 'USD' ? Number(row.fx_rate ?? 0) : 1), 0)
}
