import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { fetchUsdKrw } from '@/lib/prices/fx'
import type { OwnerType } from '@/lib/types'

function fmtKrw(n: number) {
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n))
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return Math.round(n).toString()
}

export default async function DividendsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>
}) {
  const { owner } = await searchParams
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
          <h1 className="text-lg font-bold text-[#34322b]">배당 / 현금흐름</h1>
          <p className="text-sm text-[#9c9484] mt-4">등록된 계좌가 없습니다.</p>
        </div>
      </AppShell>
    )
  }

  const [{ data: txAll = [] }, usdKrw] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, assets(name, symbol, asset_class)')
      .in('account_id', accountIds)
      .eq('type', 'dividend')
      .order('date', { ascending: false }),
    fetchUsdKrw(),
  ])

  const dividends = (txAll ?? []) as any[]

  function toKrw(tx: any) {
    return (tx.amount ?? 0) * (tx.currency === 'USD' ? (usdKrw || 1) : 1)
  }

  const now = new Date()
  const thisYear = now.getFullYear().toString()
  const thisMonth = `${thisYear}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const totalKrw = dividends.reduce((s, tx) => s + toKrw(tx), 0)
  const yearKrw  = dividends.filter(tx => tx.date?.startsWith(thisYear)).reduce((s, tx) => s + toKrw(tx), 0)
  const monthKrw = dividends.filter(tx => tx.date?.startsWith(thisMonth)).reduce((s, tx) => s + toKrw(tx), 0)

  // 연-월별 그룹 (내림차순)
  const grouped = new Map<string, typeof dividends>()
  for (const tx of dividends) {
    const key = (tx.date as string).slice(0, 7)
    grouped.set(key, [...(grouped.get(key) ?? []), tx])
  }
  const monthGroups = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  // 종목별 배당 합산 (상위)
  const byAsset = new Map<string, { name: string; total: number }>()
  for (const tx of dividends) {
    const name = tx.assets?.name ?? '(자산 없음)'
    const cur = byAsset.get(name) ?? { name, total: 0 }
    byAsset.set(name, { name, total: cur.total + toKrw(tx) })
  }
  const topAssets = Array.from(byAsset.values()).sort((a, b) => b.total - a.total).slice(0, 8)

  // 올해 월별 배당 (바 차트용, 1~12월)
  const yearMonthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = `${thisYear}-${String(i + 1).padStart(2, '0')}`
    const val = dividends
      .filter(tx => tx.date?.startsWith(m))
      .reduce((s, tx) => s + toKrw(tx), 0)
    return { month: i + 1, value: val }
  })
  const maxMonthly = Math.max(...yearMonthlyData.map(d => d.value), 1)

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <h1 className="text-lg font-bold text-[#34322b] mb-5">배당 / 현금흐름</h1>

        {/* 요약 KPI */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: '누적 배당', value: totalKrw },
            { label: `${thisYear}년 배당`, value: yearKrw },
            { label: '이번 달', value: monthKrw },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
              <p className="text-xs text-[#9c9484]">{label}</p>
              <p className="text-xl font-bold text-[#1c6b4a] mt-1">
                {value > 0 ? fmtKrw(value) : '-'}
              </p>
            </div>
          ))}
        </div>

        {dividends.length === 0 ? (
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-10 text-center">
            <p className="text-sm text-[#9c9484]">배당 내역이 없습니다</p>
            <p className="text-xs text-[#b5aa98] mt-1">배당 수령 시 거래 유형을 "배당"으로 입력하세요</p>
          </div>
        ) : (
          <>
            {/* 올해 월별 바 차트 */}
            <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-[#34322b] mb-4">{thisYear}년 월별 배당</h2>
              <div className="flex items-end gap-1 h-24">
                {yearMonthlyData.map(({ month, value }) => {
                  const pct = (value / maxMonthly) * 100
                  const isThis = month === now.getMonth() + 1
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                        {value > 0 && (
                          <div
                            className="w-full rounded-t-sm"
                            style={{
                              height: `${Math.max(4, pct)}%`,
                              backgroundColor: isThis ? '#1c6b4a' : '#a8d4bc',
                            }}
                            title={fmtKrw(value)}
                          />
                        )}
                      </div>
                      <span className={`text-[9px] ${isThis ? 'font-bold text-[#1c6b4a]' : 'text-[#b5aa98]'}`}>
                        {month}
                      </span>
                    </div>
                  )
                })}
              </div>
              {yearKrw > 0 && (
                <p className="text-xs text-[#9c9484] mt-2 text-right">
                  연간 합계 <span className="font-semibold text-[#1c6b4a]">{fmtKrw(yearKrw)}</span>
                </p>
              )}
            </div>

            {/* 종목별 배당 상위 */}
            {topAssets.length > 0 && (
              <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4 mb-4">
                <h2 className="text-sm font-semibold text-[#34322b] mb-3">종목별 누적 배당</h2>
                <div className="space-y-2.5">
                  {topAssets.map(({ name, total }) => {
                    const pct = totalKrw > 0 ? (total / totalKrw) * 100 : 0
                    return (
                      <div key={name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#34322b] font-medium">{name}</span>
                          <div className="text-right">
                            <span className="text-[#1c6b4a] font-semibold">{fmtKrw(total)}</span>
                            <span className="text-[#b5aa98] ml-1.5">{pct.toFixed(1)}%</span>
                          </div>
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

            {/* 월별 상세 내역 */}
            <div className="space-y-4">
              {monthGroups.map(([month, txs]) => {
                const monthTotal = txs.reduce((s, tx) => s + toKrw(tx), 0)
                const [y, m] = month.split('-')
                return (
                  <div key={month} className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#e3d9c4] bg-[#f4eee0]">
                      <span className="text-sm font-semibold text-[#34322b]">{y}년 {parseInt(m)}월</span>
                      <span className="text-sm font-bold text-[#1c6b4a]">{fmtKrw(monthTotal)}</span>
                    </div>
                    {txs.map((tx: any) => {
                      const krwAmt = toKrw(tx)
                      return (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3 border-b border-[#f0ead8] last:border-0">
                          <div>
                            <p className="text-sm font-medium text-[#34322b]">
                              {tx.assets?.name ?? '(자산 없음)'}
                            </p>
                            <p className="text-[10px] text-[#9c9484] mt-0.5">
                              {tx.date}
                              {tx.memo && <span className="ml-2">· {tx.memo}</span>}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[#1c6b4a]">+{fmtKrw(krwAmt)}</p>
                            {tx.currency === 'USD' && (
                              <p className="text-[10px] text-[#9c9484]">${(tx.amount ?? 0).toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
