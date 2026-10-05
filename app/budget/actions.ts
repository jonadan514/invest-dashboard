'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function saveBudgetEntry(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인 필요')

  const { error } = await supabase
    .from('monthly_budgets')
    .upsert({
      user_id: user.id,
      month: String(formData.get('month')),
      joint_savings: Number(formData.get('joint_savings') || 0),
      bonus_total:   Number(formData.get('bonus_total')   || 0),
      bonus_to_plan: Number(formData.get('bonus_to_plan') || 0),
      cash_balance:  Number(formData.get('cash_balance')  || 0),
      memo: String(formData.get('memo') || ''),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,month' })

  if (error) throw new Error(error.message)
  revalidatePath('/budget')
}
