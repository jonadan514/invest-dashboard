'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createAccount(formData: FormData) {
  const supabase = await createClient()
  const type = formData.get('type') as string
  const interestRateRaw = formData.get('interest_rate') as string
  const monthlyPaymentRaw = formData.get('monthly_payment') as string
  const maturityDateRaw = formData.get('maturity_date') as string

  const { error } = await supabase.from('accounts').insert({
    name: formData.get('name') as string,
    broker: (formData.get('broker') as string) || null,
    owner: formData.get('owner') as string,
    type,
    tax_benefit: formData.get('tax_benefit') === 'true',
    interest_rate: interestRateRaw ? parseFloat(interestRateRaw) : null,
    monthly_payment: monthlyPaymentRaw ? parseInt(monthlyPaymentRaw, 10) : null,
    maturity_date: maturityDateRaw || null,
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
