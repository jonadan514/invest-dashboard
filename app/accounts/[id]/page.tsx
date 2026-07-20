import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { buildHoldings } from '@/lib/calc/holdings'
import { refreshPrices } from '@/lib/prices/refresh'
import { buildRealizedPnL } from '@/lib/calc/realized-pnl'
import { calcXirr, buildXirrCashflows } from '@/lib/calc/xirr'
import Link from 'next/link'

const TYPE_LABEL: Record<string, string> = {
  general: '일반', pension: '연금저축', irp: 'IRP',
  isa: 'ISA', crypto: '코인', savings: '예적금', debt: '대출/부채',
}
const TX_LABEL: Record<string, string> = {
  buy: '매수', sell: '매도', dividend: '배당',
  deposit: '입금', withdraw: '출금', interest: '이자', fee: '수수료',
}

function fmtKrw(n: number) {
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n))
}
function pnlColor(v: number) {
  return v > 0 ? 'text-[#d31f47]' : v < 0 ? 'text-[#1763c9]' : 'text-[#9c9484]'
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: account }, { data: allAssets = [] }] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', id).single(),
    supabase.from('assets').select('*'),
  ])
  if (!account) notFound()

  const isDebt = account.type === 'debt'

  const { data: transactions = [] } = await supabase
    .from('transactions')
    .select('*, assets(name, symbol, asset_class)')
    .eq('account_id', id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  const txs = (transactions ?? []) as any[]
  const assets = (allAssets ?? []) as any[]

  // 대출 계좌: 잔액 테이블에서 현재 잔여 원금 조회
  let debtBalance = 0
  if (isDebt) {
    const { data: bal } = await supabase
      .from('balances')
      .select('amount')
      .eq('account_id', id)
      .order('as_of', { ascending: false })
      .limit(1)
      .single()
    debtBalance = bal?.amount ?? 0
  }

  const { priceMap, usdKrw } = await refreshPrices(assets)
  const holdings = isDebt ? [] : buildHoldings(txs, assets, [account], priceMap, usdKrw)

  const totalCost    = holdings.reduce((s, h) => s + h.total_cost_krw, 0)
  const totalMarket  = holdings.reduce((s, h) => s + (h.market_value_krw ?? h.total_cost_krw), 0)
  const totalPnl     = holdings.reduce((s, h) => s + (h.unrealized_pnl_krw ?? 0), 0)
  const hasPrice     = holdings.some(h => h.market_value_krw !== null)

  const pnlRows    = isDebt ? [] : buildRealizedPnL(txs, assets, usdKrw)
  const realizedPnl = pnlRows.reduce((s, r) => s + r.pnl_krw, 0)

  const xirrCfs = isDebt ? [] : buildXirrCashflows(txs, totalMarket, usdKrw)
  const xirr    = isDebt ? null : calcXirr(xirrCfs)

  // 이 계좌의 올해 배당 합산
  const thisYear = new Date().getFullYear().toString()
  const dividendTotal = txs
    .filter(t => t.type === 'dividend' && t.date?.startsWith(thisYear))
    .reduce((s, t) => s + (t.amount ?? 0) * (t.currency === 'USD' ? (usdKrw || 1) : 1), 0)

  // 대출 상환 스케줄 계산 (최대 60개월)
  const debtSchedule: { interest: number; principal: number; remaining: number }[] = []
  if (isDebt && debtBalance > 0 && account.interest_rate && account.monthly_payment) {
    const r = account.interest_rate / 100 / 12
    let rem = debtBalance
    for (let i = 0; i < 60 && rem > 0.5; i++) {
      const interest = rem * r
      const principal = Math.min(account.monthly_payment - interest, rem)
      if (principal <= 0) break
      rem -= principal
      debtSchedule.push({ interest, principal, remaining: rem })
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        {/* 뒤로 */}
        <Link href="/accounts" className="text-xs text-[#9c9484] hover:text-[#1c6b4a] mb-4 inline-block transition-colors">
          ← 계좌 목록
        </Link>

        {/* 계좌 헤더 */}
        <div className="flex items-center gap-3 mb-5">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            account.owner === 'spouse' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {account.owner === 'spouse' ? '아내' : '나'}
          </span>
          <h1 className="text-lg font-bold text-[#34322b]">{account.name}</h1>
          <span className="text-xs text-[#9c9484] bg-[#f0ead8] px-2 py-0.5 rounded-full">
            {account.broker ? `${account.broker} · ` : ''}{TYPE_LABEL[account.type] ?? account.type}
          </span>
          {account.tax_benefit && (
            <span className="text-[10px] text-[#1c6b4a] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">세제혜택</span>
          )}
        </div>

        {/* === 대출 계좌 전용 UI === */}
        {isDebt ? (
          <>
            {/* 대출 KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs text-amber-600">잔여 원금</p>
                <p className="text-lg font-bold text-[#34322b] mt-1">
                  {debtBalance > 0 ? fmtKrw(debtBalance) : '-'}
                </p>
                {debtBalance === 0 && <p className="text-[10px] text-[#b5aa98]">잔액 미입력</p>}
              </div>
              <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                <p className="text-xs text-[#9c9484]">연이자율</p>
                <p className="text-lg font-bold text-[#34322b] mt-1">
                  {account.interest_rate != null ? `${account.interest_rate}%` : '-'}
                </p>
              </div>
              <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                <p className="text-xs text-[#9c9484]">월 납입금</p>
                <p className="text-lg font-bold text-[#34322b] mt-1">
                  {account.monthly_payment != null ? fmtKrw(account.monthly_payment) : '-'}
                </p>
              </div>
              <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                <p className="text-xs text-[#9c9484]">만기일</p>
                <p className="text-lg font-bold text-[#34322b] mt-1">
                  {account.maturity_date ? account.maturity_date.slice(0, 7).replace('-', '.') : '-'}
                </p>
                {account.maturity_date && (() => {
                  const months = Math.max(0, Math.round(
                    (new Date(account.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
                  ))
                  return <p className="text-[10px] text-[#b5aa98] mt-0.5">잔여 {months}개월</p>
                })()}
              </div>
            </div>

            {/* 대출 총 이자 요약 */}
            {debtSchedule.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                  <p className="text-xs text-[#9c9484]">총 남은 이자 (추정)</p>
                  <p className="text-lg font-bold text-amber-600 mt-1">
                    {fmtKrw(debtSchedule.reduce((s, r) => s + r.interest, 0))}
                  </p>
                  <p className="text-[10px] text-[#b5aa98] mt-0.5">현 금리 기준</p>
                </div>
                <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                  <p className="text-xs text-[#9c9484]">상환 예정 기간</p>
                  <p className="text-lg font-bold text-[#34322b] mt-1">{debtSchedule.length}개월</p>
                  <p className="text-[10px] text-[#b5aa98] mt-0.5">
                    {Math.floor(debtSchedule.length / 12)}년 {debtSchedule.length % 12}개월
                  </p>
                </div>
              </div>
            )}

            {/* 원금/이자 분할 막대 차트 */}
            {debtSchedule.length > 0 && (() => {
              const show = debtSchedule.slice(0, 36)
              const maxPayment = account.monthly_payment as number
              const barW = Math.max(6, Math.min(16, Math.floor(560 / show.length) - 2))
              const H = 100
              return (
                <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden mb-4">
                  <div className="px-4 py-3 border-b border-[#e3d9c4] bg-[#f4eee0] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#34322b]">원금 · 이자 상환 추이</h2>
                    <div className="flex items-center gap-3 text-[10px] text-[#9c9484]">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#1c6b4a]" /> 원금</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-400" /> 이자</span>
                    </div>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <svg width={show.length * (barW + 2)} height={H + 20} className="overflow-visible">
                      {show.map((row, i) => {
                        const totalH = H
                        const interestH = Math.round((row.interest / maxPayment) * totalH)
                        const principalH = Math.round((row.principal / maxPayment) * totalH)
                        const x = i * (barW + 2)
                        return (
                          <g key={i}>
                            {/* 원금 (하단, 초록) */}
                            <rect x={x} y={H - principalH - interestH} width={barW} height={principalH} fill="#1c6b4a" rx="1" />
                            {/* 이자 (상단, 앰버) */}
                            <rect x={x} y={H - interestH} width={barW} height={interestH} fill="#f59e0b" rx="1" />
                            {/* 월 레이블 (6개월마다) */}
                            {i % 6 === 0 && (
                              <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#9c9484">
                                {i + 1}M
                              </text>
                            )}
                          </g>
                        )
                      })}
                    </svg>
                    {debtSchedule.length > 36 && (
                      <p className="text-[10px] text-[#b5aa98] mt-1">* 최초 36개월 표시</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </>
        ) : (
          <>
            {/* === 일반 투자 계좌 KPI === */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                <p className="text-xs text-[#9c9484]">평가금액</p>
                <p className="text-lg font-bold text-[#34322b] mt-1">
                  {hasPrice ? fmtKrw(totalMarket) : fmtKrw(totalCost)}
                </p>
                {!hasPrice && <p className="text-[10px] text-[#b5aa98]">시세 미조회</p>}
              </div>
              <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                <p className="text-xs text-[#9c9484]">투자원금</p>
                <p className="text-lg font-bold text-[#34322b] mt-1">{fmtKrw(totalCost)}</p>
              </div>
              <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                <p className="text-xs text-[#9c9484]">미실현 손익</p>
                <p className={`text-lg font-bold mt-1 ${hasPrice ? pnlColor(totalPnl) : 'text-[#9c9484]'}`}>
                  {hasPrice ? (totalPnl >= 0 ? '+' : '') + fmtKrw(totalPnl) : '-'}
                </p>
              </div>
              <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                <p className="text-xs text-[#9c9484]">XIRR</p>
                <p className={`text-lg font-bold mt-1 ${xirr != null ? pnlColor(xirr) : 'text-[#9c9484]'}`}>
                  {xirr != null ? (xirr >= 0 ? '+' : '') + (xirr * 100).toFixed(2) + '%' : '-'}
                </p>
              </div>
            </div>

            {/* 실현손익 + 올해 배당 */}
            {(pnlRows.length > 0 || dividendTotal > 0) && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                  <p className="text-xs text-[#9c9484]">실현 손익 (누적)</p>
                  <p className={`text-lg font-bold mt-1 ${pnlColor(realizedPnl)}`}>
                    {pnlRows.length > 0 ? (realizedPnl >= 0 ? '+' : '') + fmtKrw(realizedPnl) : '-'}
                  </p>
                  {pnlRows.length > 0 && <p className="text-[10px] text-[#b5aa98] mt-0.5">매도 {pnlRows.length}건</p>}
                </div>
                <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
                  <p className="text-xs text-[#9c9484]">배당 (올해)</p>
                  <p className="text-lg font-bold text-[#1c6b4a] mt-1">
                    {dividendTotal > 0 ? fmtKrw(dividendTotal) : '-'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* 보유 종목 */}
        {!isDebt && holdings.length > 0 && (
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-[#e3d9c4] bg-[#f4eee0]">
              <h2 className="text-sm font-semibold text-[#34322b]">보유 종목 ({holdings.length})</h2>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#f0ead8] text-[#9c9484]">
                  <th className="text-left px-4 py-2.5 font-medium">종목</th>
                  <th className="text-right px-4 py-2.5 font-medium">수량</th>
                  <th className="text-right px-4 py-2.5 font-medium">평균단가</th>
                  <th className="text-right px-4 py-2.5 font-medium">평가금액</th>
                  <th className="text-right px-4 py-2.5 font-medium">손익</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => (
                  <tr key={`${h.account_id}:${h.asset_id}`} className="border-b border-[#f4eee0] last:border-0 hover:bg-[#f4eee0] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#34322b]">{h.name}</p>
                      {h.symbol && <p className="text-[10px] text-[#9c9484] font-mono">{h.symbol}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-[#34322b]">
                      {Number.isInteger(h.quantity) ? h.quantity.toLocaleString() : h.quantity.toFixed(6).replace(/\.?0+$/, '')}
                    </td>
                    <td className="px-4 py-3 text-right text-[#34322b]">
                      {h.currency === 'USD' ? `$${h.avg_cost.toFixed(2)}` : `₩${Math.round(h.avg_cost).toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#34322b]">
                      {h.market_value_krw != null ? fmtKrw(h.market_value_krw) : fmtKrw(h.total_cost_krw)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {h.unrealized_pnl_krw != null ? (
                        <div>
                          <p className={`font-semibold ${pnlColor(h.unrealized_pnl_krw)}`}>
                            {h.unrealized_pnl_krw >= 0 ? '+' : ''}{fmtKrw(h.unrealized_pnl_krw)}
                          </p>
                          {h.unrealized_pnl_pct != null && (
                            <p className={`text-[10px] ${pnlColor(h.unrealized_pnl_pct)}`}>
                              {h.unrealized_pnl_pct >= 0 ? '+' : ''}{h.unrealized_pnl_pct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      ) : <span className="text-[#b5aa98]">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 거래 내역 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e3d9c4] bg-[#f4eee0] flex justify-between items-center">
            <h2 className="text-sm font-semibold text-[#34322b]">거래 내역</h2>
            <span className="text-xs text-[#9c9484]">총 {txs.length}건</span>
          </div>
          {txs.length === 0 ? (
            <p className="text-sm text-[#9c9484] p-6 text-center">거래 내역이 없습니다</p>
          ) : (
            <div className="divide-y divide-[#f0ead8]">
              {txs.slice(0, 15).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      tx.type === 'buy'      ? 'bg-red-50 text-[#d31f47]' :
                      tx.type === 'sell'     ? 'bg-blue-50 text-[#1763c9]' :
                      tx.type === 'dividend' ? 'bg-emerald-50 text-[#1c6b4a]' :
                      'bg-[#f0ead8] text-[#9c9484]'
                    }`}>
                      {TX_LABEL[tx.type] ?? tx.type}
                    </span>
                    <span className="text-[#34322b] font-medium">{tx.assets?.name ?? '현금'}</span>
                    {tx.quantity != null && (
                      <span className="text-[#9c9484]">{Number(tx.quantity).toLocaleString()}주</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[#9c9484]">{tx.date}</p>
                    {tx.amount != null && (
                      <p className="font-medium text-[#34322b]">
                        {tx.currency === 'USD' ? `$${Number(tx.amount).toLocaleString()}` : fmtKrw(tx.amount)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {txs.length > 15 && (
                <div className="px-4 py-3 text-center">
                  <Link href={`/transactions?account=${id}`} className="text-xs text-[#1c6b4a] hover:underline">
                    전체 {txs.length}건 보기 →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
