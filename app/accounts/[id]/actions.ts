'use server'

import { revalidatePath } from 'next/cache'
import { getHouseholdContext } from '@/lib/supabase/server'

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/

export async function saveAccountBalance(accountId: string, formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, type')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle()

  if (accountError) throw new Error(accountError.message)
  if (!account || !['savings', 'debt'].includes(account.type)) {
    throw new Error('잔액을 기록할 수 없는 계좌입니다')
  }

  const asOf = String(formData.get('as_of') ?? '')
  const value = Number(formData.get('value'))
  const memo = String(formData.get('memo') ?? '').trim()

  if (!ISO_DATE.test(asOf)) throw new Error('기준일을 확인해 주세요')
  if (!Number.isFinite(value) || value < 0) throw new Error('잔액은 0원 이상이어야 합니다')
  if (memo.length > 500) throw new Error('메모는 500자 이하로 입력해 주세요')

  const { error } = await supabase.from('balances').insert({
    user_id: userId,
    account_id: accountId,
    value,
    as_of: asOf,
    memo: memo || null,
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/accounts/${accountId}`)
  revalidatePath('/accounts')
  revalidatePath('/')
}
