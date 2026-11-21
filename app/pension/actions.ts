'use server'

import { revalidatePath } from 'next/cache'
import { runAction, type ActionResult } from '@/lib/action-result'
import { regularYtd } from '@/lib/calc/pension'
import { getHouseholdContext } from '@/lib/supabase/server'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** 새 칸(contribution_start_month)이 아직 데이터베이스에 없을 때 알아보기 쉬운 안내로 바꾼다. */
function friendly(message: string) {
  return message.includes('contribution_start_month')
    ? 'Supabase에 정기 납입 시작 달 칸이 아직 없어요. 안내받은 SQL을 Supabase SQL Editor에서 먼저 실행해 주세요.'
    : message
}

async function pensionAccount(accountId: string) {
  const { supabase, userId } = await getHouseholdContext()
  const { data: account, error } = await supabase.from('accounts').select('*').eq('id', accountId).eq('user_id', userId).single()
  if (error) throw new Error(friendly(error.message))
  if (account.type !== 'pension' && account.type !== 'irp') throw new Error('연금저축·IRP 계좌만 정기 납입을 설정할 수 있어요.')
  return { supabase, userId, account }
}

/**
 * 연금저축·IRP 계좌의 매달 정기 납입액과 시작 달. 금액을 비우거나 0이면 '돈 생길 때마다'로 보고 시작 달도 지운다.
 */
export async function setMonthlyContribution(accountId: string, amountText: string, startMonth = ''): Promise<ActionResult> {
  return runAction(async () => {
    const raw = amountText.replace(/[^0-9]/g, '')
    const amount = raw ? Number(raw) : 0
    if (!Number.isFinite(amount) || amount < 0) throw new Error('금액은 0 이상의 숫자로 입력해 주세요.')
    if (startMonth && !MONTH.test(startMonth)) throw new Error('시작 달을 다시 골라 주세요.')
    const { supabase, userId } = await pensionAccount(accountId)
    const { error } = await supabase.from('accounts')
      .update({ monthly_payment: amount > 0 ? amount : null, contribution_start_month: amount > 0 && startMonth ? startMonth : null })
      .eq('id', accountId).eq('user_id', userId)
    if (error) throw new Error(friendly(error.message))
    revalidatePath('/pension')
    revalidatePath('/budget')
  })
}

/**
 * 정기 납입 시작 달부터 이미 저장된 달별 기록의 '올해 누적 납입액'을 정기 납입 기준으로 맞춘다.
 * 정기 납입만 하는 계좌용이다. 기록이 없는 달은 만들지 않는다(평가금액을 모르기 때문).
 */
export async function backfillRegularContributions(accountId: string): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const { supabase, userId, account } = await pensionAccount(accountId)
    const monthly = Number(account.monthly_payment ?? 0)
    const start = account.contribution_start_month as string | null
    if (!(monthly > 0) || !start) throw new Error('매달 정기 납입액과 시작 달을 먼저 넣어 주세요.')
    const { data: rows, error } = await supabase.from('account_monthly_snapshots').select('id, month, ytd_contribution')
      .eq('user_id', userId).eq('account_id', accountId).gte('month', start).order('month')
    if (error) throw new Error(error.message)
    let updated = 0
    for (const row of (rows ?? []) as { id: string; month: string; ytd_contribution: number }[]) {
      const target = regularYtd(row.month, start, monthly)
      if (Math.round(Number(row.ytd_contribution)) === target) continue
      const { error: updateError } = await supabase.from('account_monthly_snapshots')
        .update({ ytd_contribution: target, updated_at: new Date().toISOString() }).eq('id', row.id).eq('user_id', userId)
      if (updateError) throw new Error(updateError.message)
      updated += 1
    }
    revalidatePath('/pension')
    revalidatePath('/budget')
    revalidatePath('/')
    return { updated }
  })
}
