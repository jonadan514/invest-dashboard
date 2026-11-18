import 'server-only'

import { buildMortgageSchedule, type MortgageItemTerms } from '@/lib/calc/mortgage-schedule'
import type { createClient } from '@/lib/supabase/server'

type Client = ReturnType<typeof createClient>

export function currentKstMonth(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul' }).format(now)
}

/**
 * 주택담보대출 잔액을 이번 달까지 원리금균등 스케줄로 채운다(source = 'mortgage_auto').
 * 직접 입력한 잔액(manual)은 기준점으로만 쓰고 절대 덮어쓰지 않는다. 바뀐 달만 저장하므로 여러 번 불러도 안전하다.
 * 월간 기록·밸런스 시트 저장 뒤와 주요 화면을 열 때 불러, DB 함수가 계산하지 않는 '기록 없는 달'까지 맞춘다.
 */
export async function syncMortgageSchedule(supabase: Client, userId: string, throughMonth = currentKstMonth()) {
  const { data: items, error: itemError } = await supabase.from('net_worth_items')
    .select('id, interest_rate, monthly_payment, inactive_from_month')
    .eq('user_id', userId).eq('category', 'mortgage').eq('is_active', true)
  if (itemError) throw new Error(itemError.message)
  const mortgages = (items ?? []) as MortgageItemTerms[]
  if (mortgages.length === 0) return { updated: 0 }

  const [{ data: snapshotRows, error: snapshotError }, budgetResult] = await Promise.all([
    supabase.from('net_worth_snapshots').select('item_id, month, amount, source')
      .eq('user_id', userId).in('item_id', mortgages.map(item => item.id)).order('month'),
    // 월간 기록의 원금은 가구 전체 값이라, DB 함수와 같게 주담대가 하나일 때만 그 대출에 반영한다.
    mortgages.length === 1
      ? supabase.from('monthly_budgets').select('month, mortgage_principal, mortgage_extra_principal').eq('user_id', userId)
      : Promise.resolve({ data: null, error: null }),
  ])
  if (snapshotError) throw new Error(snapshotError.message)
  if (budgetResult.error) throw new Error(budgetResult.error.message)
  const budgetPrincipal = budgetResult.data
    ? new Map((budgetResult.data as { month: string; mortgage_principal: number; mortgage_extra_principal: number }[])
      .map(row => [row.month, Number(row.mortgage_principal) + Number(row.mortgage_extra_principal)]))
    : null

  const rows: { user_id: string; item_id: string; month: string; amount: number; source: 'mortgage_auto'; updated_at: string }[] = []
  for (const item of mortgages) {
    const snapshots = (snapshotRows ?? []).filter(row => row.item_id === item.id)
      .map(row => ({ month: row.month as string, amount: Number(row.amount), source: row.source as string }))
    const existing = new Map(snapshots.map(row => [row.month, row]))
    for (const scheduled of buildMortgageSchedule({ item, snapshots, budgetPrincipal, throughMonth })) {
      const current = existing.get(scheduled.month)
      if (current?.source === 'manual') continue
      if (current && Math.round(current.amount) === Math.round(scheduled.balance)) continue
      rows.push({ user_id: userId, item_id: item.id, month: scheduled.month, amount: scheduled.balance, source: 'mortgage_auto', updated_at: new Date().toISOString() })
    }
  }
  if (rows.length === 0) return { updated: 0 }
  const { error } = await supabase.from('net_worth_snapshots').upsert(rows, { onConflict: 'user_id,item_id,month' })
  if (error) throw new Error(error.message)
  return { updated: rows.length }
}

/** 화면을 그리기 전에 부르는 용도. 동기화가 실패해도 화면은 기존 기록으로 보여 준다. */
export async function trySyncMortgageSchedule(supabase: Client, userId: string) {
  try {
    return await syncMortgageSchedule(supabase, userId)
  } catch (error) {
    console.error('[mortgage-sync]', error)
    return { updated: 0 }
  }
}
