import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Stat, StatStrip, toneOf } from '@/components/Stat'
import { buildHoldings, type PriceRow } from '@/lib/calc/holdings'
import { INVESTMENT_ACCOUNT_TYPES } from '@/lib/calc/home-insights'
import { buildRealizedPnL } from '@/lib/calc/realized-pnl'
import { tradeLedger } from '@/lib/calc/stock-detail'
import { krw, signedWonShort, wonShort } from '@/lib/labels'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { Account, Asset } from '@/lib/types'
import { classLabel } from '../asset-classes'

export const metadata = { title: '종목 상세' }

interface TradeRow {
  id: string; date: string; created_at: string | null; account_id: string; asset_id: string
  type: 'buy' | 'sell' | 'dividend'; quantity: number | null; price: number | null; amount: number | null
  fee: number | null; tax: number | null; fx_rate: number | null; currency: string
}
const TYPE_LABEL = { buy: '매수', sell: '매도', dividend: '배당' } as const
const toneClass = (value: number) => value > 0 ? 'text-[var(--color-positive)]' : value < 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-muted)]'

export default async function StockDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params
  const { supabase, userId } = await getHouseholdContext()
  const [{ data: assetRow }, { data: accountRows }, { data: tradeRows }, { data: priceRow }, { data: fxRow }] = await Promise.all([
    supabase.from('assets').select('*').eq('user_id', userId).eq('id', assetId).maybeSingle().throwOnError(),
    supabase.from('accounts').select('*').eq('user_id', userId).throwOnError(),
    supabase.from('transactions').select('id, date, created_at, account_id, asset_id, type, quantity, price, amount, fee, tax, fx_rate, currency')
      .eq('user_id', userId).eq('asset_id', assetId).in('type', ['buy', 'sell', 'dividend']).throwOnError(),
    supabase.from('prices').select('asset_id, price, prev_close, currency, as_of').eq('asset_id', assetId).maybeSingle().throwOnError(),
    supabase.from('fx_rates').select('rate').eq('pair', 'USDKRW').maybeSingle().throwOnError(),
  ])
  if (!assetRow) notFound()
  const asset = assetRow as Asset
  const accounts = ((accountRows ?? []) as Account[]).filter(account => INVESTMENT_ACCOUNT_TYPES.includes(account.type))
  const accountName = new Map(((accountRows ?? []) as Account[]).map(account => [account.id, account.name]))
  const trades = (tradeRows ?? []) as TradeRow[]
  const usdKrw = fxRow ? Number(fxRow.rate) : null
  const isUsd = asset.currency === 'USD'
  const priceMap = new Map<string, PriceRow>()
  if (priceRow && !(isUsd && usdKrw === null)) {
    priceMap.set(asset.id, { asset_id: asset.id, price: Number(priceRow.price), prev_close: priceRow.prev_close, currency: priceRow.currency })
  }

  const holdings = buildHoldings(trades, [asset], accounts, priceMap, usdKrw ?? 1)
  const realized = buildRealizedPnL(trades, [asset], usdKrw ?? 1).sort((a, b) => b.date.localeCompare(a.date))
  const ledger = tradeLedger(trades)
  const quantity = holdings.reduce((sum, row) => sum + row.quantity, 0)
  const cost = holdings.reduce((sum, row) => sum + row.total_cost_krw, 0)
  const priced = holdings.every(row => row.market_value_krw !== null) && holdings.length > 0
  const value = holdings.reduce((sum, row) => sum + (row.market_value_krw ?? 0), 0)
  const unrealized = priced ? value - cost : null
  const unrealizedRate = unrealized !== null && cost > 0 ? unrealized / cost * 100 : null
  const realizedTotal = realized.reduce((sum, row) => sum + row.pnl_krw, 0)
  const dividendTotal = trades.filter(row => row.type === 'dividend')
    .reduce((sum, row) => sum + Number(row.amount ?? 0) * (row.currency === 'USD' ? Number(row.fx_rate ?? 0) : 1), 0)
  const totalReturn = (unrealized ?? 0) + realizedTotal + dividendTotal
  const money = (amount: number) => isUsd ? `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : krw(amount)

  return (
    <div className="page-container max-w-[1000px]">
      <Link href="/stocks" className="inline-flex min-h-8 items-center text-[13px] font-semibold text-[var(--color-primary)] hover:underline">← 주식 계좌</Link>
      <header className="mb-5 mt-1">
        <p className="page-eyebrow">{classLabel(asset.asset_class)}{asset.symbol ? ` · ${asset.symbol}` : ''}</p>
        <h1 className="page-title">{asset.name}</h1>
        <p className="page-subtitle">
          {priceRow ? `현재가 ${money(Number(priceRow.price))}` : '현재가 미입력'}
          {priceRow?.prev_close ? ` · 전일 대비 ${((Number(priceRow.price) / Number(priceRow.prev_close) - 1) * 100).toFixed(1)}%` : ''}
        </p>
      </header>

      <div className="space-y-4">
        <StatStrip columns={4} label="종목 손익 요약">
          <Stat label="보유 수량" value={`${quantity.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주`} detail={priced ? `평가 ${wonShort(value)}` : '현재가 필요'} />
          <Stat label="평가손익" value={unrealized === null ? '—' : signedWonShort(unrealized)} tone={toneOf(unrealized)} detail={unrealizedRate === null ? '보유 중인 수량 기준' : `수익률 ${unrealizedRate > 0 ? '+' : ''}${unrealizedRate.toFixed(1)}%`} />
          <Stat label="실현손익" value={signedWonShort(realizedTotal)} tone={toneOf(realizedTotal)} detail={`매도 ${realized.length}건`} />
          <Stat label="배당" value={wonShort(dividendTotal)} detail="받은 금액 합계" />
        </StatStrip>
        <p className="rounded-xl bg-[var(--color-primary-soft)] px-4 py-3 text-[13px]">
          평가손익 + 실현손익 + 배당을 합친 이 종목의 전체 손익은 <strong className={toneClass(totalReturn)}>{signedWonShort(totalReturn)}</strong>이에요.
        </p>

        {holdings.length > 0 ? (
          <section className="app-card overflow-hidden" aria-label="계좌별 보유">
            <div className="border-b border-[var(--color-border)] px-5 py-4"><h2 className="text-[15px] font-bold">계좌별 보유</h2></div>
            <ul className="divide-y divide-[var(--color-border)]">
              {holdings.map(row => (
                <li key={row.account_id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-5 py-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.account_name}</p>
                    <p className="text-[12.5px] tabular-nums text-[var(--color-muted)]">{row.quantity.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주 · 평단 {money(row.avg_cost)}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-semibold">{row.market_value_krw === null ? '—' : wonShort(row.market_value_krw)}</p>
                    <p className={`text-[12.5px] font-semibold ${toneClass(row.unrealized_pnl_krw ?? 0)}`}>
                      {row.unrealized_pnl_krw === null ? '—' : `${signedWonShort(row.unrealized_pnl_krw)}${row.unrealized_pnl_pct !== null ? ` (${row.unrealized_pnl_pct > 0 ? '+' : ''}${row.unrealized_pnl_pct.toFixed(1)}%)` : ''}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {realized.length > 0 ? (
          <section className="app-card overflow-hidden" aria-label="실현손익 내역">
            <div className="border-b border-[var(--color-border)] px-5 py-4"><h2 className="text-[15px] font-bold">실현손익 내역</h2></div>
            <ul className="divide-y divide-[var(--color-border)]">
              {realized.map(row => (
                <li key={row.tx_id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="font-semibold">{row.date} 매도 {row.quantity.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주</p>
                    <p className="text-[12.5px] tabular-nums text-[var(--color-muted)]">매도가 {money(row.sell_price)} · 평단 {money(row.avg_cost)}</p>
                  </div>
                  <p className={`shrink-0 text-right font-bold tabular-nums ${toneClass(row.pnl_krw)}`}>{signedWonShort(row.pnl_krw)}<span className="ml-1 text-[12px] font-medium">({row.pnl_pct > 0 ? '+' : ''}{row.pnl_pct.toFixed(1)}%)</span></p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="app-card overflow-hidden" aria-label="거래 내역">
          <div className="border-b border-[var(--color-border)] px-5 py-4">
            <h2 className="text-[15px] font-bold">거래 내역 <span className="ml-1 text-[13px] font-semibold text-[var(--color-muted)]">{ledger.length}건</span></h2>
            <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">수정·삭제는 주식 계좌의 거래 기록 탭에서 해요.</p>
          </div>
          {ledger.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">이 종목의 거래가 없어요.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {ledger.map(trade => {
                const charges = Number(trade.fee ?? 0) + Number(trade.tax ?? 0)
                return (
                  <li key={trade.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-5 py-3 text-[13px]">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2">
                        <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${trade.type === 'buy' ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : trade.type === 'sell' ? 'bg-[var(--color-negative-soft)] text-[var(--color-negative)]' : 'bg-[var(--color-positive-soft)] text-[var(--color-positive)]'}`}>{TYPE_LABEL[trade.type]}</span>
                        <span className="font-semibold">{trade.date}</span>
                        <span className="text-[12.5px] text-[var(--color-muted)]">{accountName.get(trade.account_id) ?? '계좌'}</span>
                      </p>
                      <p className="mt-0.5 text-[12.5px] tabular-nums text-[var(--color-muted)]">
                        {trade.type === 'dividend' ? `받은 금액 ${money(Number(trade.amount ?? 0))}` : `${Number(trade.quantity ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주 × ${money(Number(trade.price ?? 0))}`}
                        {charges > 0 ? ` · 수수료·세금 ${money(charges)}` : ''}
                        {isUsd && trade.fx_rate ? ` · 환율 ${Number(trade.fx_rate).toLocaleString('ko-KR')}원` : ''}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold">{money(Number(trade.amount ?? 0))}</p>
                      {trade.runningQuantity !== null ? <p className="text-[12px] text-[var(--color-muted)]">거래 후 {trade.runningQuantity.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주</p> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
