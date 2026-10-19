'use server'
import { getHouseholdContext } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createAccount(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const type = formData.get('type') as string
  if (!['cash', 'mmf', 'general', 'pension', 'irp', 'isa', 'crypto'].includes(type)) {
    throw new Error('지원하지 않는 계좌 유형입니다.')
  }

  const { error } = await supabase.from('accounts').insert({
    user_id: userId,
    name: formData.get('name') as string,
    broker: (formData.get('broker') as string) || null,
    owner: formData.get('owner') as string,
    type,
    tax_benefit: formData.get('tax_benefit') === 'true',
    is_emergency_fund: formData.get('is_emergency_fund') === 'true',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/budget')
  revalidatePath('/pension')
  revalidatePath('/')
}

export async function deleteAccount(id: string) {
  const { supabase, userId } = await getHouseholdContext()
  const { error } = await supabase.from('accounts').delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/budget')
  revalidatePath('/pension')
  revalidatePath('/')
}

export async function toggleActive(id: string, _current?: boolean, effectiveMonth?: string) {
  const { supabase, userId } = await getHouseholdContext()
  const month = effectiveMonth ?? new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul',
  }).format(new Date())
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 월 형식이 아닙니다.')
  // The locked database row determines the status, never the stale client flag.
  const { error } = await supabase.rpc('toggle_account_activity', {
    p_user_id: userId,
    p_account_id: id,
    p_month: month,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/budget')
  revalidatePath('/pension')
  revalidatePath('/')
}
