import type { Account, AccountMonthlySnapshot } from '@/lib/types'

export interface AccountTotalPoint {
  month: string
  amount: number
}

// Activity is monthly: the last event in a month wins. Before the first event
// the account was active; legacy inactive accounts receive a closure on migration.
export function isAccountActiveAtMonth(account: Account, month: string) {
  if (account.activity_history?.length) {
    let active = true
    let latestMonth = ''
    for (const event of account.activity_history) {
      if (event.month <= month && event.month >= latestMonth) {
        active = event.active
        latestMonth = event.month
      }
    }
    return active
  }
  return account.inactive_from_month ? month < account.inactive_from_month : account.is_active
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
  cutoffMonth?: string,
): AccountTotalPoint[] {
  const accountMap = new Map(accounts.map(account => [account.id, account]))
  const byMonth = new Map<string, AccountMonthlySnapshot[]>()
  for (const snapshot of snapshots) {
    if (!accountMap.has(snapshot.account_id) || (cutoffMonth && snapshot.month > cutoffMonth)) continue
    const rows = byMonth.get(snapshot.month) ?? []
    rows.push(snapshot)
    byMonth.set(snapshot.month, rows)
  }

  // Emit status transitions even when no account has a snapshot that month.
  // Otherwise a carried-forward total would still include a closed account.
  const firstMonth = [...byMonth.keys()].sort()[0]
  for (const account of accounts) {
    const eventMonths = account.activity_history?.length
      ? account.activity_history.map(event => event.month)
      : account.inactive_from_month ? [account.inactive_from_month] : []
    for (const month of eventMonths) {
      if (firstMonth && month >= firstMonth && (!cutoffMonth || month <= cutoffMonth) && !byMonth.has(month)) {
        byMonth.set(month, [])
      }
    }
  }

  const latestAmounts = new Map<string, number>()
  return [...byMonth.keys()].sort().map(month => {
    for (const snapshot of byMonth.get(month) ?? []) {
      latestAmounts.set(snapshot.account_id, Number(snapshot.evaluation_amount))
    }
    return {
      month,
      amount: [...latestAmounts].reduce((sum, [accountId, amount]) =>
        sum + (isAccountActiveAtMonth(accountMap.get(accountId)!, month) ? amount : 0), 0),
    }
  })
}

export function latestYearContributions(
  accounts: Account[],
  snapshots: AccountMonthlySnapshot[],
  year: string,
  cutoffMonth: string,
) {
  const pensionAccounts = new Map(
    accounts
      .filter(account => account.type === 'pension' || account.type === 'irp')
      .map(account => [account.id, account]),
  )
  const latest = new Map<string, AccountMonthlySnapshot>()

  for (const snapshot of snapshots) {
    if (snapshot.month > cutoffMonth || !snapshot.month.startsWith(`${year}-`) || !pensionAccounts.has(snapshot.account_id)) continue
    const previous = latest.get(snapshot.account_id)
    if (!previous || previous.month <= snapshot.month) latest.set(snapshot.account_id, snapshot)
  }

  return latest
}
