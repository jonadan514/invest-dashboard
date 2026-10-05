'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인 필요')

  const type = String(formData.get('type') || '')
  const allowed = new Set(['general', 'pension', 'irp', 'isa', 'crypto', 'savings', 'cash', 'mmf'])
  if (!allowed.has(type)) throw new Error('지원하지 않는 계좌 유형입니다.')

  const interestRateRaw = String(formData.get('interest_rate') || '')
  const monthlyPaymentRaw = String(formData.get('monthly_payment') || '')
  const maturityDateRaw = String(formData.get('maturity_date') || '')

  const { error } = await supabase.from('accounts').insert({
    user_id: user.id,
    name: String(formData.get('name') || ''),
    broker: String(formData.get('broker') || '') || null,
    owner: String(formData.get('owner') || 'me'),
    type,
    tax_benefit: formData.get('tax_benefit') === 'true',
    interest_rate: interestRateRaw ? parseFloat(interestRateRaw) : null,
    monthly_payment: monthlyPaymentRaw ? parseInt(monthlyPaymentRaw, 10) : null,
    maturity_date: maturityDateRaw || null,
    is_emergency_fund: formData.get('is_emergency_fund') === 'true',
  })

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
  revalidatePath('/')
}

export async function deleteAccount(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
  revalidatePath('/')
}

export async function toggleActive(id: string, current: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('accounts')
    .update({ is_active: !current })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}
