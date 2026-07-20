import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { buildRealizedPnL } from '@/lib/calc/realized-pnl'
import MemoEditor from './MemoEditor'
import AssetFilter from './AssetFilter'
import type { OwnerType } from '@/lib/types'

const TYPE_META: Record<string, { label: string; bar: string; badge: string; text: string }> = {
  buy:      { label: '매수', bar: '#d31f47', badge: 'bg-red-50 text-[#d31f47]',   text: 'text-[#d31f47]' },
  sell:     { label: '매도', bar: '#1763c9', badge: 'bg-blue-50 text-[#1763c9]',  text: 'text-[#1763c9]' },
  dividend: { label: '배당', bar: '#1c6b4a', badge: 'bg-emerald-50 text-[#1c6b4a]', text: 'text-[#1c6b4a]' },
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function fmtKrw(n: number) {
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(Math.abs(n)))
}

function fmtQty(qty: number) {
  return Number.isInteger(qty) ? qty.toLocaleString() : qty.toFixed(6).replace(/\.?0+$/, '')
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; asset_id?: string }>
}) {
  const { owner, asset_id } = await searchParams
  const ownerFilter = (owner === 'me' || owner === 'spouse') ? owner as OwnerType : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let accountsQuery = supabase.from('accounts').select('id').eq('is_active', true)
  if (ownerFilter) accountsQuery = accountsQuery.eq('owner', ownerFilter)
  const { data: accounts = [] } = await accountsQuery
  const accountIds = (accounts ?? []).map((a: any) => a.id)

  if (accountIds.length === 0) {
    return (
      <AppShell>
        <div className="p-6">
          <h1 className="text-lg font-bold text-[#34322b]">매매 일지</h1>
          <p className="text-sm text-[#9c9484] mt-4">등록된 계좌가 없습니다.</p>
        </div>
      </AppShell>
    )
  }

  const [{ data: txAll = [] }, { data: assets = [] }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, accounts(name, owner), assets(name, symbol, asset_class)')
      .in('account_id', accountIds)
      .in('type', ['buy', 'sell', 'dividend'])
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('assets').select('*'),
  ])

  const trades = (txAll ?? []) as any[]
  const pnlRows = buildRealizedPnL(trades, assets ?? [])
  const pnlByTxId = new Map(pnlRows.map(r => [r.tx_id, r]))

  // 종목 필터 목록 (거래 건수 포함, 가나다 정렬)
  const assetCountMap = new Map<string, number>()
  for (const tx of trades) {
    if (tx.asset_id) assetCountMap.set(tx.asset_id, (assetCountMap.get(tx.asset_id) ?? 0) + 1)
  }
  const assetOptions = Array.from(
    new Map(
      trades.filter(t => t.assets).map((t: any) => [
        t.asset_id,
        { id: t.asset_id, name: t.assets.name, symbol: t.assets.symbol ?? null, count: assetCountMap.get(t.asset_id) ?? 0 },
      ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  // 종목 필터 적용
  const filtered = asset_id ? trades.filter((t: any) => t.asset_id === asset_id) : trades

  // 연-월별 그룹
  const grouped = new Map<string, typeof trades>()
  for (const tx of filtered) {
    const key = (tx.date as string).slice(0, 7)
    grouped.set(key, [...(grouped.get(key) ?? []), tx])
  }
  const monthGroups = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <AppShell>
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-[#34322b]">매매 일지</h1>
          <p className="text-xs text-[#9c9484]">
            {asset_id ? `${filtered.length}건` : `총 ${trades.length}건`}
          </p>
        </div>

        {/* 종목 필터 */}
        {assetOptions.length > 0 && (
          <div className="mb-5">
            <AssetFilter assets={assetOptions} />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-10 text-center">
            <p className="text-sm text-[#9c9484]">
              {asset_id ? '해당 종목의 거래 내역이 없습니다' : '거래 내역이 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {monthGroups.map(([month, txs]) => {
              const [y, m] = month.split('-')
              return (
                <div key={month}>
                  {/* 월 구분선 */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-bold text-[#34322b] whitespace-nowrap">
                      {y}년 {parseInt(m)}월
                    </span>
                    <div className="flex-1 h-px bg-[#e3d9c4]" />
                    <span className="text-[10px] text-[#b5aa98] whitespace-nowrap">{txs.length}건</span>
                  </div>

                  {/* 일지 카드 목록 */}
                  <div className="space-y-3">
                    {txs.map((tx: any) => {
                      const meta = TYPE_META[tx.type] ?? TYPE_META.buy
                      const pnl = tx.type === 'sell' ? pnlByTxId.get(tx.id) : null
                      const currency: string = tx.currency ?? 'KRW'
                      const qty = tx.quantity != null ? Number(tx.quantity) : null
                      const price = tx.price != null ? Number(tx.price) : null
                      const amount = tx.amount != null ? Number(tx.amount) : null

                      const priceDisplay = price != null
                        ? (currency === 'USD' ? `$${price.toLocaleString()}` : `₩${price.toLocaleString()}`)
                        : null
                      const amountDisplay = amount != null
                        ? (currency === 'USD' ? `$${amount.toLocaleString()}` : fmtKrw(amount))
                        : null

                      return (
                        <div
                          key={tx.id}
                          className="rounded-xl overflow-hidden border border-[#e3d9c4]"
                          style={{ borderLeftWidth: 4, borderLeftColor: meta.bar }}
                        >
                          {/* 카드 헤더: 날짜 + 유형 */}
                          <div className="flex items-center justify-between px-4 py-2.5 bg-[#f4eee0]">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-[#9c9484]">
                                {tx.accounts?.owner === 'spouse' ? '[아내] ' : '[나] '}{tx.accounts?.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#9c9484]">{fmtDate(tx.date)}</span>
                          </div>

                          {/* 카드 본문: 종목 + 거래 내역 */}
                          <div className="px-4 py-3 bg-[#faf6ec]">
                            <p className="text-base font-bold text-[#34322b] leading-tight">
                              {tx.assets?.name ?? '현금'}
                            </p>
                            {tx.assets?.symbol && (
                              <p className="text-[10px] text-[#b5aa98] mt-0.5 font-mono">{tx.assets.symbol}</p>
                            )}

                            {/* 거래 수치 */}
                            <div className="flex items-center gap-1.5 mt-2.5 text-sm flex-wrap">
                              {qty != null && (
                                <>
                                  <span className="font-semibold text-[#34322b]">{fmtQty(qty)}주</span>
                                  {priceDisplay && (
                                    <>
                                      <span className="text-[#c4b89e]">×</span>
                                      <span className="text-[#34322b]">{priceDisplay}</span>
                                    </>
                                  )}
                                  {amountDisplay && (
                                    <>
                                      <span className="text-[#c4b89e]">=</span>
                                      <span className={`font-bold ${meta.text}`}>{amountDisplay}</span>
                                    </>
                                  )}
                                </>
                              )}
                              {qty == null && amountDisplay && (
                                <span className={`font-bold ${meta.text}`}>{amountDisplay}</span>
                              )}
                            </div>

                            {/* 실현손익 (매도) */}
                            {pnl && (
                              <div className="mt-2.5 inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] text-[#9c9484]">실현손익</span>
                                <span className={`text-sm font-bold ${pnl.pnl_krw >= 0 ? 'text-[#d31f47]' : 'text-[#1763c9]'}`}>
                                  {pnl.pnl_krw >= 0 ? '+' : '-'}{fmtKrw(pnl.pnl_krw)}
                                </span>
                                <span className={`text-xs ${pnl.pnl_pct >= 0 ? 'text-[#d31f47]' : 'text-[#1763c9]'}`}>
                                  ({pnl.pnl_pct >= 0 ? '+' : ''}{pnl.pnl_pct.toFixed(1)}%)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 메모 영역 */}
                          <div className="px-4 py-3 bg-white border-t border-[#f0ead8]">
                            <MemoEditor txId={tx.id} initialMemo={tx.memo} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
