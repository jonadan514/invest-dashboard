import Link from 'next/link'
import { getHouseholdContext } from '@/lib/supabase/server'
import { buildRealizedPnL } from '@/lib/calc/realized-pnl'
import DeleteTxButton from './DeleteTxButton'
import { TX_LABEL, TX_COLOR } from '@/lib/labels'
import type { Account, Asset, OwnerType, Transaction } from '@/lib/types'

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
  return v > 0 ? 'text-[#d31f47]' : v < 0 ? 'text-[#1763c9]' : 'text-[#65758a]'
}

function sign(v: number) { return v > 0 ? '+' : v < 0 ? '-' : '' }

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; type?: string }>
}) {
  const { owner, type: typeFilter } = await searchParams
  const ownerFilter = (owner === 'me' || owner === 'spouse') ? owner as OwnerType : null

  const { supabase, userId } = await getHouseholdContext()

  // 계좌 조회 (owner 필터 반영)
  let accountsQuery = supabase.from('accounts').select('id, name, owner').eq('user_id', userId).eq('is_active', true)
  if (ownerFilter) accountsQuery = accountsQuery.eq('owner', ownerFilter)
  const { data: accounts = [] } = await accountsQuery.throwOnError()
  const accountIds = ((accounts ?? []) as Pick<Account, 'id' | 'name' | 'owner'>[]).map(account => account.id)

  if (accountIds.length === 0) {
    return (
      <>
        <div className="page-container max-w-5xl">
          <h1 className="page-title mb-4">거래 내역</h1>
          <p className="text-sm text-[#65758a]">등록된 계좌가 없습니다.</p>
        </div>
      </>
    )
  }

  // 거래 + 자산 병렬 조회
  const [{ data: transactions = [] }, { data: assets = [] }, { data: usdFx }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, accounts(name, owner), assets(name, symbol, asset_class)')
      .eq('user_id', userId)
      .in('account_id', accountIds)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }).throwOnError(),
    supabase.from('assets').select('*').eq('user_id', userId).throwOnError(),
    supabase.from('fx_rates').select('rate').eq('pair', 'USDKRW').order('as_of', { ascending: false }).limit(1).maybeSingle().throwOnError(),
  ])

  // 실현손익 맵 (tx_id → pnl row)
  const typedTransactions = (transactions ?? []) as Transaction[]
  const typedAssets = (assets ?? []) as Asset[]
  const pnlRows = buildRealizedPnL(typedTransactions, typedAssets, Number(usdFx?.rate ?? 1400))
  const pnlByTxId = new Map(pnlRows.map(r => [r.tx_id, r]))

  // 유형 필터 적용
  const filtered = typeFilter
    ? typedTransactions.filter(tx => tx.type === typeFilter)
    : typedTransactions

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
    <>
      <div className="page-container max-w-5xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="page-eyebrow">Ledger</p>
            <h1 className="page-title">거래 내역</h1>
            <p className="mt-2 text-sm text-[#65758a]">입출금과 매매 금액을 기록하고 수정하는 거래 원장입니다.</p>
          </div>
          <Link
            href="/transactions/new"
            className="bg-[#3f7fc3] hover:bg-[#326ba6] text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
          >
            + 거래 입력
          </Link>
        </div>

        {/* 요약 카드 */}
        {sellCount > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-[#ffffff] border border-[#d7e1eb] rounded-2xl p-4">
              <p className="text-xs text-[#65758a]">실현 손익 (누적)</p>
              <p className={`text-xl font-bold mt-1 ${pnlClass(totalRealizedPnlKrw)}`}>
                {sign(totalRealizedPnlKrw)}{krw(totalRealizedPnlKrw)}
              </p>
              <p className="text-[10px] text-[#93a2b5] mt-0.5">매도 {sellCount}건 기준</p>
            </div>
            <div className="bg-[#ffffff] border border-[#d7e1eb] rounded-2xl p-4">
              <p className="text-xs text-[#65758a]">총 거래 건수</p>
              <p className="text-xl font-bold text-[#172233] mt-1">
                {typedTransactions.length}건
              </p>
              <p className="text-[10px] text-[#93a2b5] mt-0.5">
                매수 {typedTransactions.filter(t => t.type === 'buy').length} ·
                매도 {sellCount} ·
                배당 {typedTransactions.filter(t => t.type === 'dividend').length}
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
                  ? 'bg-[#3f7fc3] text-white'
                  : 'bg-white border border-[#d7e1eb] text-[#172233] hover:border-[#3f7fc3]'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* 거래 목록 */}
        <div className="bg-[#ffffff] border border-[#d7e1eb] rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-[#65758a] text-center py-10">거래 내역이 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#d7e1eb] bg-[#f3f7fb]">
                    <th className="text-left text-[#65758a] font-medium px-4 py-2.5">날짜</th>
                    <th className="text-left text-[#65758a] font-medium px-3 py-2.5">계좌</th>
                    <th className="text-left text-[#65758a] font-medium px-3 py-2.5">종목</th>
                    <th className="text-center text-[#65758a] font-medium px-3 py-2.5">유형</th>
                    <th className="text-right text-[#65758a] font-medium px-3 py-2.5">수량</th>
                    <th className="text-right text-[#65758a] font-medium px-3 py-2.5">단가</th>
                    <th className="text-right text-[#65758a] font-medium px-3 py-2.5">금액</th>
                    <th className="text-right text-[#65758a] font-medium px-3 py-2.5">실현손익</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => {
                    const pnl = tx.type === 'sell' ? pnlByTxId.get(tx.id) : null
                    const currency: string = tx.currency ?? 'KRW'
                    return (
                      <tr key={tx.id} className="border-b border-[#edf3f8] last:border-0 hover:bg-[#f3f7fb] transition-colors">
                        <td className="px-4 py-2.5 text-[#65758a] whitespace-nowrap">{tx.date}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mr-1 ${
                            tx.accounts?.owner === 'spouse'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {tx.accounts?.owner === 'spouse' ? '아내' : '나'}
                          </span>
                          <span className="text-[#172233]">{tx.accounts?.name ?? '-'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[#172233]">
                          {tx.assets?.name ?? <span className="text-[#93a2b5]">현금</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TX_COLOR[tx.type] ?? 'bg-[#edf3f8] text-[#65758a]'}`}>
                            {TX_LABEL[tx.type] ?? tx.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#172233]">
                          {tx.quantity != null ? Number(tx.quantity).toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#172233]">
                          {tx.price != null
                            ? (currency === 'USD' ? '$' : '₩') + Number(tx.price).toLocaleString()
                            : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#172233] font-medium">
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
                            <span className="text-[#d7e1eb]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/transactions/edit/${tx.id}`}
                              className="text-[10px] text-[#65758a] hover:text-[#3f7fc3] transition-colors px-1"
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
    </>
  )
}
