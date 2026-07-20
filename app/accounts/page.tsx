import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import AccountForm from './AccountForm'
import DeleteButton from './DeleteButton'
import Link from 'next/link'

const TYPE_LABEL: Record<string, string> = {
  general: '일반', pension: '연금저축', irp: 'IRP',
  isa: 'ISA', crypto: '코인', savings: '예적금', debt: '대출/부채',
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accounts = [] } = await supabase
    .from('accounts')
    .select('*')
    .order('sort_order')
    .order('created_at')

  const accs = (accounts ?? []) as any[]

  // 예적금 계좌의 마지막 잔액 입력일 조회 (balances 테이블)
  const savingsIds = accs.filter(a => a.type === 'savings').map(a => a.id)
  const lastBalanceDate = new Map<string, string>()
  if (savingsIds.length > 0) {
    try {
      const { data: balances } = await supabase
        .from('balances')
        .select('account_id, as_of')
        .in('account_id', savingsIds)
        .order('as_of', { ascending: false })
      for (const b of (balances ?? [])) {
        if (!lastBalanceDate.has(b.account_id)) {
          lastBalanceDate.set(b.account_id, b.as_of)
        }
      }
    } catch {
      // balances 테이블 미생성 시 무시
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-2xl">
        <h1 className="text-lg font-bold text-[#34322b] mb-6">계좌 관리</h1>

        {/* 계좌 목록 */}
        <div className="space-y-2 mb-6">
          {accs.length === 0 && (
            <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-8 text-center">
              <p className="text-sm text-[#9c9484]">등록된 계좌가 없습니다</p>
              <p className="text-xs text-[#b5aa98] mt-1">아래에서 첫 계좌를 추가해보세요</p>
            </div>
          )}
          {accs.map((acc: any) => {
            // 예적금 30일 경과 배지
            const isSavings = acc.type === 'savings'
            const lastDate = lastBalanceDate.get(acc.id)
            const stale = isSavings && (!lastDate || daysSince(lastDate) > 30)
            const daysAgo = lastDate ? daysSince(lastDate) : null

            return (
              <div
                key={acc.id}
                className={`bg-[#faf6ec] border rounded-xl flex items-center gap-3 ${
                  !acc.is_active ? 'opacity-50' : ''
                } ${stale ? 'border-amber-300' : 'border-[#e3d9c4]'}`}
              >
                {/* 상세로 이동 */}
                <Link
                  href={`/accounts/${acc.id}`}
                  className="flex-1 flex items-center gap-3 px-4 py-3.5 min-w-0"
                >
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                    acc.owner === 'spouse'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {acc.owner === 'spouse' ? '아내' : '나'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#34322b]">{acc.name}</p>
                      {stale && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                          평가액 갱신 필요
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9c9484] mt-0.5">
                      {acc.broker ? `${acc.broker} · ` : ''}
                      {TYPE_LABEL[acc.type] ?? acc.type}
                      {acc.tax_benefit && ' · 세제혜택'}
                      {!acc.is_active && ' · 비활성'}
                      {isSavings && daysAgo !== null && (
                        <span className={`ml-1 ${daysAgo > 30 ? 'text-amber-600' : ''}`}>
                          · 잔액 {daysAgo}일 전 입력
                        </span>
                      )}
                      {isSavings && daysAgo === null && (
                        <span className="ml-1 text-amber-600"> · 잔액 미입력</span>
                      )}
                    </p>
                  </div>
                </Link>
                <div className="pr-3 shrink-0">
                  <DeleteButton id={acc.id} name={acc.name} />
                </div>
              </div>
            )
          })}
        </div>

        {/* 새 계좌 추가 폼 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#34322b] mb-4">새 계좌 추가</h2>
          <AccountForm />
        </div>
      </div>
    </AppShell>
  )
}
