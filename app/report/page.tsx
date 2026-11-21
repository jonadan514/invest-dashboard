import Link from 'next/link'
import { buildAccountTotalTrend, latestYearContributions } from '@/lib/calc/account-snapshots'
import { annualNetWorth, reportYears } from '@/lib/calc/annual-report'
import { DEFAULT_FINANCIAL_PLAN } from '@/lib/calc/budget'
import { buildTrend, netWorthChangeDrivers, type ChangeDriver } from '@/lib/calc/home-insights'
import { calcDeductible, PENSION_CREDIT_RATE, TOTAL_DEDUCT_LIMIT } from '@/lib/calc/pension'
import { averageSavingsRate, buildSavingsSeries } from '@/lib/calc/savings'
import { compactKrw, formatMonth, krw, signedCompactKrw, signedWonShort, wonShort } from '@/lib/labels'
import { getHouseholdContext } from '@/lib/supabase/server'
import type {
  Account,
  AccountMonthlySnapshot,
  ChildGiftDeposit,
  ChildProfile,
  FinancialPlanSettingsRow,
  HouseholdGoal,
  HouseholdSettings,
  MonthlyBudget,
  NetWorthItem,
  NetWorthSnapshot,
} from '@/lib/types'
import { Stat, StatStrip, toneOf } from '@/components/Stat'
import PrintButton from './PrintButton'

export const metadata = { title: '연간 리포트' }

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: requestedYear } = await searchParams
  const { supabase, userId } = await getHouseholdContext()
  const now = new Date()
  const currentMonth = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul' }).format(now)

  const [
    { data: accountRows },
    { data: accountSnapshotRows },
    { data: itemRows },
    { data: itemSnapshotRows },
    { data: budgetRows },
    { data: planRow },
    { data: settingsRow },
    { data: goalRows },
    { data: childRows },
    { data: giftRows },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('sort_order').throwOnError(),
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).lte('month', currentMonth).order('month').throwOnError(),
    supabase.from('net_worth_items').select('*').eq('user_id', userId).order('sort_order').throwOnError(),
    supabase.from('net_worth_snapshots').select('*').eq('user_id', userId).lte('month', currentMonth).order('month').throwOnError(),
    supabase.from('monthly_budgets').select('*').eq('user_id', userId).lte('month', currentMonth).order('month').throwOnError(),
    supabase.from('financial_plan_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('household_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('household_goals').select('*').eq('user_id', userId).order('sort_order').throwOnError(),
    supabase.from('children').select('*').eq('user_id', userId).throwOnError(),
    supabase.from('child_gift_deposits').select('*').eq('user_id', userId).order('gift_date').throwOnError(),
  ])

  const accounts = (accountRows ?? []) as Account[]
  const accountSnapshots = (accountSnapshotRows ?? []) as AccountMonthlySnapshot[]
  const items = (itemRows ?? []) as NetWorthItem[]
  const itemSnapshots = (itemSnapshotRows ?? []) as NetWorthSnapshot[]
  const budgets = (budgetRows ?? []) as MonthlyBudget[]
  const plan = planRow as FinancialPlanSettingsRow | null
  const settings = settingsRow as HouseholdSettings | null
  const goals = (goalRows ?? []) as HouseholdGoal[]
  const children = (childRows ?? []) as ChildProfile[]
  const gifts = (giftRows ?? []) as ChildGiftDeposit[]

  const trend = buildTrend(items, itemSnapshots, buildAccountTotalTrend(accounts, accountSnapshots, currentMonth), currentMonth)
  const years = reportYears(trend, currentMonth)
  const year = requestedYear && years.includes(requestedYear) ? requestedYear : years[0] ?? currentMonth.slice(0, 4)
  const summary = annualNetWorth(trend, year, currentMonth)

  const drivers = summary.start && summary.end && summary.start.month !== summary.end.month
    ? netWorthChangeDrivers({ accounts, accountSnapshots, items, itemSnapshots, fromMonth: summary.start.month, toMonth: summary.end.month })
    : []

  const yearBudgets = budgets.filter(budget => budget.month.startsWith(`${year}-`)).sort((a, b) => a.month.localeCompare(b.month))
  const monthlyIncome = Number(settings?.monthly_income ?? 0)
  const savings = buildSavingsSeries(yearBudgets, monthlyIncome, Number(plan?.monthly_fixed_cost ?? DEFAULT_FINANCIAL_PLAN.monthlyFixedCost))
  const totalSaving = savings.reduce((sum, point) => sum + point.saving, 0)
  const savingsAverage = averageSavingsRate(savings, 12)
  const principalRepaid = yearBudgets.reduce((sum, budget) => sum + Number(budget.mortgage_principal) + Number(budget.mortgage_extra_principal), 0)
  const bonusTotal = yearBudgets.reduce((sum, budget) => sum + Number(budget.bonus_total), 0)
  const memos = yearBudgets.filter(budget => budget.memo?.trim())

  const pensionAccounts = new Map(accounts.filter(account => account.type === 'pension' || account.type === 'irp').map(account => [account.id, account]))
  const contributionCutoff = `${year}-12` < currentMonth ? `${year}-12` : currentMonth
  const contributions = latestYearContributions(accounts, accountSnapshots, year, contributionCutoff)
  const pensionByOwner = (['me', 'spouse'] as const).map(owner => {
    let pension = 0
    let irp = 0
    for (const [accountId, snapshot] of contributions) {
      const account = pensionAccounts.get(accountId)
      if (account?.owner !== owner) continue
      if (account.type === 'pension') pension += Number(snapshot.ytd_contribution)
      else irp += Number(snapshot.ytd_contribution)
    }
    const deductible = calcDeductible(pension, irp).total
    return { label: owner === 'me' ? '나' : '아내', total: pension + irp, deductible }
  })
  const pensionDeductible = pensionByOwner.reduce((sum, person) => sum + person.deductible, 0)

  const achievedGoals = goals.filter(goal => goal.achieved_at?.startsWith(year))
  const childNames = new Map(children.map(child => [child.id, child.name]))
  const yearGifts = gifts.filter(gift => gift.gift_date.startsWith(`${year}-`))
  const giftsByChild = [...yearGifts.reduce((map, gift) => {
    const name = childNames.get(gift.child_id) ?? '자녀'
    map.set(name, (map.get(name) ?? 0) + Number(gift.amount))
    return map
  }, new Map<string, number>())]

  const change = summary.start && summary.end ? summary.end.netWorth - summary.start.netWorth : null
  const changeRate = change !== null && summary.start && summary.start.netWorth > 0 ? change / summary.start.netWorth * 100 : null

  return (
    <div className="page-container max-w-[1240px] print:max-w-none print:p-0">
      <header className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="page-title">{year}년 가족 자산 결산</h1>
          <p className="page-subtitle">
            {summary.end ? `${formatMonth(summary.end.month)} 기록까지 반영` : '이 해의 기록이 없어요'}
            {summary.end && summary.inProgress ? ' · 아직 한 해가 끝나지 않아 진행 중인 결산이에요' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {years.length > 1 ? (
            <nav aria-label="연도 선택" className="flex gap-1">
              {years.map(item => (
                <Link key={item} href={`/report?year=${item}`} aria-current={item === year ? 'page' : undefined} className={`rounded-sm border px-2.5 py-2 text-[12.5px] font-semibold ${item === year ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted)]'}`}>
                  {item}
                </Link>
              ))}
            </nav>
          ) : null}
          <PrintButton />
        </div>
      </header>

      {!summary.end ? (
        <div className="app-card p-10 text-center text-sm text-[var(--color-muted)]">밸런스 시트나 월간 기록을 저장하면 결산이 만들어져요.</div>
      ) : (
        <div className="space-y-4">
          <StatStrip columns={4} label="순자산 요약">
            <Stat label={startLabel(summary.start?.month ?? null, year)} value={wonShort(summary.start?.netWorth ?? 0)} exact={krw(summary.start?.netWorth ?? 0)} tone="neutral" />
            <Stat label={`${Number(summary.end.month.slice(5))}월 순자산`} value={wonShort(summary.end.netWorth)} exact={krw(summary.end.netWorth)} tone="net" />
            <Stat label="한 해 변화" value={change === null ? '—' : signedWonShort(change)} exact={change === null ? undefined : krw(change)} tone={toneOf(change)} />
            <Stat label="증가율" value={changeRate === null ? '—' : `${changeRate > 0 ? '+' : ''}${changeRate.toFixed(1)}%`} tone={toneOf(changeRate)} />
          </StatStrip>

          <section className="app-card p-5 print:break-inside-avoid">
            <h2 className="text-base font-bold text-[var(--color-ink)]">월별 순자산 변화</h2>
            <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">직전 기록 달과 비교한 순자산 증감이에요.</p>
            <MonthlyChanges months={summary.months} />
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="app-card p-5 print:break-inside-avoid">
              <h2 className="text-base font-bold text-[var(--color-ink)]">올해 순자산을 움직인 것</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
                {summary.start ? `${formatMonth(summary.start.month)} → ${formatMonth(summary.end.month)}` : ''} · 영향이 큰 순서
              </p>
              <DriverList drivers={drivers} />
            </section>

            <section className="app-card p-5 print:break-inside-avoid">
              <h2 className="text-base font-bold text-[var(--color-ink)]">저축과 상환</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">월간 기록 {yearBudgets.length}개월 기준</p>
              <dl className="mt-4 divide-y divide-[var(--color-border)] text-[12.5px]">
                <Row label="배분한 저축액 합계" value={krw(totalSaving)} />
                <Row label="평균 저축률" value={savingsAverage ? `${Math.round(savingsAverage.rate)}%` : monthlyIncome > 0 ? '—' : '설정에서 월 소득 입력 필요'} />
                <Row label="주담대 원금 상환(정기+추가)" value={krw(principalRepaid)} />
                <Row label="성과급·일시 수입" value={bonusTotal > 0 ? krw(bonusTotal) : '없음'} />
              </dl>
            </section>

            <section className="app-card p-5 print:break-inside-avoid">
              <h2 className="text-base font-bold text-[var(--color-ink)]">연금 납입과 세액공제</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">공제 한도 1인 {compactKrw(TOTAL_DEDUCT_LIMIT)} 기준</p>
              <dl className="mt-4 divide-y divide-[var(--color-border)] text-[12.5px]">
                {pensionByOwner.map(person => (
                  <Row key={person.label} label={`${person.label} 납입`} value={`${krw(person.total)} (${Math.round(person.deductible / TOTAL_DEDUCT_LIMIT * 100)}%)`} />
                ))}
                <Row label="예상 세액공제(13.2%)" value={`약 ${compactKrw(pensionDeductible * PENSION_CREDIT_RATE)}`} />
              </dl>
            </section>

            <section className="app-card p-5 print:break-inside-avoid">
              <h2 className="text-base font-bold text-[var(--color-ink)]">목표와 자녀</h2>
              <dl className="mt-4 divide-y divide-[var(--color-border)] text-[12.5px]">
                <Row label="올해 달성한 목표" value={achievedGoals.length > 0 ? achievedGoals.map(goal => goal.name).join(', ') : '없음'} />
                {giftsByChild.length > 0
                  ? giftsByChild.map(([name, amount]) => <Row key={name} label={`${name} 증여 입금`} value={krw(amount)} />)
                  : <Row label="자녀 증여 입금" value="없음" />}
              </dl>
            </section>
          </div>

          {memos.length > 0 ? (
            <section className="app-card p-5 print:break-inside-avoid">
              <h2 className="text-base font-bold text-[var(--color-ink)]">월별 메모</h2>
              <ul className="mt-3 space-y-2 text-[12.5px]">
                {memos.map(budget => (
                  <li key={budget.month} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
                    <span className="font-semibold text-[var(--color-muted)]">{Number(budget.month.slice(5))}월</span>
                    <span className="text-[var(--color-ink)]">{budget.memo}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-center text-[11.5px] text-[var(--color-subtle)]">월말에 직접 입력한 기록으로 만든 관리용 결산이에요. 세액공제·증여 금액은 참고치입니다.</p>
        </div>
      )}
    </div>
  )
}

function startLabel(month: string | null, year: string) {
  if (!month) return '기준 순자산'
  if (month < `${year}-01`) return `${Number(month.slice(5))}월 순자산(전년)`
  if (month === `${year}-01`) return '연초 순자산'
  return `${Number(month.slice(5))}월 순자산(첫 기록)`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-[var(--color-ink)]">{value}</dd>
    </div>
  )
}

function MonthlyChanges({ months }: { months: { month: string; netWorth: number; change: number | null }[] }) {
  const max = Math.max(...months.map(item => Math.abs(item.change ?? 0)), 1)
  return (
    <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12">
      {months.map(item => {
        const height = item.change === null ? 0 : Math.max(Math.abs(item.change) / max * 100, 3)
        return (
          <div key={item.month} className="flex flex-col items-center gap-1" title={`${formatMonth(item.month)} 순자산 ${krw(item.netWorth)}`}>
            <span className={`text-[11.5px] font-semibold tabular-nums ${item.change === null ? 'text-[var(--color-subtle)]' : item.change >= 0 ? 'text-[var(--color-positive-strong)]' : 'text-[var(--color-negative)]'}`}>
              {item.change === null ? '기준' : signedCompactKrw(item.change)}
            </span>
            <div className="flex h-20 w-full flex-col justify-end">
              <div className={`mx-auto w-full max-w-6 rounded-t-sm ${item.change !== null && item.change < 0 ? 'bg-[var(--color-negative)]' : 'bg-[var(--color-positive)]'}`} style={{ height: `${height}%` }} />
            </div>
            <span className="text-[11.5px] text-[var(--color-muted)]">{Number(item.month.slice(5))}월</span>
          </div>
        )
      })}
    </div>
  )
}

const SOURCE_LABEL: Record<ChangeDriver['source'], string> = { account: '계좌', asset: '자산', liability: '부채' }

function DriverList({ drivers }: { drivers: ChangeDriver[] }) {
  if (drivers.length === 0) return <p className="mt-4 text-[12.5px] text-[var(--color-muted)]">비교할 기록이 두 달 이상 필요해요.</p>
  const visible = drivers.slice(0, 8)
  const restChange = drivers.slice(8).reduce((sum, driver) => sum + driver.change, 0)
  return (
    <ul className="mt-4 divide-y divide-[var(--color-border)] text-[12.5px]">
      {visible.map(driver => (
        <li key={driver.key} className="flex items-center justify-between gap-3 py-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 rounded-sm bg-[var(--color-section)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--color-muted)]">{SOURCE_LABEL[driver.source]}</span>
            <span className="truncate text-[var(--color-ink)]">{driver.label}</span>
          </span>
          <span className={`font-semibold tabular-nums ${driver.change >= 0 ? 'text-[var(--color-positive-strong)]' : 'text-[var(--color-negative)]'}`}>{signedCompactKrw(driver.change)}</span>
        </li>
      ))}
      {drivers.length > 8 ? (
        <li className="flex items-center justify-between gap-3 py-2 text-[var(--color-muted)]">
          <span>그 외 {drivers.length - 8}개</span>
          <span className="tabular-nums">{signedCompactKrw(restChange)}</span>
        </li>
      ) : null}
    </ul>
  )
}
