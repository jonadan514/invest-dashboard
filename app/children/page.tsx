import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

function fmt(v: number) {
  return '₩' + Math.round(Number(v || 0)).toLocaleString('ko-KR')
}

export default async function ChildrenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: children }, { data: accounts }, { data: snapshots }, { data: gifts }] = await Promise.all([
    supabase.from('children').select('*').eq('user_id', user.id).eq('is_active', true).order('birth_date'),
    supabase.from('child_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at'),
    supabase.from('child_account_monthly_snapshots').select('*').eq('user_id', user.id).order('month', { ascending: false }).limit(300),
    supabase.from('child_gift_deposits').select('*').eq('user_id', user.id).order('gift_date', { ascending: false }).limit(100),
  ])

  const latestByAccount = new Map<string, any>()
  for (const row of snapshots ?? []) {
    if (!latestByAccount.has(row.account_id)) latestByAccount.set(row.account_id, row)
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-5 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#819087]">Children</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#27332e]">자녀 자산</h1>
          <p className="mt-1 text-xs text-[#8b938e]">자녀 계좌 평가액과 증여·입금 기록을 분리해서 관리합니다.</p>
        </div>

        {(children ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d2c7] bg-[#fffdf8] px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#59655f]">등록된 자녀 프로필이 없습니다.</p>
            <p className="mt-1 text-xs text-[#969c98]">Asset Management DB의 자녀 관리 구조는 준비되어 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(children ?? []).map(child => {
              const childAccounts = (accounts ?? []).filter(a => a.child_id === child.id)
              const childGifts = (gifts ?? []).filter(g => g.child_id === child.id)
              const valuation = childAccounts.reduce((sum, a) => sum + Number(latestByAccount.get(a.id)?.evaluation_amount ?? 0), 0)
              const gifted = childGifts
                .filter(g => g.transfer_type === 'gift')
                .reduce((sum, g) => sum + Number(g.amount ?? 0), 0)

              return (
                <section key={child.id} className="rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-semibold text-[#2f3a35]">{child.name}</p>
                      <p className="mt-1 text-xs text-[#929993]">{child.birth_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#929993]">현재 평가액</p>
                      <p className="mt-1 text-lg font-semibold text-[#315c4c]">{fmt(valuation)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#f6f2ea] px-4 py-3">
                      <p className="text-[10px] text-[#8b938e]">관리 계좌</p>
                      <p className="mt-1 text-sm font-semibold text-[#34423b]">{childAccounts.length}개</p>
                    </div>
                    <div className="rounded-xl bg-[#f6f2ea] px-4 py-3">
                      <p className="text-[10px] text-[#8b938e]">증여 기록 합계</p>
                      <p className="mt-1 text-sm font-semibold text-[#34423b]">{fmt(gifted)}</p>
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
