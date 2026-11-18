import Link from 'next/link'
import { Stat, StatStrip, toneOf } from '@/components/Stat'
import { latestSnapshotsAtMonth } from '@/lib/calc/account-snapshots'
import { buildHoldings, type PriceRow } from '@/lib/calc/holdings'
import { INVESTMENT_ACCOUNT_TYPES } from '@/lib/calc/home-insights'
import { buildRealizedPnL } from '@/lib/calc/realized-pnl'
import { formatMonth, krw, signedWonShort, wonShort } from '@/lib/labels'
import { dividendTotalKrw } from '@/lib/stock-prices'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { Account, AccountMonthlySnapshot, Asset, Holding } from '@/lib/types'
import PriceForm from './PriceForm'
import TradeActions from './TradeActions'
import AssetManager, { type ManagedAsset } from './AssetManager'
import TradeForm, { type TradeCostContext, type TradeInitial } from './TradeForm'
import { inferFeeRates } from '@/lib/calc/trade-costs'

export const metadata = { title: '주식 계좌' }

type Tab = 'holdings' | 'trades' | 'prices' | 'assets'

interface TradeRow {
  id: string
  date: string
  created_at: string | null
  account_id: string
  asset_id: string
  type: 'buy' | 'sell' | 'dividend'
  quantity: number | null
  price: number | null
  amount: number | null
  fee: number | null
  tax: number | null
  fx_rate: number | null
  currency: string
}

const TYPE_LABEL: Record<TradeRow['type'], string> = { buy: '매수', sell: '매도', dividend: '배당' }

export default async function StocksPage({ searchParams }: { searchParams: Promise<{ tab?: string; account?: string }> }) {
  const params = await searchParams
  const tab: Tab = params.tab === 'trades' || params.tab === 'prices' || params.tab === 'assets' ? params.tab : 'holdings'
  const { supabase, userId } = await getHouseholdContext()
  const now = new Date()
  const currentMonth = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul' }).format(now)
  const year = currentMonth.slice(0, 4)

  const [{ data: accountRows }, { data: assetRows }, { data: tradeRows }, { data: fxRow }, { data: snapshotRows }] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('sort_order').throwOnError(),
    supabase.from('assets').select('*').eq('user_id', userId).order('name').throwOnError(),
    supabase.from('transactions').select('id, date, created_at, account_id, asset_id, type, quantity, price, amount, fee, tax, fx_rate, currency')
      .eq('user_id', userId).in('type', ['buy', 'sell', 'dividend']).order('date', { ascending: false }).throwOnError(),
    supabase.from('fx_rates').select('rate, as_of').eq('pair', 'USDKRW').maybeSingle().throwOnError(),
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).lte('month', currentMonth).order('month').throwOnError(),
  ])

  const allAccounts = (accountRows ?? []) as Account[]
  const accounts = allAccounts.filter(account => INVESTMENT_ACCOUNT_TYPES.includes(account.type) && account.is_active)
  const assets = (assetRows ?? []) as Asset[]
  const trades = ((tradeRows ?? []) as TradeRow[]).filter(row => row.asset_id)
  const selectedAccount = accounts.find(account => account.id === params.account) ?? null
  const scopedTrades = selectedAccount ? trades.filter(trade => trade.account_id === selectedAccount.id) : trades

  const { data: priceRows } = assets.length > 0
    ? await supabase.from('prices').select('asset_id, price, prev_close, currency, as_of').in('asset_id', assets.map(asset => asset.id)).throwOnError()
    : { data: [] }
  const usdKrw = fxRow ? Number(fxRow.rate) : null
  const priceMap = new Map<string, PriceRow & { as_of: string | null }>()
  for (const row of priceRows ?? []) {
    // 환율이 없으면 달러 종목 평가금액을 0원으로 잘못 계산하지 않도록 현재가가 없는 것으로 본다.
    if (row.currency === 'USD' && usdKrw === null) continue
    priceMap.set(row.asset_id, { asset_id: row.asset_id, price: Number(row.price), prev_close: row.prev_close, currency: row.currency, as_of: row.as_of })
  }

  const holdings = buildHoldings(scopedTrades, assets, accounts, priceMap, usdKrw ?? 1)
  const realizedThisYear = buildRealizedPnL(scopedTrades, assets, usdKrw ?? 1).filter(row => row.date.startsWith(`${year}-`))
  const realizedTotal = realizedThisYear.reduce((sum, row) => sum + row.pnl_krw, 0)
  const dividendsThisYear = dividendTotalKrw(scopedTrades, year)
  const pricedHoldings = holdings.filter(holding => holding.market_value_krw !== null)
  const marketValue = pricedHoldings.reduce((sum, holding) => sum + holding.market_value_krw!, 0)
  const pricedCost = pricedHoldings.reduce((sum, holding) => sum + holding.total_cost_krw, 0)
  const totalCost = holdings.reduce((sum, holding) => sum + holding.total_cost_krw, 0)
  const unrealized = marketValue - pricedCost
  const unrealizedRate = pricedCost > 0 ? unrealized / pricedCost * 100 : null
  const missingPrices = holdings.length - pricedHoldings.length

  // 현재가 입력 목록: 모든 계좌에서 보유 중인 종목을 종목별로 한 줄씩.
  const heldByAsset = new Map<string, { holding: Holding; quantity: number }>()
  for (const holding of buildHoldings(trades, assets, accounts, priceMap, usdKrw ?? 1)) {
    const entry = heldByAsset.get(holding.asset_id)
    if (entry) entry.quantity += holding.quantity
    else heldByAsset.set(holding.asset_id, { holding, quantity: holding.quantity })
  }
  const priceInputRows = [...heldByAsset.values()].map(({ holding, quantity }) => {
    const stored = (priceRows ?? []).find(row => row.asset_id === holding.asset_id)
    return { asset_id: holding.asset_id, name: holding.name, symbol: holding.symbol, currency: holding.currency, quantity, price: stored ? Number(stored.price) : null, as_of: stored?.as_of ?? null }
  })

  const assetMap = new Map(assets.map(asset => [asset.id, asset]))
  const accountMap = new Map(accounts.map(account => [account.id, account]))
  const latestEvaluations = latestSnapshotsAtMonth((snapshotRows ?? []) as AccountMonthlySnapshot[], currentMonth)
  const tradeAccounts = accounts.map(account => ({ id: account.id, name: account.name, owner: account.owner, type: account.type }))
  const tradeCountByAsset = new Map<string, number>()
  for (const trade of trades) tradeCountByAsset.set(trade.asset_id, (tradeCountByAsset.get(trade.asset_id) ?? 0) + 1)
  const managedAssets: ManagedAsset[] = assets.map(asset => ({
    id: asset.id, name: asset.name, symbol: asset.symbol, asset_class: asset.asset_class, currency: asset.currency,
    trades: tradeCountByAsset.get(asset.id) ?? 0, held: heldByAsset.get(asset.id)?.quantity ?? 0,
  }))
  const tradeCosts: TradeCostContext = { feeRates: inferFeeRates(trades), usdKrw }
  const tradeAssets = assets.map(asset => ({ id: asset.id, name: asset.name, symbol: asset.symbol, currency: asset.currency, asset_class: asset.asset_class }))
  const href = (next: Partial<{ tab: Tab; account: string | null }>) => {
    const query = new URLSearchParams()
    const nextTab = next.tab ?? tab
    const nextAccount = next.account === undefined ? selectedAccount?.id ?? null : next.account
    if (nextTab !== 'holdings') query.set('tab', nextTab)
    if (nextAccount) query.set('account', nextAccount)
    const text = query.toString()
    return text ? `/stocks?${text}` : '/stocks'
  }

  return (
    <div className="page-container max-w-[1240px]">
      <header className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="page-eyebrow">Stock accounts</p>
          <h1 className="page-title">주식 계좌</h1>
          <p className="page-subtitle">매수·매도·배당 기록으로 종목별 보유 수량과 평균 단가, 평가손익을 계산합니다.</p>
        </div>
        <Link href={href({ tab: 'trades' })} className="inline-flex min-h-10 w-fit items-center rounded-lg bg-[var(--color-primary)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-strong)]">거래 추가</Link>
      </header>

      {accounts.length === 0 ? (
        <div className="app-card p-10 text-center">
          <p className="text-[14px] text-[var(--color-muted)]">주식·ISA·연금 계좌가 없어요.</p>
          <Link href="/net-worth?tab=items" className="mt-3 inline-flex min-h-8 items-center text-[13px] font-semibold text-[var(--color-primary)] hover:underline">밸런스 시트에서 계좌 추가하기 →</Link>
        </div>
      ) : (
        <>
          <nav aria-label="주식 계좌 메뉴" className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl bg-white p-1 shadow-[var(--shadow-card)]">
              {([['holdings', '보유 현황'], ['trades', '거래 기록'], ['prices', '현재가 입력'], ['assets', '종목 관리']] as const).map(([value, label]) => (
                <Link key={value} href={href({ tab: value })} aria-current={tab === value ? 'page' : undefined} className={`inline-flex min-h-9 items-center rounded-lg px-4 text-[13px] font-semibold ${tab === value ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>
                  {label}
                </Link>
              ))}
            </div>
            {tab !== 'prices' && tab !== 'assets' ? (
              <div className="flex flex-wrap gap-1.5" aria-label="계좌 선택">
                <Link href={href({ account: null })} className={chipClass(!selectedAccount)}>전체</Link>
                {accounts.map(account => (
                  <Link key={account.id} href={href({ account: account.id })} className={chipClass(selectedAccount?.id === account.id)}>{account.name}</Link>
                ))}
              </div>
            ) : null}
          </nav>

          {tab === 'holdings' ? (
            <div className="space-y-4">
              <StatStrip columns={4} label="주식 요약">
                <Stat label="평가금액" value={wonShort(marketValue)} exact={krw(marketValue)} tone="asset" detail={missingPrices > 0 ? `현재가 미입력 ${missingPrices}종목 제외` : `${holdings.length}종목`} />
                <Stat label="투자원금" value={wonShort(totalCost)} exact={krw(totalCost)} detail="평균 단가 × 보유 수량" />
                <Stat label="평가손익" value={pricedCost > 0 ? signedWonShort(unrealized) : '—'} exact={krw(unrealized)} tone={toneOf(unrealized)} detail={unrealizedRate === null ? '현재가 입력 필요' : `수익률 ${unrealizedRate > 0 ? '+' : ''}${unrealizedRate.toFixed(1)}%`} />
                <Stat label={`${year}년 실현손익·배당`} value={signedWonShort(realizedTotal + dividendsThisYear)} exact={krw(realizedTotal + dividendsThisYear)} tone={toneOf(realizedTotal + dividendsThisYear)} detail={`매도 ${signedWonShort(realizedTotal)} · 배당 ${wonShort(dividendsThisYear)}`} />
              </StatStrip>

              {missingPrices > 0 || (usdKrw === null && holdings.some(holding => holding.currency === 'USD')) ? (
                <p className="rounded-xl bg-[var(--color-accent-soft)] px-4 py-3 text-[13px] text-[var(--color-accent)]">
                  현재가{usdKrw === null && holdings.some(holding => holding.currency === 'USD') ? '나 원/달러 환율' : ''}이 입력되지 않은 종목이 있어요. <Link href={href({ tab: 'prices' })} className="font-semibold underline">현재가 입력</Link>에서 채우면 평가금액에 들어가요.
                </p>
              ) : null}

              <section className="app-card overflow-hidden" aria-label="종목별 보유 현황">
                <div className="border-b border-[var(--color-border)] px-5 py-4">
                  <h2 className="text-[15px] font-bold">종목별 보유 현황</h2>
                  <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">평균 단가는 수수료·세금을 포함한 이동평균이에요. 달러 종목의 원가는 매수 당시 환율로 계산해요.</p>
                </div>
                {holdings.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">보유 중인 종목이 없어요. <Link href={href({ tab: 'trades' })} className="font-semibold text-[var(--color-primary)]">거래 기록</Link>에서 매수를 추가해 보세요.</p>
                ) : (
                  <HoldingsTable holdings={holdings} total={marketValue} />
                )}
              </section>

              {!selectedAccount ? (
                <section className="app-card p-5" aria-label="계좌별 합계">
                  <h2 className="text-[15px] font-bold">계좌별 합계</h2>
                  <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">보유 종목 평가금액과 월간 기록에 적은 계좌 평가금액을 비교해요. 차이는 예수금(현금)이나 현재가 차이일 수 있어요.</p>
                  <ul className="mt-3 divide-y divide-[var(--color-border)]">
                    {accounts.map(account => {
                      const rows = holdings.filter(holding => holding.account_id === account.id)
                      if (rows.length === 0) return null
                      const value = rows.reduce((sum, holding) => sum + (holding.market_value_krw ?? 0), 0)
                      const missing = rows.filter(holding => holding.market_value_krw === null).length
                      const recorded = latestEvaluations.get(account.id)
                      return (
                        <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]">
                          <Link href={href({ account: account.id })} className="inline-flex min-h-8 items-center font-semibold hover:text-[var(--color-primary)]">{account.name} · {rows.length}종목</Link>
                          <span className="tabular-nums">
                            <strong>{missing === rows.length ? '현재가 필요' : wonShort(value)}</strong>
                            {missing > 0 && missing < rows.length ? <span className="ml-1 text-[12px] text-[var(--color-accent)]">(미입력 {missing})</span> : null}
                            {recorded ? <span className="ml-2 text-[var(--color-muted)]">{formatMonth(recorded.month)} 기록 {wonShort(Number(recorded.evaluation_amount))}</span> : null}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === 'trades' ? (
            <div className="space-y-4">
              <section className="app-card p-5" aria-label="거래 추가">
                <h2 className="mb-3 text-[15px] font-bold">거래 추가</h2>
                <TradeForm key={selectedAccount?.id ?? 'all'} accounts={selectedAccount ? tradeAccounts.filter(account => account.id === selectedAccount.id) : tradeAccounts} assets={tradeAssets} costs={tradeCosts} />
              </section>
              <section className="app-card overflow-hidden" aria-label="거래 기록">
                <div className="border-b border-[var(--color-border)] px-5 py-4">
                  <h2 className="text-[15px] font-bold">거래 기록 <span className="ml-1 text-[13px] font-semibold text-[var(--color-muted)]">{scopedTrades.length}건</span></h2>
                </div>
                {scopedTrades.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">아직 거래 기록이 없어요.</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {scopedTrades.slice(0, 200).map(trade => {
                      const asset = assetMap.get(trade.asset_id)
                      const isUsd = trade.currency === 'USD'
                      const money = (value: number) => isUsd ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : krw(value)
                      const initial: TradeInitial = {
                        id: trade.id, date: trade.date, account_id: trade.account_id, asset_id: trade.asset_id, type: trade.type,
                        quantity: trade.quantity, price: trade.price, amount: trade.amount, fee: Number(trade.fee ?? 0), tax: Number(trade.tax ?? 0), fx_rate: trade.fx_rate,
                      }
                      return (
                        <li key={trade.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-2 text-[14px]">
                              <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${trade.type === 'buy' ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : trade.type === 'sell' ? 'bg-[var(--color-negative-soft)] text-[var(--color-negative)]' : 'bg-[var(--color-positive-soft)] text-[var(--color-positive)]'}`}>{TYPE_LABEL[trade.type]}</span>
                              <span className="font-semibold">{asset?.name ?? '알 수 없는 종목'}</span>
                              <span className="text-[12.5px] text-[var(--color-muted)]">{trade.date} · {accountMap.get(trade.account_id)?.name ?? '계좌'}</span>
                            </p>
                            <p className="mt-0.5 text-[12.5px] tabular-nums text-[var(--color-muted)]">
                              {trade.type === 'dividend'
                                ? `받은 금액 ${money(Number(trade.amount ?? 0))}`
                                : `${Number(trade.quantity ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주 × ${money(Number(trade.price ?? 0))} = ${money(Number(trade.amount ?? 0))}`}
                              {Number(trade.fee ?? 0) + Number(trade.tax ?? 0) > 0 ? ` · 수수료·세금 ${money(Number(trade.fee ?? 0) + Number(trade.tax ?? 0))}` : ''}
                              {isUsd && trade.fx_rate ? ` · 환율 ${Number(trade.fx_rate).toLocaleString('ko-KR')}원` : ''}
                            </p>
                          </div>
                          <TradeActions trade={initial} accounts={tradeAccounts} assets={tradeAssets} costs={tradeCosts} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {tab === 'prices' ? (
            <section className="app-card p-5" aria-label="현재가 입력">
              <h2 className="text-[15px] font-bold">현재가 입력</h2>
              <p className="mb-4 mt-1 text-[12.5px] text-[var(--color-muted)]">증권 앱에서 본 현재가를 적어 주세요. 월말에 한 번 갱신하면 월간 기록과 같은 기준으로 비교할 수 있어요.</p>
              <PriceForm
                usdKrw={usdKrw}
                usdAsOf={fxRow?.as_of ?? null}
                rows={priceInputRows}
              />
            </section>
          ) : null}
          {tab === 'assets' ? (
            <section className="app-card overflow-hidden" aria-label="종목 관리">
              <div className="border-b border-[var(--color-border)] px-5 py-4">
                <h2 className="text-[15px] font-bold">종목 관리 <span className="ml-1 text-[13px] font-semibold text-[var(--color-muted)]">{managedAssets.length}개</span></h2>
                <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">종목 이름·코드·구분을 고치고, 거래가 없는 종목은 지울 수 있어요. 거래를 다른 종목으로 옮기려면 거래 기록에서 그 거래를 수정하세요.</p>
              </div>
              <AssetManager assets={managedAssets} />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function chipClass(active: boolean) {
  return `inline-flex min-h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-white text-[var(--color-muted)]'}`
}

function HoldingsTable({ holdings, total }: { holdings: Holding[]; total: number }) {
  const money = (holding: Holding, value: number | null) => value === null ? '—' : holding.currency === 'USD'
    ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : krw(value)
  return (
    <>
      <ul className="divide-y divide-[var(--color-border)] md:hidden">
        {holdings.map(holding => (
          <li key={`${holding.account_id}-${holding.asset_id}`} className="px-5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[14px] font-bold">{holding.name}</p>
              <p className="shrink-0 text-[14px] font-bold tabular-nums">{holding.market_value_krw === null ? '현재가 필요' : wonShort(holding.market_value_krw)}</p>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 text-[12.5px] tabular-nums text-[var(--color-muted)]">
              <span className="truncate">{holding.account_name} · {holding.quantity.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주 · 평단 {money(holding, holding.avg_cost)}</span>
              <PnL holding={holding} />
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[12.5px] text-[var(--color-muted)]">
              <th className="px-5 py-2.5 text-left font-semibold">종목</th>
              <th className="px-3 py-2.5 text-right font-semibold">수량</th>
              <th className="px-3 py-2.5 text-right font-semibold">평균 단가</th>
              <th className="px-3 py-2.5 text-right font-semibold">현재가</th>
              <th className="px-3 py-2.5 text-right font-semibold">평가금액</th>
              <th className="px-3 py-2.5 text-right font-semibold">평가손익</th>
              <th className="px-5 py-2.5 text-left font-semibold">비중</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(holding => {
              const weight = total > 0 && holding.market_value_krw !== null ? holding.market_value_krw / total * 100 : 0
              return (
                <tr key={`${holding.account_id}-${holding.asset_id}`} className="border-b border-[var(--color-section)] last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{holding.name}{holding.symbol ? <span className="ml-1.5 text-[12px] font-normal text-[var(--color-subtle)]">{holding.symbol}</span> : null}</p>
                    <p className="text-[12px] text-[var(--color-muted)]">{holding.account_name}</p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{holding.quantity.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(holding, holding.avg_cost)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(holding, holding.current_price)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums" title={holding.market_value_krw === null ? undefined : krw(holding.market_value_krw)}>{holding.market_value_krw === null ? '—' : wonShort(holding.market_value_krw)}</td>
                  <td className="px-3 py-3 text-right"><PnL holding={holding} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-section)]"><span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${weight}%` }} /></span>
                      <span className="w-10 text-right text-[12px] tabular-nums text-[var(--color-muted)]">{weight.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PnL({ holding }: { holding: Holding }) {
  if (holding.unrealized_pnl_krw === null) return <span className="text-[var(--color-subtle)]">—</span>
  const tone = holding.unrealized_pnl_krw > 0 ? 'text-[var(--color-positive)]' : holding.unrealized_pnl_krw < 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-muted)]'
  return (
    <span className={`shrink-0 font-semibold tabular-nums ${tone}`} title={krw(holding.unrealized_pnl_krw)}>
      {signedWonShort(holding.unrealized_pnl_krw)}
      {holding.unrealized_pnl_pct !== null ? <span className="ml-1 text-[12px] font-medium">({holding.unrealized_pnl_pct > 0 ? '+' : ''}{holding.unrealized_pnl_pct.toFixed(1)}%)</span> : null}
    </span>
  )
}
