import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import TrendChart from '@/components/TrendChart'
import RebalancingAlert from '@/components/RebalancingAlert'
import { buildHoldings } from '@/lib/calc/holdings'
import { refreshPrices } from '@/lib/prices/refresh'
import { buildRealizedPnL } from '@/lib/calc/realized-pnl'
import { calcXirr, buildXirrCashflows } from '@/lib/calc/xirr'
import { buildCostTrend } from '@/lib/calc/cost-trend'
import { krw, pnlColor, TX_LABEL, TX_COLOR, ACCOUNT_TYPE_LABEL } from '@/lib/labels'
import PolarisCard from '@/components/PolarisCard'
import type { OwnerType } from '@/lib/types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>
}) {
  const { owner } = await searchParams
  const ownerFilter = (owner === 'me' || owner === 'spouse') ? owner as OwnerType : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let accountsQuery = supabase
    .from('accounts').select('*').eq('is_active', true).order('sort_order')
  if (ownerFilter) accountsQuery = accountsQuery.eq('owner', ownerFilter)
  const { data: accountsRaw } = await accountsQuery
  const accounts = accountsRaw ?? []
  const accountIds = accounts.map((a: any) => a.id)

  // 초기값
  let totalCostKrw = 0, totalMarketValueKrw = 0, totalPnl = 0
  let totalRealizedPnlKrw = 0, realizedCount = 0
  let xirr: number | null = null
  let recentTx: any[] = []
  let hasPrice = false
  let trendData: { month: string; value: number }[] = []
  let allocActual: { cls: string; pct: number }[] = []

  // 북극성 카드용 저축 데이터 (monthly_budgets 최근 4개월)
  let cashBalance = 0
  let monthlySavings = 0
  let avgSavings3m = 0
  let savingsHistory: { month: string; amount: number }[] = []

  if (accountIds.length > 0) {
    // 계산용(buy/sell/deposit/withdraw): 가벼운 컬럼만
    // 표시용(최근 5건): 관계 조인 포함
    const [
      { data: assets },
      { data: calcTx },
      { data: recentTxRaw },
    ] = await Promise.all([
      supabase.from('assets').select('*'),
      supabase
        .from('transactions')
        .select('id, type, date, quantity, price, amount, asset_id, account_id, currency, fx_rate, fee, tax, created_at')
        .in('account_id', accountIds)
        .in('type', ['buy', 'sell', 'deposit', 'withdraw']),
      supabase
        .from('transactions')
        .select('id, type, date, amount, assets(name), accounts(name)')
        .in('account_id', accountIds)
        .order('date', { ascending: false })
        .limit(5),
    ])

    recentTx = recentTxRaw ?? []

    const { priceMap, usdKrw } = await refreshPrices(assets ?? [])
    const holdings = buildHoldings(calcTx ?? [], assets ?? [], accounts, priceMap, usdKrw)

    totalCostKrw        = holdings.reduce((s, h) => s + h.total_cost_krw, 0)
    totalMarketValueKrw = holdings.reduce((s, h) => s + (h.market_value_krw ?? h.total_cost_krw), 0)
    totalPnl            = holdings.reduce((s, h) => s + (h.unrealized_pnl_krw ?? 0), 0)
    hasPrice            = holdings.some(h => h.market_value_krw !== null)

    const pnlRows = buildRealizedPnL(calcTx ?? [], assets ?? [], usdKrw)
    totalRealizedPnlKrw = pnlRows.reduce((s, r) => s + r.pnl_krw, 0)
    realizedCount       = pnlRows.length

    const xirrCfs = buildXirrCashflows(calcTx ?? [], totalMarketValueKrw, usdKrw)
    xirr = calcXirr(xirrCfs)

    trendData = buildCostTrend(calcTx ?? [], usdKrw)

    // 저축 데이터 (monthly_budgets)
    const { data: budgets } = await supabase
      .from('monthly_budgets')
      .select('month, cash_balance, joint_savings, bonus_to_plan')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(7)

    if (budgets && budgets.length > 0) {
      cashBalance   = budgets[0].cash_balance   ?? 0
      monthlySavings = (budgets[0].joint_savings ?? 0) + (budgets[0].bonus_to_plan ?? 0)
      const prev3 = budgets.slice(1, 4)
      avgSavings3m = prev3.length > 0
        ? prev3.reduce((s, b) => s + (b.joint_savings ?? 0) + (b.bonus_to_plan ?? 0), 0) / prev3.length
        : 0
      savingsHistory = [...budgets].reverse().map(b => ({
        month: b.month,
        amount: (b.joint_savings ?? 0) + (b.bonus_to_plan ?? 0),
      }))
    }

    const allocMap = new Map<string, number>()
    for (const h of holdings) {
      const val = h.market_value_krw ?? h.total_cost_krw
      allocMap.set(h.asset_class, (allocMap.get(h.asset_class) ?? 0) + val)
    }
    const totalVal = Array.from(allocMap.values()).reduce((s, v) => s + v, 0)
    allocActual = Array.from(allocMap.entries()).map(([cls, val]) => ({
      cls, pct: totalVal > 0 ? (val / totalVal) * 100 : 0,
    }))
  }

  const totalPnlPct = totalCostKrw > 0 ? (totalPnl / totalCostKrw) * 100 : 0
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <AppShell>
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-[#34322b]">자산 현황</h1>
            <p className="text-xs text-[#9c9484] mt-0.5">{today}</p>
          </div>
          <Link
            href="/transactions/new"
            className="bg-[#1c6b4a] hover:bg-[#165638] text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
          >
            + 거래 입력
          </Link>
        </div>

        {/* 북극성 카드 */}
        <PolarisCard
          cashBalance={cashBalance}
          monthlySavings={monthlySavings}
          avgSavings3m={avgSavings3m}
        />

        <RebalancingAlert actual={allocActual} />

        {/* KPI 1행 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KpiCard label="총 평가금액">
            <p className="text-xl font-bold text-[#34322b] mt-1">
              {hasPrice ? krw(totalMarketValueKrw) : krw(totalCostKrw)}
            </p>
            {!hasPrice && <p className="text-[10px] text-[#b5aa98] mt-0.5">시세 미조회</p>}
          </KpiCard>
          <KpiCard label="총 투자원금">
            <p className="text-xl font-bold text-[#34322b] mt-1">{krw(totalCostKrw)}</p>
          </KpiCard>
          <KpiCard label="미실현 손익">
            <p className={`text-xl font-bold mt-1 ${hasPrice ? pnlColor(totalPnl) : 'text-[#9c9484]'}`}>
              {hasPrice ? (totalPnl >= 0 ? '+' : '') + krw(totalPnl) : '-'}
            </p>
          </KpiCard>
          <KpiCard label="미실현 수익률">
            <p className={`text-xl font-bold mt-1 ${hasPrice ? pnlColor(totalPnlPct) : 'text-[#9c9484]'}`}>
              {hasPrice ? (totalPnlPct >= 0 ? '+' : '') + totalPnlPct.toFixed(2) + '%' : '-'}
            </p>
          </KpiCard>
        </div>

        {/* KPI 2행 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <KpiCard label="실현 손익 (누적)">
            {realizedCount > 0 ? (
              <>
                <p className={`text-xl font-bold mt-1 ${pnlColor(totalRealizedPnlKrw)}`}>
                  {(totalRealizedPnlKrw >= 0 ? '+' : '') + krw(totalRealizedPnlKrw)}
                </p>
                <p className="text-[10px] text-[#b5aa98] mt-0.5">매도 {realizedCount}건</p>
              </>
            ) : (
              <p className="text-xl font-bold text-[#9c9484] mt-1">-</p>
            )}
          </KpiCard>
          <KpiCard label="XIRR (연간 수익률)">
            {xirr !== null ? (
              <>
                <p className={`text-xl font-bold mt-1 ${pnlColor(xirr)}`}>
                  {(xirr >= 0 ? '+' : '') + (xirr * 100).toFixed(2) + '%'}
                </p>
                <p className="text-[10px] text-[#b5aa98] mt-0.5">현금흐름 기반</p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-[#9c9484] mt-1">-</p>
                <p className="text-[10px] text-[#b5aa98] mt-0.5">거래 누적 후 산출</p>
              </>
            )}
          </KpiCard>
        </div>

        {/* 투자원금 추세 차트 */}
        {trendData.length >= 2 && (
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#34322b]">투자원금 추세</h2>
              <span className="text-xs text-[#9c9484]">{trendData[0].month.slice(0, 4)}년~ 누적</span>
            </div>
            <TrendChart data={trendData} />
            <div className="flex justify-between text-[10px] text-[#b5aa98] mt-1 px-1">
              <span>{krw(trendData[0].value)}</span>
              <span className="font-semibold text-[#1c6b4a]">{krw(trendData[trendData.length - 1].value)}</span>
            </div>
          </div>
        )}

        {/* 저축 바차트 */}
        {savingsHistory.length > 0 && (
          <SavingsChart data={savingsHistory} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 최근 거래 */}
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#34322b]">최근 거래</h2>
              <Link href="/transactions" className="text-xs text-[#1c6b4a] hover:underline">전체 →</Link>
            </div>
            {recentTx.length === 0 ? (
              <p className="text-xs text-[#9c9484] py-6 text-center">
                <Link href="/transactions/new" className="text-[#1c6b4a] underline">첫 거래를 입력하세요</Link>
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentTx.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TX_COLOR[tx.type] ?? 'bg-[#f0ead8] text-[#9c9484]'}`}>
                        {TX_LABEL[tx.type] ?? tx.type}
                      </span>
                      <span className="text-[#34322b] font-medium">{tx.assets?.name ?? '현금'}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[#9c9484]">{tx.date}</p>
                      <p className="text-[#b5aa98] text-[10px]">{tx.accounts?.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 계좌 */}
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#34322b]">계좌</h2>
              <Link href="/accounts" className="text-xs text-[#1c6b4a] hover:underline">관리 →</Link>
            </div>
            {accounts.length === 0 ? (
              <p className="text-xs text-[#9c9484] py-6 text-center">
                <Link href="/accounts" className="text-[#1c6b4a] underline">계좌를 먼저 추가하세요</Link>
              </p>
            ) : (
              <div className="space-y-2.5">
                {accounts.slice(0, 6).map((acc: any) => (
                  <Link
                    key={acc.id}
                    href={`/accounts/${acc.id}`}
                    className="flex items-center justify-between text-xs hover:opacity-75 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        acc.owner === 'spouse' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {acc.owner === 'spouse' ? '아내' : '나'}
                      </span>
                      <span className="text-[#34322b] font-medium">{acc.name}</span>
                    </div>
                    <span className="text-[#9c9484]">
                      {acc.broker ? `${acc.broker} · ` : ''}{ACCOUNT_TYPE_LABEL[acc.type] ?? acc.type}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function KpiCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
      <p className="text-xs text-[#9c9484]">{label}</p>
      {children}
    </div>
  )
}

function SavingsChart({ data }: { data: { month: string; amount: number }[] }) {
  const max = Math.max(...data.map(d => d.amount), 1)
  const thisMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#34322b]">월별 저축</h2>
        <span className="text-xs text-[#9c9484]">공금 + 성과급 합산</span>
      </div>
      <div className="flex items-end gap-1.5 h-20">
        {data.map(d => {
          const pct = Math.max((d.amount / max) * 100, d.amount > 0 ? 4 : 0)
          const isCurrent = d.month === thisMonth
          const [, m] = d.month.split('-')
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${pct}%`,
                  backgroundColor: isCurrent ? '#1c6b4a' : '#8bbda8',
                  minHeight: d.amount > 0 ? 4 : 0,
                }}
                title={`${d.month}: ${krw(d.amount)}`}
              />
              <span className={`text-[9px] ${isCurrent ? 'text-[#34322b] font-semibold' : 'text-[#b5aa98]'}`}>
                {parseInt(m)}월
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[#b5aa98] mt-1 px-0.5">
        <span>{data[0] ? krw(data[0].amount) : ''}</span>
        <span className="font-semibold text-[#1c6b4a]">
          {data[data.length - 1] ? krw(data[data.length - 1].amount) : ''}
        </span>
      </div>
    </div>
  )
}
