import Link from 'next/link'
import { isAccountActiveAtMonth, latestSnapshotsAtMonth, latestYearContributions } from '@/lib/calc/account-snapshots'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { Account, AccountMonthlySnapshot } from '@/lib/types'

import { calcDeductible, TOTAL_DEDUCT_LIMIT } from '@/lib/calc/pension'

interface YearData {
  year: string
  me: number
  spouse: number
  total: number
}

interface PersonStats {
  owner: 'me' | 'spouse'
  label: string
  pensionContribution: number
  irpContribution: number
  totalContribution: number
  evaluationAmount: number
}

export default async function PensionPage() {
  const { supabase, userId } = await getHouseholdContext()
  const now = new Date()
  const currentYear = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(now)
  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul',
  }).format(now)

  const { data: accountRows } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .in('type', ['pension', 'irp'])
    .order('sort_order')
    .order('created_at').throwOnError()

  const accounts = (accountRows ?? []) as Account[]
  if (accounts.length === 0) {
    return (
      <>
        <div className="page-container max-w-[1240px]">
          <h1 className="page-title">연금 현황</h1>
          <div className="app-card mt-5 p-10 text-center">
            <p className="text-sm text-[var(--color-muted)]">연금저축·IRP 계좌가 없습니다.</p>
            <Link href="/net-worth" className="mt-3 inline-block text-xs font-semibold text-[var(--color-primary)] hover:underline">밸런스 시트에서 계좌 추가하기 →</Link>
          </div>
        </div>
      </>
    )
  }

  const accountIds = accounts.map(account => account.id)
  const { data: snapshotRows } = await supabase
    .from('account_monthly_snapshots')
    .select('*')
    .eq('user_id', userId)
    .in('account_id', accountIds)
    .lte('month', currentMonth)
    .order('month').throwOnError()

  const snapshots = (snapshotRows ?? []) as AccountMonthlySnapshot[]
  const accountMap = new Map(accounts.map(account => [account.id, account]))
  const currentContributions = latestYearContributions(accounts, snapshots, currentYear, currentMonth)
  const latestEvaluations = latestSnapshotsAtMonth(snapshots, currentMonth)

  function buildPerson(owner: 'me' | 'spouse', label: string): PersonStats {
    const ownerAccounts = accounts.filter(account => account.owner === owner)
    const pensionContribution = ownerAccounts
      .filter(account => account.type === 'pension')
      .reduce((sum, account) => sum + Number(currentContributions.get(account.id)?.ytd_contribution ?? 0), 0)
    const irpContribution = ownerAccounts
      .filter(account => account.type === 'irp')
      .reduce((sum, account) => sum + Number(currentContributions.get(account.id)?.ytd_contribution ?? 0), 0)
    const evaluationAmount = ownerAccounts
      .filter(account => isAccountActiveAtMonth(account, currentMonth))
      .reduce((sum, account) => sum + Number(latestEvaluations.get(account.id)?.evaluation_amount ?? 0), 0)
    return { owner, label, pensionContribution, irpContribution, totalContribution: pensionContribution + irpContribution, evaluationAmount }
  }

  const persons = [buildPerson('me', '나'), buildPerson('spouse', '아내')]
  const totalContribution = persons.reduce((sum, person) => sum + person.totalContribution, 0)
  const totalEvaluation = persons.reduce((sum, person) => sum + person.evaluationAmount, 0)
  const totalDeductible = persons.reduce((sum, person) => sum + calcDeductible(person.pensionContribution, person.irpContribution).total, 0)
  const estimatedTaxCredit = Math.round(totalDeductible * 0.165)
  const yearlyData = buildYearlyData(accounts, snapshots, accountMap, currentMonth)

  return (
    <>
      <div className="page-container max-w-[1240px]">
        <header className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="page-eyebrow">Pension progress</p>
            <h1 className="page-title">연금 현황</h1>
            <p className="page-subtitle">월말에 입력한 올해 누적 납입액으로 달성률을 계산합니다.</p>
          </div>
          <Link href={`/budget?month=${currentMonth}`} className="inline-flex min-h-10 w-fit items-center rounded-lg bg-[var(--color-primary)] px-4 text-xs font-semibold text-white hover:bg-[var(--color-primary-strong)]">
            {formatMonth(currentMonth)} 기록하기
          </Link>
        </header>

        <section className="metric-strip mb-4 grid grid-cols-1 sm:grid-cols-3">
          <SummaryCard label="부부 누적 납입" value={totalContribution} sub={`목표 ${fmtKrw(TOTAL_DEDUCT_LIMIT * 2)}`} />
          <SummaryCard label="연금계좌 평가금액" value={totalEvaluation} sub="최근 월말 기록 합계" />
          <SummaryCard label="예상 세액공제" value={estimatedTaxCredit} sub="16.5% 단순 적용" accent />
        </section>

        <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {persons.map(person => <PersonCard key={person.owner} person={person} />)}
        </section>

        <div className={`grid gap-4 ${yearlyData.length > 1 ? 'xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}`}>
          {yearlyData.length > 1 ? (
            <section className="app-card p-5">
              <div className="mb-5">
                <h2 className="text-base font-bold text-[var(--color-ink)]">연도별 납입 기록</h2>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">각 연도의 마지막 누적 납입액을 비교합니다.</p>
              </div>
              <YearlyChart data={yearlyData} currentYear={currentYear} />
            </section>
          ) : null}

          <section className="app-card overflow-hidden">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-canvas)]/65 px-5 py-3.5">
              <h2 className="text-base font-bold text-[var(--color-ink)]">계좌별 최근 기록</h2>
            </div>
            {accounts.map(account => {
              const latest = latestEvaluations.get(account.id)
              const contribution = currentContributions.get(account.id)
              const active = isAccountActiveAtMonth(account, currentMonth)
              return (
                <div key={account.id} className="grid grid-cols-1 gap-3 border-b border-[var(--color-border)] px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${account.owner === 'spouse' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {account.owner === 'spouse' ? '아내' : '나'}
                      </span>
                      <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{account.name}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      {account.type === 'irp' ? 'IRP' : '연금저축'}{active ? '' : ' · 비활성 계좌'}{latest ? ` · ${formatMonth(latest.month)} 평가` : ' · 평가 기록 없음'}
                    </p>
                  </div>
                  <ValueCell label="현재 평가금액" value={active ? Number(latest?.evaluation_amount ?? 0) : 0} />
                  <ValueCell label={`${currentYear}년 누적 납입`} value={Number(contribution?.ytd_contribution ?? 0)} />
                </div>
              )
            })}
          </section>
        </div>

        <p className="mt-3 text-center text-[11px] text-[var(--color-subtle)]">세액공제는 총급여와 개인 상황에 따라 달라질 수 있습니다. 화면의 금액은 관리용 참고치입니다.</p>
      </div>
    </>
  )
}

function SummaryCard({ label, value, sub, accent = false }: { label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <article className={`metric-cell p-4 ${accent ? 'bg-[var(--color-accent-soft)]' : ''}`}>
      <p className={`text-xs font-semibold ${accent ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]'}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-[-0.025em] tabular-nums lg:text-2xl ${accent ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink)]'}`}>{fmtKrw(value)}</p>
      <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{sub}</p>
    </article>
  )
}

function PersonCard({ person }: { person: PersonStats }) {
  const deductible = calcDeductible(person.pensionContribution, person.irpContribution)
  const percent = Math.min(deductible.total / TOTAL_DEDUCT_LIMIT * 100, 100)
  const isSpouse = person.owner === 'spouse'
  const color = isSpouse ? '#6b3fa0' : '#3f7fc3'
  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isSpouse ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{person.label}</span>
          <h2 className="mt-3 text-base font-bold text-[var(--color-ink)]">연금 납입 달성률</h2>
        </div>
        <strong className="text-2xl tabular-nums text-[var(--color-ink)]">{Math.round(percent)}%</strong>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 text-xs">
        <strong className="text-base tabular-nums text-[var(--color-ink)]">{fmtKrw(person.totalContribution)}</strong>
        <span className="text-[var(--color-muted)]">목표 {fmtKrw(TOTAL_DEDUCT_LIMIT)}</span>
      </div>
      <ProgressBar value={percent} color={color} />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="연금저축" value={person.pensionContribution} />
        <MiniStat label="IRP" value={person.irpContribution} />
        <MiniStat label="평가금액" value={person.evaluationAmount} />
      </div>
      <p className="mt-4 text-[11px] text-[var(--color-muted)]">목표까지 {fmtKrw(Math.max(TOTAL_DEDUCT_LIMIT - deductible.total, 0))} · 예상 절세 {fmtKrw(Math.round(deductible.total * 0.165))}</p>
    </article>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-[var(--color-canvas)]/75 px-3 py-2.5"><p className="text-[10px] text-[var(--color-muted)]">{label}</p><p className="mt-1 truncate text-xs font-semibold tabular-nums text-[var(--color-ink)]">{compactKrw(value)}</p></div>
}

function ValueCell({ label, value }: { label: string; value: number }) {
  return <div className="sm:text-right"><p className="text-[10px] text-[var(--color-muted)]">{label}</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--color-ink)]">{value > 0 ? fmtKrw(value) : '-'}</p></div>
}

function YearlyChart({ data, currentYear }: { data: YearData[]; currentYear: string }) {
  const max = Math.max(...data.map(point => point.total), 1)
  return (
    <div>
      <div className="flex h-36 items-end gap-4 border-b border-[var(--color-border)] px-2">
        {data.map(point => {
          const height = Math.max(point.total / max * 100, 3)
          const mePercent = point.total > 0 ? point.me / point.total * 100 : 0
          return (
            <div key={point.year} className="flex h-full flex-1 flex-col justify-end">
              <div className="mb-1 text-center text-[10px] font-semibold tabular-nums text-[var(--color-muted)]">{compactKrw(point.total)}</div>
              <div className="mx-auto flex w-full max-w-20 flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${height}%` }}>
                {point.spouse > 0 ? <div className="bg-[#6b3fa0]" style={{ height: `${100 - mePercent}%` }} /> : null}
                {point.me > 0 ? <div className="bg-[#3f7fc3]" style={{ height: `${mePercent}%` }} /> : null}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-4 px-2">{data.map(point => <div key={point.year} className={`flex-1 text-center text-[10px] ${point.year === currentYear ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-subtle)]'}`}>{point.year}년</div>)}</div>
    </div>
  )
}

function buildYearlyData(accounts: Account[], snapshots: AccountMonthlySnapshot[], accountMap: Map<string, Account>, cutoffMonth: string) {
  const years = [...new Set(snapshots.filter(snapshot => snapshot.month <= cutoffMonth).map(snapshot => snapshot.month.slice(0, 4)))].sort()
  return years.map(year => {
    const latest = latestYearContributions(accounts, snapshots, year, cutoffMonth)
    let me = 0
    let spouse = 0
    for (const [accountId, snapshot] of latest) {
      const account = accountMap.get(accountId)
      if (account?.owner === 'spouse') spouse += Number(snapshot.ytd_contribution)
      else me += Number(snapshot.ytd_contribution)
    }
    return { year, me, spouse, total: me + spouse }
  }).filter(point => point.total > 0)
}


function ProgressBar({ value, color }: { value: number; color: string }) {
  return <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--color-border)]/75"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(value, 100))}%`, backgroundColor: color }} /></div>
}

function fmtKrw(value: number) {
  return `₩${new Intl.NumberFormat('ko-KR').format(Math.round(value))}`
}

function compactKrw(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1).replace('.0', '')}억`
  if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

function formatMonth(month: string) {
  const [year, value] = month.split('-')
  return `${year}년 ${Number(value)}월`
}
