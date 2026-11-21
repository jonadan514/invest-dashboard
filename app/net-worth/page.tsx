import { getHouseholdContext } from '@/lib/supabase/server'
import { buildAccountTotalTrend, isAccountActiveAtMonth, latestSnapshotsAtMonth } from '@/lib/calc/account-snapshots'
import type { Account, AccountMonthlySnapshot, NetWorthItem, NetWorthSnapshot } from '@/lib/types'
import NetWorthManager from './NetWorthManager'
import { kstMonth } from '@/lib/labels'
import { trySyncMortgageSchedule } from '@/lib/mortgage-sync'

export const metadata = { title: '밸런스 시트' }

function monthOptions(selected: string) {
  const [year, month] = selected.split('-').map(Number)
  return Array.from({ length: 25 }, (_, index) => {
    const date = new Date(year, month - 1 - index, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}

export default async function NetWorthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>
}) {
  const params = await searchParams
  const requested = params.month
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : kstMonth()
  const { supabase, userId } = await getHouseholdContext()
  await trySyncMortgageSchedule(supabase, userId)

  const [
    { data: itemRows },
    { data: snapshotRows },
    { data: accountRows },
    { data: accountSnapshotRows },
    { data: historyRows },
  ] = await Promise.all([
    supabase.from('net_worth_items').select('*').eq('user_id', userId).order('kind').order('sort_order').order('created_at').throwOnError(),
    supabase.from('net_worth_snapshots').select('*').eq('user_id', userId).lte('month', month).order('month').throwOnError(),
    supabase.from('accounts').select('*').eq('user_id', userId).in('type', ['cash', 'mmf', 'general', 'pension', 'irp', 'isa', 'crypto']).order('sort_order').throwOnError(),
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).lte('month', month).order('month').throwOnError(),
    // 항목 관리의 잔액 이력은 기준 월과 상관없이 전체를 보여 준다.
    supabase.from('net_worth_snapshots').select('item_id, month, amount, source').eq('user_id', userId).order('month', { ascending: false }).throwOnError(),
  ])

  const items = (itemRows ?? []) as NetWorthItem[]
  const snapshots = (snapshotRows ?? []) as NetWorthSnapshot[]
  const accounts = (accountRows ?? []) as Account[]
  const accountSnapshots = (accountSnapshotRows ?? []) as AccountMonthlySnapshot[]
  const accountTotals = buildAccountTotalTrend(accounts, accountSnapshots, month)
  const activeAccounts = accounts.filter(account => isAccountActiveAtMonth(account, month))
  const latestAccountSnapshots = latestSnapshotsAtMonth(accountSnapshots, month)
  const latestAccountTotal = [...accountTotals].reverse().find(point => point.month <= month)
  const portfolioValue = latestAccountTotal?.amount ?? 0
  const activeItems = items.filter(item => item.is_active)
  const inactiveItems = items.filter(item => !item.is_active)
  const exactSnapshots = snapshots.filter(snapshot => snapshot.month === month)
  const latestAmounts: Record<string, number> = {}
  const latestMonths: Record<string, string> = {}
  for (const snapshot of snapshots) {
    latestAmounts[snapshot.item_id] = Number(snapshot.amount)
    latestMonths[snapshot.item_id] = snapshot.month
  }
  const history: Record<string, { month: string; amount: number; source: string }[]> = {}
  for (const row of historyRows ?? []) (history[row.item_id] ??= []).push({ month: row.month, amount: Number(row.amount), source: row.source })


  return (
    <>
      <div className="page-container max-w-[1240px]">
        <div className="mb-5">
          <h1 className="page-title">밸런스 시트</h1>
        </div>

        <NetWorthManager
          key={month}
          month={month}
          months={monthOptions(month)}
          activeItems={activeItems}
          inactiveItems={inactiveItems}
          accounts={activeAccounts}
          latestAccountSnapshots={Object.fromEntries([...latestAccountSnapshots.entries()].map(([accountId, snapshot]) => [accountId, {
            amount: Number(snapshot.evaluation_amount),
            month: snapshot.month,
          }]))}
          initialAmounts={latestAmounts}
          latestMonths={latestMonths}
          history={history}
          currentMonth={kstMonth()}
          initialView={params.view === 'settings' ? 'settings' : 'record'}
          hasExactSnapshot={exactSnapshots.length > 0 || accountSnapshots.some(snapshot => snapshot.month === month)}
          investmentValue={portfolioValue}
          investmentRecordedMonth={latestAccountTotal?.month ?? null}
        />
      </div>
    </>
  )
}

