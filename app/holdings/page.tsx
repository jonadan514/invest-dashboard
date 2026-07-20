import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { buildHoldings } from '@/lib/calc/holdings'
import { refreshPrices } from '@/lib/prices/refresh'
import { CLASS_LABEL_ICON as CLASS_LABEL, pnlColor, krw as fmtKrw } from '@/lib/labels'
import type { OwnerType, AssetClass } from '@/lib/types'
import Link from 'next/link'

function fmtPct(n: number) {
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%'
}

export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>
}) {
  const { owner } = await searchParams
  const ownerFilter = (owner === 'me' || owner === 'spouse') ? owner as OwnerType : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let accountsQuery = supabase.from('accounts').select('*').eq('is_active', true)
  if (ownerFilter) accountsQuery = accountsQuery.eq('owner', ownerFilter)
  const { data: accounts = [] } = await accountsQuery

  const accountIds = (accounts ?? []).map((a: any) => a.id)

  let holdings: ReturnType<typeof buildHoldings> = []
  let totalCostKrw = 0
  let totalMarketValueKrw = 0
  let totalPnl = 0

  if (accountIds.length > 0) {
    const [{ data: transactions = [] }, { data: assets = [] }] = await Promise.all([
      supabase.from('transactions').select('*').in('account_id', accountIds),
      supabase.from('assets').select('*'),
    ])

    const { priceMap, usdKrw } = await refreshPrices(assets ?? [])
    holdings = buildHoldings(transactions ?? [], assets ?? [], accounts ?? [], priceMap, usdKrw)

    totalCostKrw = holdings.reduce((s, h) => s + h.total_cost_krw, 0)
    totalMarketValueKrw = holdings.reduce((s, h) => s + (h.market_value_krw ?? h.total_cost_krw), 0)
    totalPnl = holdings.reduce((s, h) => s + (h.unrealized_pnl_krw ?? 0), 0)
  }

  const totalPnlPct = totalCostKrw > 0 ? (totalPnl / totalCostKrw) * 100 : 0
  const hasPrice = holdings.some(h => h.market_value_krw !== null)
  const totalValKrw = hasPrice ? totalMarketValueKrw : totalCostKrw

  // 자산군별 그룹 + 배분 계산
  const groups = new Map<AssetClass, typeof holdings>()
  const allocMap = new Map<AssetClass, number>()
  for (const h of holdings) {
    const cls = h.asset_class as AssetClass
    groups.set(cls, [...(groups.get(cls) ?? []), h])
    const val = h.market_value_krw ?? h.total_cost_krw
    allocMap.set(cls, (allocMap.get(cls) ?? 0) + val)
  }
  const allocEntries = Array.from(allocMap.entries()).sort((a, b) => b[1] - a[1])

  return (
    <AppShell>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-[#34322b]">보유종목</h1>
          <Link
            href="/transactions/new"
            className="bg-[#1c6b4a] hover:bg-[#165638] text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
          >
            + 거래 입력
          </Link>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
            <p className="text-xs text-[#9c9484]">총 투자원금</p>
            <p className="text-xl font-bold text-[#34322b] mt-1">{fmtKrw(totalCostKrw)}</p>
          </div>
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
            <p className="text-xs text-[#9c9484]">총 평가금액</p>
            <p className={`text-xl font-bold mt-1 ${hasPrice ? 'text-[#34322b]' : 'text-[#9c9484]'}`}>
              {hasPrice ? fmtKrw(totalMarketValueKrw) : '-'}
            </p>
          </div>
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
            <p className="text-xs text-[#9c9484]">미실현 손익</p>
            <p className={`text-xl font-bold mt-1 ${pnlColor(hasPrice ? totalPnl : null)}`}>
              {hasPrice ? (totalPnl >= 0 ? '+' : '') + fmtKrw(totalPnl) : '-'}
            </p>
          </div>
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
            <p className="text-xs text-[#9c9484]">수익률</p>
            <p className={`text-xl font-bold mt-1 ${pnlColor(hasPrice ? totalPnlPct : null)}`}>
              {hasPrice ? fmtPct(totalPnlPct) : '-'}
            </p>
          </div>
        </div>

        {/* 자산 배분 */}
        {allocEntries.length > 0 && (
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4 mb-4">
            <h2 className="text-xs font-semibold text-[#9c9484] uppercase tracking-wide mb-3">자산 배분</h2>
            <div className="space-y-2.5">
              {allocEntries.map(([cls, val]) => {
                const pct = totalValKrw > 0 ? (val / totalValKrw) * 100 : 0
                return (
                  <div key={cls}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#34322b]">{CLASS_LABEL[cls]}</span>
                      <span className="text-[#9c9484]">
                        {pct.toFixed(1)}% <span className="text-[#b5aa98]">·</span> {fmtKrw(val)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#e3d9c4] rounded-full overflow-hidden">
                      <div className="h-full bg-[#1c6b4a] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {holdings.length === 0 ? (
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-10 text-center">
            <p className="text-sm text-[#9c9484]">보유종목이 없습니다</p>
            <Link
              href="/transactions/new"
              className="mt-3 inline-block bg-[#1c6b4a] text-white text-xs font-semibold rounded-lg px-4 py-2"
            >
              첫 거래 입력하기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(groups.entries()).map(([cls, items]) => (
              <div key={cls} className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e3d9c4] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#34322b]">{CLASS_LABEL[cls]}</h2>
                  <span className="text-xs text-[#9c9484]">{items.length}종목</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#f0ead8] text-[#9c9484]">
                      <th className="text-left px-4 py-2.5 font-medium">종목</th>
                      <th className="text-right px-4 py-2.5 font-medium">수량</th>
                      <th className="text-right px-4 py-2.5 font-medium">평균단가</th>
                      <th className="text-right px-4 py-2.5 font-medium">현재가</th>
                      <th className="text-right px-4 py-2.5 font-medium">평가금액</th>
                      <th className="text-right px-4 py-2.5 font-medium">손익(률)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(h => (
                      <tr
                        key={`${h.account_id}:${h.asset_id}`}
                        className="border-b border-[#f4eee0] last:border-0 hover:bg-[#f4eee0] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#34322b]">{h.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {h.symbol && <span className="text-[#9c9484] text-[10px]">{h.symbol}</span>}
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                              h.owner === 'spouse'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {h.owner === 'spouse' ? '아내' : '나'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[#34322b]">
                          {Number.isInteger(h.quantity)
                            ? h.quantity.toLocaleString()
                            : h.quantity.toFixed(6).replace(/\.?0+$/, '')}
                        </td>
                        <td className="px-4 py-3 text-right text-[#34322b]">
                          {h.currency === 'USD'
                            ? `$${h.avg_cost.toFixed(2)}`
                            : `₩${Math.round(h.avg_cost).toLocaleString()}`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {h.current_price !== null ? (
                            <div>
                              <p className="text-[#34322b] font-medium">
                                {h.currency === 'USD'
                                  ? `$${h.current_price.toFixed(2)}`
                                  : `₩${Math.round(h.current_price).toLocaleString()}`}
                              </p>
                              {h.prev_close && (
                                <p className={`text-[10px] ${pnlColor(h.current_price - h.prev_close)}`}>
                                  {h.current_price >= h.prev_close ? '+' : ''}
                                  {(((h.current_price - h.prev_close) / h.prev_close) * 100).toFixed(2)}%
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#b5aa98]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#34322b]">
                          {h.market_value_krw !== null
                            ? fmtKrw(h.market_value_krw)
                            : fmtKrw(h.total_cost_krw)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {h.unrealized_pnl_krw !== null ? (
                            <div>
                              <p className={`font-semibold ${pnlColor(h.unrealized_pnl_krw)}`}>
                                {h.unrealized_pnl_krw >= 0 ? '+' : ''}{fmtKrw(h.unrealized_pnl_krw)}
                              </p>
                              <p className={`text-[10px] ${pnlColor(h.unrealized_pnl_pct)}`}>
                                {fmtPct(h.unrealized_pnl_pct!)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[#b5aa98] text-[10px]">시세없음</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
