import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

const PENSION_LIMIT = 6_000_000
const TOTAL_LIMIT = 9_000_000

function fmt(v: number) {
  return '₩' + Math.round(Number(v || 0)).toLocaleString('ko-KR')
}

export default async function PensionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const year = String(new Date().getFullYear())

  const [{ data: accounts }, { data: snapshots }] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['pension', 'irp'])
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('account_monthly_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .gte('month', `${year}-01`)
      .lte('month', `${year}-12`)
      .order('month', { ascending: false }),
  ])

  const latestByAccount = new Map<string, any>()
  for (const row of snapshots ?? []) {
    if (!latestByAccount.has(row.account_id)) latestByAccount.set(row.account_id, row)
  }

  const owners = [
    { key: 'me', label: '본인' },
    { key: 'spouse', label: '배우자' },
  ] as const

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-5 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#819087]">Retirement</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#27332e]">연금</h1>
          <p className="mt-1 text-xs text-[#8b938e]">{year}년 납입액과 월말 평가금액을 관리합니다.</p>
        </div>

        {(accounts ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d2c7] bg-[#fffdf8] px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#59655f]">등록된 연금계좌가 없습니다.</p>
            <p className="mt-1 text-xs text-[#969c98]">금융 계좌에서 연금저축 또는 IRP 계좌를 추가하세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {owners.map(owner => {
              const ownerAccounts = (accounts ?? []).filter(a => a.owner === owner.key)
              const evaluation = ownerAccounts.reduce(
                (sum, a) => sum + Number(latestByAccount.get(a.id)?.evaluation_amount ?? 0),
                0
              )
              const ytd = ownerAccounts.reduce(
                (sum, a) => sum + Number(latestByAccount.get(a.id)?.ytd_contribution ?? 0),
                0
              )
              const pensionYtd = ownerAccounts
                .filter(a => a.type === 'pension')
                .reduce((sum, a) => sum + Number(latestByAccount.get(a.id)?.ytd_contribution ?? 0), 0)
              const deductible = Math.min(pensionYtd, PENSION_LIMIT) +
                Math.min(
                  Math.max(ytd - pensionYtd, 0),
                  Math.max(TOTAL_LIMIT - Math.min(pensionYtd, PENSION_LIMIT), 0)
                )
              const progress = Math.min(100, (deductible / TOTAL_LIMIT) * 100)

              return (
                <section key={owner.key} className="rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#2f3a35]">{owner.label}</p>
                      <p className="mt-1 text-xs text-[#929993]">{ownerAccounts.length}개 계좌</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#929993]">평가금액</p>
                      <p className="mt-1 text-lg font-semibold text-[#315c4c]">{fmt(evaluation)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-[#f6f2ea] p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#727b76]">연간 납입 누계</span>
                      <span className="font-semibold text-[#35423c]">{fmt(ytd)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-[#727b76]">세액공제 한도 진행</span>
                      <span className="font-semibold text-[#315c4c]">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e6e1d7]">
                      <div className="h-full rounded-full bg-[#4b7665]" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {ownerAccounts.map(acc => {
                      const row = latestByAccount.get(acc.id)
                      return (
                        <div key={acc.id} className="flex items-center justify-between rounded-xl border border-[#ebe5da] px-4 py-3">
                          <div>
                            <p className="text-xs font-semibold text-[#34423b]">{acc.name}</p>
                            <p className="mt-0.5 text-[10px] text-[#929993]">
                              {acc.type === 'irp' ? 'IRP' : '연금저축'} · {row?.month ?? '기록 없음'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-[#34423b]">{fmt(row?.evaluation_amount ?? 0)}</p>
                            <p className="mt-0.5 text-[10px] text-[#929993]">납입 {fmt(row?.ytd_contribution ?? 0)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <p className="mt-4 text-center text-[10px] text-[#9aa09c]">
          세액공제 표시는 관리용 참고값이며 실제 공제 가능액은 개인별 소득·세법 적용에 따라 달라질 수 있습니다.
        </p>
      </div>
    </AppShell>
  )
}
