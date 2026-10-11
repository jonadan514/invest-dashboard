import type { Account, AccountMonthlySnapshot } from '@/lib/types'

export interface AccountTotalPoint {
  month: string
  amount: number
}

export function latestSnapshotsAtMonth(
  snapshots: AccountMonthlySnapshot[],
  month: string,
) {
  const latest = new Map<string, AccountMonthlySnapshot>()
  for (const snapshot of snapshots) {
    if (snapshot.month > month) continue
    const previous = latest.get(snapshot.account_id)
    if (!previous || previous.month <= snapshot.month) latest.set(snapshot.account_id, snapshot)
  }
  return latest
}

export function buildAccountTotalTrend(
  accounts: Account[],
  snapshots: AccountMonthlySnapshot[],
): AccountTotalPoint[] {
  const activeAccountIds = new Set(accounts.filter(account => account.is_active).map(account => account.id))
  const byMonth = new Map<string, AccountMonthlySnapshot[]>()
  for (const snapshot of snapshots) {
    if (!activeAccountIds.has(snapshot.account_id)) continue
    const rows = byMonth.get(snapshot.month) ?? []
    rows.push(snapshot)
    byMonth.set(snapshot.month, rows)
  }

  const latestAmounts = new Map<string, number>()
  return [...byMonth.keys()].sort().map(month => {
    for (const snapshot of byMonth.get(month) ?? []) {
      latestAmounts.set(snapshot.account_id, Number(snapshot.evaluation_amount))
    }
    return {
      month,
      amount: [...latestAmounts.values()].reduce((sum, amount) => sum + amount, 0),
    }
  })
}

export function latestYearContributions(
  accounts: Account[],
  snapshots: AccountMonthlySnapshot[],
  year: string,
) {
  const pensionAccounts = new Map(
    accounts
      .filter(account => account.is_active && (account.type === 'pension' || account.type === 'irp'))
      .map(account => [account.id, account]),
  )
  const latest = new Map<string, AccountMonthlySnapshot>()

  for (const snapshot of snapshots) {
    if (!snapshot.month.startsWith(`${year}-`) || !pensionAccounts.has(snapshot.account_id)) continue
    const previous = latest.get(snapshot.account_id)
    if (!previous || previous.month <= snapshot.month) latest.set(snapshot.account_id, snapshot)
  }

  return latest
}
