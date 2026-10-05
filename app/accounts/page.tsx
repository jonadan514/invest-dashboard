import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import AccountForm from './AccountForm'
import DeleteButton from './DeleteButton'

const TYPE_LABEL: Record<string, string> = {
  general: '일반 투자계좌',
  pension: '연금저축',
  irp: 'IRP',
  isa: 'ISA',
  crypto: '가상자산',
  savings: '예적금',
  cash: '현금',
  mmf: 'MMF/CMA',
}

function fmt(v: number) {
  return '₩' + Math.round(Number(v || 0)).toLocaleString('ko-KR')
}

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: accounts }, { data: snapshots }] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('account_monthly_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(500),
  ])

  const latestByAccount = new Map<string, any>()
  for (const row of snapshots ?? []) {
    if (!latestByAccount.has(row.account_id)) latestByAccount.set(row.account_id, row)
  }

  const accs = (accounts ?? []) as any[]

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-5 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#819087]">Accounts</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#27332e]">금융 계좌</h1>
          <p className="mt-1 text-xs text-[#8b938e]">월말 평가액 기준으로 예금·연금·투자계좌를 관리합니다.</p>
        </div>

        <div className="space-y-2">
          {accs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8d2c7] bg-[#fffdf8] px-6 py-10 text-center">
              <p className="text-sm font-medium text-[#59655f]">등록된 금융 계좌가 없습니다.</p>
              <p className="mt-1 text-xs text-[#969c98]">아래에서 첫 계좌를 추가하세요.</p>
            </div>
          ) : (
            accs.map(acc => {
              const row = latestByAccount.get(acc.id)
              return (
                <div
                  key={acc.id}
                  className={`flex items-center gap-3 rounded-2xl border bg-[#fffdf8] px-4 py-3.5 ${
                    acc.is_active ? 'border-[#ddd7cc]' : 'border-[#ebe6dc] opacity-55'
                  }`}
                >
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    acc.owner === 'spouse'
                      ? 'bg-[#eee5f2] text-[#76567e]'
                      : 'bg-[#e4efe9] text-[#315c4c]'
                  }`}>
                    {acc.owner === 'spouse' ? '배우자' : '본인'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#34423b]">{acc.name}</p>
                      {acc.is_emergency_fund && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">비상금</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#929993]">
                      {acc.broker ? `${acc.broker} · ` : ''}
                      {TYPE_LABEL[acc.type] ?? acc.type}
                      {acc.tax_benefit ? ' · 세제혜택' : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-[#34423b]">{fmt(row?.evaluation_amount ?? 0)}</p>
                    <p className="mt-0.5 text-[10px] text-[#9aa09c]">{row?.month ?? '월말 기록 없음'}</p>
                  </div>

                  <div className="shrink-0 pl-1">
                    <DeleteButton id={acc.id} name={acc.name} />
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
          <p className="text-sm font-semibold text-[#2f3a35]">새 계좌 추가</p>
          <p className="mt-1 text-xs text-[#929993]">거래원장이 아니라 월말 평가액을 기록하는 Asset Management 계좌입니다.</p>
          <div className="mt-4">
            <AccountForm />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
