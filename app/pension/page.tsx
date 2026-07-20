import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { buildHoldings } from '@/lib/calc/holdings'
import { refreshPrices } from '@/lib/prices/refresh'

// 세액공제 한도
const PENSION_DEDUCT_LIMIT = 6_000_000   // 연금저축 단독 한도
const TOTAL_DEDUCT_LIMIT   = 9_000_000   // 연금저축+IRP 합산 한도
const PENSION_MAX_CONTRIB  = 18_000_000  // 연금저축 최대 납입

function fmtKrw(n: number) {
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n))
}

function fmtM(n: number) {
  return (n / 10_000_000).toFixed(1) + '천만'
}

interface YearData {
  year: string
  me: number
  spouse: number
  total: number
}

function YearlyChart({ data, thisYear }: { data: YearData[]; thisYear: string }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map(d => d.total), 1)

  return (
    <div>
      <div className="flex items-end gap-2 h-32">
        {data.map(d => {
          const totalPct = (d.total / max) * 100
          const mePct    = d.total > 0 ? (d.me / d.total) * 100 : 0
          const isCurrent = d.year === thisYear
          return (
            <div key={d.year} className="flex-1 flex flex-col items-center gap-1 group">
              {/* 툴팁 */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#34322b] bg-white border border-[#e3d9c4] rounded-lg px-2 py-1 whitespace-nowrap shadow-sm pointer-events-none text-center">
                {d.me > 0 && <div className="text-[#1c6b4a]">나 {fmtKrw(d.me)}</div>}
                {d.spouse > 0 && <div className="text-purple-600">아내 {fmtKrw(d.spouse)}</div>}
              </div>
              {/* 스택 바 */}
              <div className="w-full flex flex-col justify-end rounded-t-md overflow-hidden" style={{ height: `${Math.max(totalPct, 2)}%` }}>
                {/* 아내 (위) */}
                {d.spouse > 0 && (
                  <div
                    className="w-full transition-all"
                    style={{ height: `${100 - mePct}%`, backgroundColor: isCurrent ? '#6b3fa0' : '#9b6fbf' }}
                  />
                )}
                {/* 나 (아래) */}
                {d.me > 0 && (
                  <div
                    className="w-full transition-all"
                    style={{ height: `${mePct}%`, backgroundColor: isCurrent ? '#1c6b4a' : '#5a9b7a' }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* X축 레이블 */}
      <div className="flex gap-2 mt-1.5">
        {data.map(d => (
          <div key={d.year} className={`flex-1 text-center text-[10px] ${
            d.year === thisYear ? 'text-[#34322b] font-semibold' : 'text-[#b5aa98]'
          }`}>
            {d.year.slice(2)}년
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        <span className="flex items-center gap-1.5 text-[10px] text-[#9c9484]">
          <span className="w-3 h-3 rounded-sm inline-block bg-[#1c6b4a]" />나
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#9c9484]">
          <span className="w-3 h-3 rounded-sm inline-block bg-[#6b3fa0]" />아내
        </span>
      </div>
    </div>
  )
}

function calcDeductible(pension: number, irp: number) {
  const pd = Math.min(pension, PENSION_DEDUCT_LIMIT)
  const id = Math.min(irp, TOTAL_DEDUCT_LIMIT - pd)
  return { pensionDeductible: pd, irpDeductible: id, total: pd + id }
}

function ProgressBar({
  value, max, color = '#1c6b4a', warn = false,
}: {
  value: number; max: number; color?: string; warn?: boolean
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0)
  const bg = warn && pct >= 100 ? '#1c6b4a' : color
  return (
    <div className="h-1.5 bg-[#e3d9c4] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bg }} />
    </div>
  )
}

function StatusChip({ done }: { done: boolean }) {
  return done
    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">달성 ✓</span>
    : <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0ead8] text-[#9c9484]">미달성</span>
}

interface PersonStats {
  owner: 'me' | 'spouse'
  label: string
  pensionDeposit: number
  irpDeposit: number
  totalContrib: number
  holdingValue: number
  accounts: any[]
  holdings: any[]
}

export default async function PensionPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: allAccounts } = await supabase
    .from('accounts')
    .select('*')
    .in('type', ['pension', 'irp'])
    .eq('is_active', true)
    .order('sort_order')

  const accounts = allAccounts ?? []

  if (accounts.length === 0) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl">
          <h1 className="text-lg font-bold text-[#34322b] mb-4">연금 현황</h1>
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-10 text-center">
            <p className="text-sm text-[#9c9484]">연금저축·IRP 계좌가 없습니다</p>
            <p className="text-xs text-[#b5aa98] mt-1">계좌 관리에서 추가하세요</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const accountIds = accounts.map((a: any) => a.id)
  const thisYear = new Date().getFullYear().toString()

  const [{ data: txAll }, { data: assets }] = await Promise.all([
    supabase.from('transactions').select('*').in('account_id', accountIds),
    supabase.from('assets').select('*'),
  ])

  const { priceMap, usdKrw } = await refreshPrices(assets ?? [])
  const holdings = buildHoldings(txAll ?? [], assets ?? [], accounts, priceMap, usdKrw)

  // 계좌별 올해 납입액
  const depositByAccount = new Map<string, number>()
  // 연도별 납입액 (나/아내 구분)
  const yearlyMap = new Map<string, { me: number; spouse: number }>()

  for (const tx of (txAll ?? []) as any[]) {
    if (tx.type !== 'deposit') continue
    const year = (tx.date as string).slice(0, 4)
    const amount = tx.amount ?? 0
    const acc = accounts.find((a: any) => a.id === tx.account_id) as any

    if ((tx.date as string).startsWith(thisYear)) {
      depositByAccount.set(tx.account_id, (depositByAccount.get(tx.account_id) ?? 0) + amount)
    }

    if (acc) {
      const entry = yearlyMap.get(year) ?? { me: 0, spouse: 0 }
      if (acc.owner === 'spouse') entry.spouse += amount
      else entry.me += amount
      yearlyMap.set(year, entry)
    }
  }

  const yearlyData: YearData[] = Array.from(yearlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, { me, spouse }]) => ({ year, me, spouse, total: me + spouse }))

  // 계좌별 평가금액
  const valueByAccount = new Map<string, number>()
  for (const h of holdings) {
    valueByAccount.set(h.account_id, (valueByAccount.get(h.account_id) ?? 0) + (h.market_value_krw ?? h.total_cost_krw))
  }

  function buildPersonStats(owner: 'me' | 'spouse', label: string): PersonStats {
    const ownerAccounts = accounts.filter((a: any) => a.owner === owner)
    const pensionDeposit = ownerAccounts
      .filter((a: any) => a.type === 'pension')
      .reduce((s: number, a: any) => s + (depositByAccount.get(a.id) ?? 0), 0)
    const irpDeposit = ownerAccounts
      .filter((a: any) => a.type === 'irp')
      .reduce((s: number, a: any) => s + (depositByAccount.get(a.id) ?? 0), 0)
    const totalContrib = pensionDeposit + irpDeposit
    const holdingValue = ownerAccounts
      .reduce((s: number, a: any) => s + (valueByAccount.get(a.id) ?? 0), 0)
    return {
      owner, label,
      pensionDeposit, irpDeposit, totalContrib, holdingValue,
      accounts: ownerAccounts,
      holdings: holdings.filter(h => ownerAccounts.some((a: any) => a.id === h.account_id)),
    }
  }

  const me = buildPersonStats('me', '나')
  const spouse = buildPersonStats('spouse', '아내')

  // 부부 합산
  const meDeduct = calcDeductible(me.pensionDeposit, me.irpDeposit)
  const spouseDeduct = calcDeductible(spouse.pensionDeposit, spouse.irpDeposit)
  const totalDeductible = meDeduct.total + spouseDeduct.total
  const totalTaxCredit = Math.round(totalDeductible * 0.165)
  const totalContrib = me.totalContrib + spouse.totalContrib

  const persons = [me, spouse]

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-[#34322b]">연금 현황</h1>
            <p className="text-xs text-[#9c9484] mt-0.5">{thisYear}년 기준</p>
          </div>
        </div>

        {/* 부부 합산 요약 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
            <p className="text-xs text-[#9c9484]">부부 합산 납입</p>
            <p className="text-xl font-bold text-[#34322b] mt-1">{fmtKrw(totalContrib)}</p>
            <p className="text-[10px] text-[#b5aa98] mt-0.5">최대 {fmtKrw(PENSION_MAX_CONTRIB * 2)}</p>
          </div>
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
            <p className="text-xs text-[#9c9484]">부부 합산 세액공제</p>
            <p className="text-xl font-bold text-[#34322b] mt-1">{fmtKrw(totalDeductible)}</p>
            <p className="text-[10px] text-[#b5aa98] mt-0.5">한도 {fmtKrw(TOTAL_DEDUCT_LIMIT * 2)}</p>
          </div>
          <div className="bg-[#e8f4ee] border border-[#c5dece] rounded-2xl p-4">
            <p className="text-xs text-[#1c6b4a]">예상 절세액 (부부)</p>
            <p className="text-xl font-bold text-[#1c6b4a] mt-1">{fmtKrw(totalTaxCredit)}</p>
            <p className="text-[10px] text-[#3d9970] mt-0.5">16.5% 기준</p>
          </div>
        </div>

        {/* 연도별 납입 추이 차트 */}
        {yearlyData.length > 0 && (
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#34322b]">연도별 납입 추이</h2>
              <div className="text-right">
                <p className="text-xs text-[#9c9484]">누계 합산</p>
                <p className="text-sm font-bold text-[#34322b]">
                  {fmtKrw(yearlyData.reduce((s, d) => s + d.total, 0))}
                </p>
              </div>
            </div>
            <YearlyChart data={yearlyData} thisYear={thisYear} />
          </div>
        )}

        {/* 인별 세액공제 현황 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {persons.map(p => {
            const deduct = calcDeductible(p.pensionDeposit, p.irpDeposit)
            const taxCredit = Math.round(deduct.total * 0.165)
            const pensionDone = p.pensionDeposit >= PENSION_DEDUCT_LIMIT
            const irpDone = p.irpDeposit >= (TOTAL_DEDUCT_LIMIT - PENSION_DEDUCT_LIMIT)
            const totalDone = deduct.total >= TOTAL_DEDUCT_LIMIT
            const isSpouse = p.owner === 'spouse'

            return (
              <div key={p.owner} className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isSpouse ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>{p.label}</span>
                  <span className="text-sm font-bold text-[#34322b]">세액공제 현황</span>
                </div>

                {p.accounts.length === 0 ? (
                  <p className="text-xs text-[#b5aa98] text-center py-4">계좌 없음</p>
                ) : (
                  <div className="space-y-4">
                    {/* 연금저축 */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#34322b]">연금저축</span>
                          <StatusChip done={pensionDone} />
                        </div>
                        <span className="text-[#34322b] font-semibold">
                          {fmtKrw(p.pensionDeposit)}
                          <span className="text-[#9c9484] font-normal"> / {fmtKrw(PENSION_DEDUCT_LIMIT)}</span>
                        </span>
                      </div>
                      <ProgressBar value={p.pensionDeposit} max={PENSION_DEDUCT_LIMIT} color={isSpouse ? '#6b3fa0' : '#1c6b4a'} />
                      {!pensionDone && (
                        <p className="text-[10px] text-[#b5aa98] mt-1">
                          잔여 {fmtKrw(PENSION_DEDUCT_LIMIT - p.pensionDeposit)}
                        </p>
                      )}
                    </div>

                    {/* IRP */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#34322b]">IRP</span>
                          <StatusChip done={irpDone} />
                        </div>
                        <span className="text-[#34322b] font-semibold">
                          {fmtKrw(p.irpDeposit)}
                          <span className="text-[#9c9484] font-normal"> / {fmtKrw(TOTAL_DEDUCT_LIMIT - PENSION_DEDUCT_LIMIT)}</span>
                        </span>
                      </div>
                      <ProgressBar value={p.irpDeposit} max={TOTAL_DEDUCT_LIMIT - PENSION_DEDUCT_LIMIT} color={isSpouse ? '#6b3fa0' : '#1c6b4a'} />
                      {!irpDone && (
                        <p className="text-[10px] text-[#b5aa98] mt-1">
                          잔여 {fmtKrw((TOTAL_DEDUCT_LIMIT - PENSION_DEDUCT_LIMIT) - p.irpDeposit)}
                        </p>
                      )}
                    </div>

                    {/* 합산 세액공제 */}
                    <div className="pt-2 border-t border-[#f0ead8]">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#34322b] font-medium">합산 세액공제</span>
                          <StatusChip done={totalDone} />
                        </div>
                        <span className="text-[#34322b] font-semibold">
                          {fmtKrw(deduct.total)}
                          <span className="text-[#9c9484] font-normal"> / {fmtKrw(TOTAL_DEDUCT_LIMIT)}</span>
                        </span>
                      </div>
                      <ProgressBar value={deduct.total} max={TOTAL_DEDUCT_LIMIT} color={isSpouse ? '#6b3fa0' : '#1c6b4a'} />
                    </div>

                    {/* 절세액 + 최대납입 */}
                    <div className={`rounded-xl px-4 py-3 flex justify-between items-center ${
                      isSpouse ? 'bg-purple-50 border border-purple-100' : 'bg-emerald-50 border border-emerald-100'
                    }`}>
                      <div>
                        <p className={`text-xs font-semibold ${isSpouse ? 'text-purple-700' : 'text-[#1c6b4a]'}`}>예상 절세액</p>
                        <p className="text-[10px] text-[#b5aa98] mt-0.5">
                          납입 {fmtKrw(p.totalContrib)} / 최대 {fmtKrw(PENSION_MAX_CONTRIB)}
                        </p>
                      </div>
                      <p className={`text-xl font-bold ${isSpouse ? 'text-purple-700' : 'text-[#1c6b4a]'}`}>
                        {taxCredit > 0 ? fmtKrw(taxCredit) : '-'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 계좌별 보유 현황 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e3d9c4] bg-[#f4eee0]">
            <h2 className="text-sm font-semibold text-[#34322b]">계좌별 보유 현황</h2>
          </div>
          {accounts.map((acc: any) => {
            const deposit = depositByAccount.get(acc.id) ?? 0
            const holdingVal = valueByAccount.get(acc.id) ?? 0
            const accHoldings = holdings.filter(h => h.account_id === acc.id)
            const isSpouse = acc.owner === 'spouse'
            return (
              <div key={acc.id} className="border-b border-[#f0ead8] last:border-0 px-4 py-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    acc.type === 'irp'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {acc.type === 'irp' ? 'IRP' : '연금저축'}
                  </span>
                  <span className="text-sm font-semibold text-[#34322b]">{acc.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    isSpouse ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isSpouse ? '아내' : '나'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                  <div>
                    <p className="text-[#9c9484]">올해 납입</p>
                    <p className="font-semibold text-[#34322b] mt-0.5">{deposit > 0 ? fmtKrw(deposit) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[#9c9484]">평가금액</p>
                    <p className="font-semibold text-[#34322b] mt-0.5">{holdingVal > 0 ? fmtKrw(holdingVal) : '-'}</p>
                  </div>
                </div>
                {accHoldings.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {accHoldings.map(h => (
                      <div key={`${h.account_id}:${h.asset_id}`} className="flex justify-between text-[10px]">
                        <span className="text-[#9c9484]">{h.name}</span>
                        <span className="text-[#34322b] font-medium">
                          {fmtKrw(h.market_value_krw ?? h.total_cost_krw)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[10px] text-[#b5aa98] mt-3 text-center">
          * 16.5%는 총급여 5,500만원 이하 기준. 초과 시 13.2% 적용. 정확한 금액은 세무사에게 확인하세요.
        </p>
      </div>
    </AppShell>
  )
}
