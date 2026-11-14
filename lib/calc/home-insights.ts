import { isAccountActiveAtMonth, latestSnapshotsAtMonth } from './account-snapshots.ts'
import type { Account, AccountMonthlySnapshot, AccountType, HouseholdGoal, NetWorthItem, NetWorthSnapshot } from '@/lib/types'

export interface MonthValue {
  month: string
  value: number
}

export interface TrendPoint {
  month: string
  assets: number
  liabilities: number
  netWorth: number
}

/** 주식·ISA·코인·연금 계좌를 투자 목표 집계 대상으로 본다. 입출금·CMA·예적금·부채 계좌는 제외한다. */
export const INVESTMENT_ACCOUNT_TYPES: readonly AccountType[] = ['general', 'isa', 'crypto', 'pension', 'irp']

function isItemActiveAtMonth(item: NetWorthItem, month: string) {
  return !item.inactive_from_month || month < item.inactive_from_month
}

/** 밸런스 시트 항목과 금융계좌 합계로 월별 총자산·총부채·순자산을 만든다. */
export function buildTrend(
  items: NetWorthItem[],
  snapshots: NetWorthSnapshot[],
  accountTotals: { month: string; amount: number }[],
  cutoffMonth: string,
): TrendPoint[] {
  const itemMap = new Map(items.map(item => [item.id, item]))
  const snapshotsByMonth = new Map<string, NetWorthSnapshot[]>()
  for (const snapshot of snapshots) {
    const list = snapshotsByMonth.get(snapshot.month) ?? []
    list.push(snapshot)
    snapshotsByMonth.set(snapshot.month, list)
  }

  const portfolioByMonth = new Map(accountTotals.map(snapshot => [snapshot.month, Number(snapshot.amount)]))
  const months = [...new Set([
    ...snapshotsByMonth.keys(), ...portfolioByMonth.keys(),
    ...items.flatMap(item => item.inactive_from_month ? [item.inactive_from_month] : []),
  ])].filter(month => month <= cutoffMonth).sort()
  const latestAmounts = new Map<string, number>()
  let latestPortfolio = 0

  return months.map(month => {
    for (const snapshot of snapshotsByMonth.get(month) ?? []) {
      latestAmounts.set(snapshot.item_id, Number(snapshot.amount))
    }
    if (portfolioByMonth.has(month)) latestPortfolio = portfolioByMonth.get(month) ?? 0

    let assets = latestPortfolio
    let liabilities = 0
    for (const [itemId, amount] of latestAmounts) {
      const item = itemMap.get(itemId)
      if (!item || !isItemActiveAtMonth(item, month)) continue
      if (item.kind === 'asset') assets += amount
      else liabilities += amount
    }
    return { month, assets, liabilities, netWorth: assets - liabilities }
  })
}

/** 선택한 계좌들의 월별 평가금액 합계. 기록이 없는 달은 직전 기록을 이어 쓰고 해지된 계좌는 뺀다. */
export function accountSeries(
  accounts: Account[],
  snapshots: AccountMonthlySnapshot[],
  months: string[],
  include: (account: Account) => boolean,
): MonthValue[] {
  const selected = accounts.filter(include)
  const selectedIds = new Set(selected.map(account => account.id))
  const relevant = snapshots.filter(snapshot => selectedIds.has(snapshot.account_id))
  return months.map(month => {
    const latest = latestSnapshotsAtMonth(relevant, month)
    const value = selected.reduce((sum, account) => {
      const snapshot = latest.get(account.id)
      return snapshot && isAccountActiveAtMonth(account, month) ? sum + Number(snapshot.evaluation_amount) : sum
    }, 0)
    return { month, value }
  })
}

export interface ChangeDriver {
  key: string
  label: string
  source: 'account' | 'asset' | 'liability'
  /** 순자산에 미친 영향. 부채가 줄면 양수다. */
  change: number
}

/**
 * 두 달 사이 순자산 변화를 계좌·밸런스 시트 항목별로 나눈다.
 * buildTrend와 같은 규칙(직전 기록 이어쓰기, 해지·종료 반영)을 써서 합계가 순자산 변화와 일치한다.
 */
export function netWorthChangeDrivers(input: {
  accounts: Account[]
  accountSnapshots: AccountMonthlySnapshot[]
  items: NetWorthItem[]
  itemSnapshots: NetWorthSnapshot[]
  fromMonth: string
  toMonth: string
}): ChangeDriver[] {
  const drivers: ChangeDriver[] = []

  const accountsAt = (month: string) => latestSnapshotsAtMonth(input.accountSnapshots, month)
  const fromAccounts = accountsAt(input.fromMonth)
  const toAccounts = accountsAt(input.toMonth)
  for (const account of input.accounts) {
    const value = (month: string, latest: Map<string, AccountMonthlySnapshot>) => {
      const snapshot = latest.get(account.id)
      return snapshot && isAccountActiveAtMonth(account, month) ? Number(snapshot.evaluation_amount) : 0
    }
    const change = value(input.toMonth, toAccounts) - value(input.fromMonth, fromAccounts)
    if (change !== 0) drivers.push({ key: `account:${account.id}`, label: account.name, source: 'account', change })
  }

  const itemValueAt = (item: NetWorthItem, month: string) => {
    if (!isItemActiveAtMonth(item, month)) return 0
    let latest: NetWorthSnapshot | null = null
    for (const snapshot of input.itemSnapshots) {
      if (snapshot.item_id !== item.id || snapshot.month > month) continue
      if (!latest || latest.month <= snapshot.month) latest = snapshot
    }
    return latest ? Number(latest.amount) : 0
  }
  for (const item of input.items) {
    const sign = item.kind === 'asset' ? 1 : -1
    const change = sign * (itemValueAt(item, input.toMonth) - itemValueAt(item, input.fromMonth))
    if (change !== 0) drivers.push({ key: `item:${item.id}`, label: item.name, source: item.kind === 'asset' ? 'asset' : 'liability', change })
  }

  return drivers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.label.localeCompare(b.label, 'ko'))
}

export function monthsBetween(from: string, to: string) {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

export function addMonths(month: string, count: number) {
  const [year, value] = month.split('-').map(Number)
  const index = year * 12 + (value - 1) + count
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export interface GoalProgress {
  current: number
  target: number
  percent: number
  remaining: number
  achieved: boolean
  /** 최근 기록 기준 월평균 증가액. 비교할 기록이 없으면 null. */
  monthlyPace: number | null
  paceMonths: number
  /** 지금 속도로 목표에 닿는 달(YYYY-MM). 속도가 0 이하이거나 50년을 넘으면 null. */
  etaMonth: string | null
}

const MAX_ETA_MONTHS = 600

/** 목표 금액 대비 진행률과, 최근 최대 windowMonths개월 평균 증가 속도로 달성 예상 시점을 구한다. */
export function goalProgress(target: number, series: MonthValue[], windowMonths = 6): GoalProgress {
  const sorted = [...series].sort((a, b) => a.month.localeCompare(b.month))
  const last = sorted.at(-1)
  const current = last?.value ?? 0
  const remaining = Math.max(target - current, 0)
  const achieved = target > 0 && current >= target
  const percent = target > 0 ? Math.min(Math.max(current / target * 100, 0), 100) : 0

  let monthlyPace: number | null = null
  let paceMonths = 0
  if (last) {
    const base = sorted.find(point => monthsBetween(point.month, last.month) <= windowMonths && point.month < last.month)
    if (base) {
      paceMonths = monthsBetween(base.month, last.month)
      monthlyPace = (last.value - base.value) / paceMonths
    }
  }

  let etaMonth: string | null = null
  if (last && !achieved && monthlyPace !== null && monthlyPace > 0) {
    const months = Math.ceil(remaining / monthlyPace)
    if (months <= MAX_ETA_MONTHS) etaMonth = addMonths(last.month, months)
  }

  return { current, target, percent, remaining, achieved, monthlyPace, paceMonths, etaMonth }
}

/** 달성 처리하지 않은 목표 중 정렬 순서가 가장 앞선 목표. */
export function pickActiveGoal(goals: HouseholdGoal[]) {
  return [...goals]
    .filter(goal => !goal.achieved_at)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))[0] ?? null
}
