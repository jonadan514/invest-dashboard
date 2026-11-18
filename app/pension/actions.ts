'use server'

import { revalidatePath } from 'next/cache'
import { runAction, type ActionResult } from '@/lib/action-result'
import { getHouseholdContext } from '@/lib/supabase/server'

/** 연금저축·IRP 계좌의 매달 정기 납입액. 비우거나 0이면 '돈 생길 때마다'로 본다. */
export async function setMonthlyContribution(accountId: string, amountText: string): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const raw = amountText.replace(/[^0-9]/g, '')
    const amount = raw ? Number(raw) : 0
    if (!Number.isFinite(amount) || amount < 0) throw new Error('금액은 0 이상의 숫자로 입력해 주세요.')
    const { data: account, error: accountError } = await supabase.from('accounts').select('type').eq('id', accountId).eq('user_id', userId).single()
    if (accountError) throw new Error(accountError.message)
    if (account.type !== 'pension' && account.type !== 'irp') throw new Error('연금저축·IRP 계좌만 정기 납입을 설정할 수 있어요.')
    const { error } = await supabase.from('accounts').update({ monthly_payment: amount > 0 ? amount : null }).eq('id', accountId).eq('user_id', userId)
    if (error) throw new Error(error.message)
    revalidatePath('/pension')
    revalidatePath('/budget')
  })
}
