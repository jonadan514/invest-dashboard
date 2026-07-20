import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { buildRealizedPnL } from '@/lib/calc/realized-pnl'
import DeleteTxButton from './DeleteTxButton'
import { TX_LABEL, TX_COLOR } from '@/lib/labels'
import type { OwnerType } from '@/lib/types'

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'buy', label: '매수' },
  { value: 'sell', label: '매도' },
  { value: 'dividend', label: '배당' },
  { value: 'deposit', label: '입금' },
  { value: 'withdraw', label: '출금' },
]

function krw(n: number, currency = 'KRW') {
  const prefix = currency === 'USD' ? '$' : '₩'
  return prefix + new Intl.NumberFormat('ko-KR').format(Math.abs(Math.round(n)))
}

function pnlClass(v: number) {
  return v > 0 ? 'text-[#d31f47]' : v < 0 ? 'text-[#1763c9]' : 'text-[#9c9484]'
}

function sign(v: number) { return v > 0 ? '+' : v < 0 ? '-' : '' }

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; type?: string }>
}) {
  const { owner, type: typeFilter } = await searchParams
  const ownerFilter = (owner === 'me' || owner === 'spouse') ? owner as OwnerType : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 계좌 조회 (owner 필터 반영)
  let accountsQuery = supabase.from('accounts').select('id, name, owner').eq('is_active', true)
  if (ownerFilter) accountsQuery = accountsQuery.eq('owner', ownerFilter)
  const { data: accounts = [] } = await accountsQuery
  const accountIds = (accounts ?? []).map((a: any) => a.id)

  if (accountIds.length === 0) {
    return (
      <AppShell>
        <div className="p-6">
          <h1 className="text-lg font-bold text-[#34322b] mb-4">거래 내역</h1>
          <p className="text-sm text-[#9c9484]">등록된 계좌가 없습니다.</p>
        </div>
      </AppShell>
    )
  }

  // 거래 + 자산 병렬 조회
  const [{ data: transactions = [] }, { data: assets = [] }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, accounts(name, owner), assets(name, symbol, asset_class)')
      .in('account_id', accountIds)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('assets').select('*'),
  ])

  // 실현손익 맵 (tx_id → pnl row)
  const pnlRows = buildRealizedPnL(transactions ?? [], assets ?? [])
  const pnlByTxId = new Map(pnlRows.map(r => [r.tx_id, r]))

  // 유형 필터 적용
  const filtered = typeFilter
    ? (transactions ?? []).filter((tx: any) => tx.type === typeFilter)
    : (transactions ?? [])

  // 실현손익 합계 (전체, 필터 전)
  const totalRealizedPnlKrw = pnlRows.reduce((s, r) => s + r.pnl_krw, 0)
  const sellCount = pnlRows.length

  // 유형 필터 링크 생성 (owner 파라미터 유지)
  function filterHref(t: string) {
    const params = new URLSearchParams()
    if (owner) params.set('owner', owner)
    if (t) params.set('type', t)
    return `/transactions?${params.toString()}`
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-[#34322b]">거래 내역</h1>
          <Link
            href="/transactions/new"
            className="bg-[#1c6b4a] hover:bg-[#165638] text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
          >
            + 거래 입력
          </Link>
        </div>

        {/* 요약 카드 */}
        {sellCount > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
              <p className="text-xs text-[#9c9484]">실현 손익 (누적)</p>
              <p className={`text-xl font-bold mt-1 ${pnlClass(totalRealizedPnlKrw)}`}>
                {sign(totalRealizedPnlKrw)}{krw(totalRealizedPnlKrw)}
              </p>
              <p className="text-[10px] text-[#b5aa98] mt-0.5">매도 {sellCount}건 기준</p>
            </div>
            <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
              <p className="text-xs text-[#9c9484]">총 거래 건수</p>
              <p className="text-xl font-bold text-[#34322b] mt-1">
                {(transactions ?? []).length}건
              </p>
              <p className="text-[10px] text-[#b5aa98] mt-0.5">
                매수 {(transactions ?? []).filter((t: any) => t.type === 'buy').length} ·
                매도 {sellCount} ·
                배당 {(transactions ?? []).filter((t: any) => t.type === 'dividend').length}
              </p>
            </div>
          </div>
        )}

        {/* 유형 필터 */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TYPE_FILTERS.map(f => (
            <Link
              key={f.value}
              href={filterHref(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                (typeFilter ?? '') === f.value
                  ? 'bg-[#1c6b4a] text-white'
                  : 'bg-white border border-[#e3d9c4] text-[#34322b] hover:border-[#1c6b4a]'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* 거래 목록 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-[#9c9484] text-center py-10">거래 내역이 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#e3d9c4] bg-[#f4eee0]">
                    <th className="text-left text-[#9c9484] font-medium px-4 py-2.5">날짜</th>
                    <th className="text-left text-[#9c9484] font-medium px-3 py-2.5">계좌</th>
                    <th className="text-left text-[#9c9484] font-medium px-3 py-2.5">종목</th>
                    <th className="text-center text-[#9c9484] font-medium px-3 py-2.5">유형</th>
                    <th className="text-right text-[#9c9484] font-medium px-3 py-2.5">수량</th>
                    <th className="text-right text-[#9c9484] font-medium px-3 py-2.5">단가</th>
                    <th className="text-right text-[#9c9484] font-medium px-3 py-2.5">금액</th>
                    <th className="text-right text-[#9c9484] font-medium px-3 py-2.5">실현손익</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx: any) => {
                    const pnl = tx.type === 'sell' ? pnlByTxId.get(tx.id) : null
                    const currency: string = tx.currency ?? 'KRW'
                    return (
                      <tr key={tx.id} className="border-b border-[#f0ead8] last:border-0 hover:bg-[#f4eee0] transition-colors">
                        <td className="px-4 py-2.5 text-[#9c9484] whitespace-nowrap">{tx.date}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mr-1 ${
                            tx.accounts?.owner === 'spouse'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {tx.accounts?.owner === 'spouse' ? '아내' : '나'}
                          </span>
                          <span className="text-[#34322b]">{tx.accounts?.name ?? '-'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[#34322b]">
                          {tx.assets?.name ?? <span className="text-[#b5aa98]">현금</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TX_COLOR[tx.type] ?? 'bg-[#f0ead8] text-[#9c9484]'}`}>
                            {TX_LABEL[tx.type] ?? tx.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#34322b]">
                          {tx.quantity != null ? Number(tx.quantity).toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#34322b]">
                          {tx.price != null
                            ? (currency === 'USD' ? '$' : '₩') + Number(tx.price).toLocaleString()
                            : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#34322b] font-medium">
                          {tx.amount != null
                            ? (currency === 'USD' ? '$' : '₩') + Number(tx.amount).toLocaleString()
                            : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {pnl ? (
                            <div>
                              <p className={`font-medium ${pnlClass(pnl.pnl_krw)}`}>
                                {sign(pnl.pnl_krw)}{krw(pnl.pnl_krw)}
                              </p>
                              <p className={`text-[10px] ${pnlClass(pnl.pnl_pct)}`}>
                                {sign(pnl.pnl_pct)}{Math.abs(pnl.pnl_pct).toFixed(1)}%
                              </p>
                            </div>
                          ) : (
                            <span className="text-[#e3d9c4]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/transactions/edit/${tx.id}`}
                              className="text-[10px] text-[#9c9484] hover:text-[#1c6b4a] transition-colors px-1"
                            >
                              수정
                            </Link>
                            <DeleteTxButton id={tx.id} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
