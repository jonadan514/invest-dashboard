import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

function fmt(v: number) {
  return '₩' + Math.round(Number(v || 0)).toLocaleString('ko-KR')
}

export default async function NetWorthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: items }, { data: snapshots }, { data: portfolio }] = await Promise.all([
    supabase
      .from('net_worth_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('net_worth_snapshots')
      .select('item_id, month, amount, source')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(500),
    supabase
      .from('portfolio_snapshots')
      .select('month, amount')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(1),
  ])

  const latest = new Map<string, { month: string; amount: number; source: string }>()
  for (const row of snapshots ?? []) {
    if (!latest.has(row.item_id)) {
      latest.set(row.item_id, {
        month: row.month,
        amount: Number(row.amount ?? 0),
        source: row.source,
      })
    }
  }

  const assets = (items ?? []).filter(i => i.kind === 'asset')
  const liabilities = (items ?? []).filter(i => i.kind === 'liability')
  const assetTotal = assets.reduce((sum, i) => sum + (latest.get(i.id)?.amount ?? 0), 0)
  const liabilityTotal = liabilities.reduce((sum, i) => sum + (latest.get(i.id)?.amount ?? 0), 0)
  const portfolioAmount = Number(portfolio?.[0]?.amount ?? 0)
  const netWorth = assetTotal + portfolioAmount - liabilityTotal

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-5 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#819087]">Balance sheet</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#27332e]">순자산</h1>
          <p className="mt-1 text-xs text-[#8b938e]">부동산·현금·금융자산·부채를 월말 기준으로 관리합니다.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Summary label="총 자산" value={assetTotal + portfolioAmount} />
          <Summary label="총 부채" value={liabilityTotal} />
          <Summary label="순자산" value={netWorth} accent />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <List title="자산" items={assets} latest={latest} />
          <List title="부채" items={liabilities} latest={latest} />
        </div>

        <section className="mt-4 rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2f3a35]">투자계좌 평가액</p>
              <p className="mt-1 text-xs text-[#929993]">월말 포트폴리오 스냅샷</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-[#33423b]">{fmt(portfolioAmount)}</p>
              <p className="text-[10px] text-[#9aa09c]">{portfolio?.[0]?.month ?? '기록 없음'}</p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}

function Summary({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-[#b9cbbf] bg-[#eaf1ed]' : 'border-[#ddd7cc] bg-[#fffdf8]'}`}>
      <p className="text-[11px] text-[#838b86]">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${accent ? 'text-[#244c3e]' : 'text-[#313c37]'}`}>{fmt(value)}</p>
    </div>
  )
}

function List({
  title,
  items,
  latest,
}: {
  title: string
  items: any[]
  latest: Map<string, { month: string; amount: number; source: string }>
}) {
  return (
    <section className="rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
      <p className="text-sm font-semibold text-[#2f3a35]">{title}</p>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#ddd7cc] px-4 py-6 text-center text-xs text-[#9aa09c]">
            등록된 항목이 없습니다.
          </div>
        ) : (
          items.map(item => {
            const row = latest.get(item.id)
            return (
              <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#f7f3eb] px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-[#35423c]">{item.name}</p>
                  <p className="mt-0.5 text-[10px] text-[#929993]">
                    {item.category} · {item.owner === 'spouse' ? '배우자' : item.owner === 'me' ? '본인' : '가계'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[#35423c]">{fmt(row?.amount ?? 0)}</p>
                  <p className="mt-0.5 text-[10px] text-[#9aa09c]">{row?.month ?? '기록 없음'}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
