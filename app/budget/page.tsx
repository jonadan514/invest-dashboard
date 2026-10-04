import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import MonthlyForm from './MonthlyForm'

function fmtKrw(n: number) {
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n))
}

// 최근 N개월 + 미래 2개월 목록 생성
function generateMonths(n = 18): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = -2; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: qMonth } = await searchParams
  const month = qMonth ?? currentMonth()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 현재 월 entry + 전체 히스토리
  const [{ data: entryData }, { data: historyData }] = await Promise.all([
    supabase
      .from('invest_monthly_budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .maybeSingle(),
    supabase
      .from('invest_monthly_budgets')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(24),
  ])

  const entry = entryData ?? null
  const history = (historyData ?? []) as any[]
  const months = generateMonths(18)

  return (
    <AppShell>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-[#34322b]">재무 계획</h1>
            <p className="text-xs text-[#9c9484] mt-0.5">월별 공금 배분 · 비상금 추적</p>
          </div>
        </div>

        <Suspense fallback={<div className="h-64 bg-[#faf6ec] rounded-2xl animate-pulse" />}>
          <MonthlyForm month={month} entry={entry} months={months} />
        </Suspense>

        {/* 히스토리 테이블 */}
        {history.length > 0 && (
          <div className="mt-6 bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e3d9c4] bg-[#f4eee0]">
              <h2 className="text-sm font-semibold text-[#34322b]">월별 기록</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#f0ead8] text-[#9c9484]">
                    <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">월</th>
                    <th className="text-right px-3 py-2.5 font-medium whitespace-nowrap">예금 잔액</th>
                    <th className="text-right px-3 py-2.5 font-medium whitespace-nowrap">공금</th>
                    <th className="text-right px-3 py-2.5 font-medium whitespace-nowrap">성과급(배분)</th>
                    <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">단계</th>
                    <th className="text-left px-3 py-2.5 font-medium">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any) => {
                    const [hy, hm] = h.month.split('-')
                    const isCurrent = h.month === month
                    return (
                      <tr
                        key={h.id}
                        className={`border-b border-[#f4eee0] last:border-0 hover:bg-[#f4eee0] transition-colors cursor-pointer ${
                          isCurrent ? 'bg-emerald-50' : ''
                        }`}
                        onClick={() => {}}
                      >
                        <td className="px-4 py-3 font-medium text-[#34322b] whitespace-nowrap">
                          {hy}년 {parseInt(hm)}월
                          {isCurrent && <span className="ml-1 text-[10px] text-[#1c6b4a]">●</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-[#34322b] whitespace-nowrap">
                          {fmtKrw(h.cash_balance)}
                        </td>
                        <td className="px-3 py-3 text-right text-[#34322b] whitespace-nowrap">
                          {fmtKrw(h.joint_savings)}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {h.bonus_to_plan > 0
                            ? <span className="text-[#6b3fa0]">{fmtKrw(h.bonus_to_plan)}</span>
                            : <span className="text-[#b5aa98]">-</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            h.cash_balance >= 30_000_000
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {h.cash_balance >= 30_000_000 ? '2단계' : '1단계'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#9c9484] max-w-[160px] truncate">
                          {h.memo || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
