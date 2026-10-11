import type { ChildAccount, ChildAccountMonthlySnapshot, ChildGiftDeposit } from '@/lib/types'

// Do not label cash added after the valuation (or unlinked deposits) as investment losses.
export function valuationStatus(accounts: ChildAccount[], snapshots: ChildAccountMonthlySnapshot[], gifts: ChildGiftDeposit[]) {
  const active = accounts.filter(account => account.is_active)
  const latest = new Map<string, ChildAccountMonthlySnapshot>()
  for (const snapshot of snapshots) {
    if (!latest.has(snapshot.account_id) || latest.get(snapshot.account_id)!.month < snapshot.month) latest.set(snapshot.account_id, snapshot)
  }
  const months = active.map(account => latest.get(account.id)?.month.slice(0, 7))
  const complete = active.length > 0 && months.every(Boolean)
  const sameMonth = complete && new Set(months).size === 1
  const valuedMonth = sameMonth ? months[0]! : null
  const accountIds = new Set(active.map(account => account.id))
  const unlinked = gifts.some(gift => !gift.child_account_id || !accountIds.has(gift.child_account_id))
  const newerDeposit = valuedMonth !== null && gifts.some(gift => gift.gift_date.slice(0, 7) > valuedMonth)
  const ready = sameMonth && !unlinked && !newerDeposit
  const reason = !complete ? '모든 계좌 평가 필요' : !sameMonth ? '계좌 평가월을 동일하게 맞춰 주세요' : unlinked ? '계좌 미연결 납입액 확인 필요' : newerDeposit ? '추가 입금 후 평가 갱신 필요' : `${valuedMonth} 월말 · 인출 없음 기준`
  return { ready, reason, valuedMonth }
}
