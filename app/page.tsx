import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

function krw(v: number) {
  const n = Number(v || 0)
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 10_000).toLocaleString('ko-KR')}만`
  return Math.round(n).toLocaleString('ko-KR')
}

function pct(v: number) {
  return `${Math.max(0, v).toFixed(1)}%`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: plan },
    { data: budgetRows },
    { data: items },
    { data: snapshots },
    { data: portfolioRows },
    { data: goals },
  ] = await Promise.all([
    supabase
      .from('financial_plan_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('monthly_budgets')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(6),
    supabase
      .from('net_worth_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('net_worth_snapshots')
      .select('item_id, month, amount')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(300),
    supabase
      .from('portfolio_snapshots')
      .select('month, amount')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(1),
    supabase
      .from('household_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
      .limit(6),
  ])

  const latestByItem = new Map<string, { month: string; amount: number }>()
  for (const row of snapshots ?? []) {
    if (!latestByItem.has(row.item_id)) {
      latestByItem.set(row.item_id, { month: row.month, amount: Number(row.amount ?? 0) })
    }
  }

  let manualAssets = 0
  let liabilities = 0
  for (const item of items ?? []) {
    const amount = latestByItem.get(item.id)?.amount ?? 0
    if (item.kind === 'liability') liabilities += amount
    else manualAssets += amount
  }

  const portfolio = Number(portfolioRows?.[0]?.amount ?? 0)
  const totalAssets = manualAssets + portfolio
  const netWorth = totalAssets - liabilities

  const latestBudget = budgetRows?.[0]
  const emergencyFund = Number(
    latestBudget?.cash_balance ?? plan?.current_emergency_fund ?? 0
  )
  const emergencyTarget = Number(plan?.stage1_target ?? 30_000_000)
  const emergencyPct = emergencyTarget > 0 ? (emergencyFund / emergencyTarget) * 100 : 0

  const monthlyFixedCost = Number(plan?.monthly_fixed_cost ?? 4_000_000)
  const coverage = monthlyFixedCost > 0 ? emergencyFund / monthlyFixedCost : 0

  const monthlyGrowth = Number(latestBudget?.joint_savings ?? 0) +
    Number(latestBudget?.bonus_to_plan ?? 0)

  const monthlyContribution = Number(plan?.monthly_joint_contribution ?? 0)
  const mortgagePayment = Number(plan?.mortgage_interest ?? 0) +
    Number(plan?.mortgage_principal ?? 0)
  const mortgageBurden = monthlyContribution > 0
    ? (mortgagePayment / monthlyContribution) * 100
    : 0

  const latestMonth =
    snapshots?.[0]?.month ??
    portfolioRows?.[0]?.month ??
    latestBudget?.month ??
    null

  const activeGoals = (goals ?? []).filter(g => !g.achieved_at)

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-5 md:p-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#819087]">
              Household overview
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#27332e]">
              우리 집 자산 현황
            </h1>
            <p className="mt-1 text-xs text-[#8b938e]">
              {latestMonth ? `${latestMonth} 기준` : '아직 월말 자산 기록이 없습니다'}
            </p>
          </div>
          <Link
            href="/net-worth"
            className="rounded-xl border border-[#d8d2c7] bg-white px-3.5 py-2 text-xs font-medium text-[#405148] hover:border-[#9caf9f]"
          >
            순자산 상세 →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="총 순자산" value={`₩${krw(netWorth)}`} strong />
          <Metric label="총 자산" value={`₩${krw(totalAssets)}`} />
          <Metric label="총 부채" value={`₩${krw(liabilities)}`} />
          <Metric label="이번 달 저축·배분" value={`₩${krw(monthlyGrowth)}`} />
          <Metric label="주담대 부담" value={pct(mortgageBurden)} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5 lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[#7f8a84]">비상금</p>
                <p className="mt-1 text-xl font-semibold text-[#27332e]">
                  ₩{krw(emergencyFund)}
                </p>
                <p className="mt-1 text-xs text-[#969c98]">
                  목표 ₩{krw(emergencyTarget)}
                </p>
              </div>
              <span className="rounded-full bg-[#e7f0eb] px-2.5 py-1 text-xs font-semibold text-[#315c4c]">
                {pct(Math.min(emergencyPct, 100))}
              </span>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#ebe6dc]">
              <div
                className="h-full rounded-full bg-[#315c4c]"
                style={{ width: `${Math.min(Math.max(emergencyPct, 0), 100)}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f5f1e8] px-4 py-3">
                <p className="text-[11px] text-[#8a918d]">생활비 커버리지</p>
                <p className="mt-1 text-base font-semibold text-[#33423b]">
                  {coverage.toFixed(1)}개월
                </p>
              </div>
              <div className="rounded-xl bg-[#f5f1e8] px-4 py-3">
                <p className="text-[11px] text-[#8a918d]">목표까지 남은 금액</p>
                <p className="mt-1 text-base font-semibold text-[#33423b]">
                  ₩{krw(Math.max(emergencyTarget - emergencyFund, 0))}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
            <p className="text-xs font-medium text-[#7f8a84]">자산 구성</p>
            <div className="mt-4 space-y-3">
              <Breakdown label="수동 관리 자산" amount={manualAssets} total={totalAssets} />
              <Breakdown label="투자계좌 평가액" amount={portfolio} total={totalAssets} />
              <Breakdown label="부채" amount={liabilities} total={Math.max(totalAssets, liabilities)} negative />
            </div>
          </section>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#2d3933]">가계 목표</p>
                <p className="mt-1 text-xs text-[#929993]">현재 진행 중인 우선순위</p>
              </div>
              <Link href="/settings#goals" className="text-xs text-[#446f60] hover:underline">
                관리 →
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {activeGoals.length === 0 ? (
                <Empty text="등록된 가계 목표가 없습니다." />
              ) : (
                activeGoals.slice(0, 4).map((goal, index) => (
                  <div key={goal.id} className="flex items-start gap-3 rounded-xl bg-[#f6f2ea] px-4 py-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#dfeae4] text-[10px] font-semibold text-[#315c4c]">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#34423b]">{goal.name}</p>
                      <p className="mt-0.5 text-[11px] text-[#8b938e]">{goal.statement}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
            <p className="text-sm font-semibold text-[#2d3933]">빠른 관리</p>
            <p className="mt-1 text-xs text-[#929993]">자산관리 핵심 메뉴</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Quick href="/net-worth" title="순자산" sub="자산·부채 월말 기록" />
              <Quick href="/budget" title="재무 계획" sub="공금·성과급 배분" />
              <Quick href="/accounts" title="금융 계좌" sub="예금·연금 계좌 관리" />
              <Quick href="/children" title="자녀 자산" sub="증여·계좌 평가 기록" />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${
      strong
        ? 'border-[#b9cbbf] bg-[#eaf1ed]'
        : 'border-[#ddd7cc] bg-[#fffdf8]'
    }`}>
      <p className="text-[11px] text-[#838b86]">{label}</p>
      <p className={`mt-1.5 text-lg font-semibold tracking-tight ${
        strong ? 'text-[#244c3e]' : 'text-[#313c37]'
      }`}>{value}</p>
    </div>
  )
}

function Breakdown({
  label,
  amount,
  total,
  negative = false,
}: {
  label: string
  amount: number
  total: number
  negative?: boolean
}) {
  const ratio = total > 0 ? Math.min(100, (amount / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#6f7873]">{label}</span>
        <span className={negative ? 'text-[#8a5f59]' : 'text-[#36443d]'}>
          ₩{krw(amount)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ece7de]">
        <div
          className={`h-full rounded-full ${negative ? 'bg-[#b38379]' : 'bg-[#648d7c]'}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  )
}

function Quick({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="rounded-xl border border-[#ebe5da] bg-[#f8f5ee] p-3 hover:border-[#c8d5cd]">
      <p className="text-xs font-semibold text-[#34423b]">{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-[#929993]">{sub}</p>
    </Link>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#ddd7cc] px-4 py-6 text-center text-xs text-[#9aa09c]">
      {text}
    </div>
  )
}
