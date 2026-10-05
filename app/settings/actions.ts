'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function num(fd: FormData, key: string, fallback = 0) {
  const raw = String(fd.get(key) ?? '').replace(/,/g, '')
  const v = Number(raw)
  return Number.isFinite(v) ? v : fallback
}

export async function saveHouseholdSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인 필요')

  const { error: planError } = await supabase
    .from('financial_plan_settings')
    .upsert({
      user_id: user.id,
      monthly_fixed_cost: num(formData, 'monthly_fixed_cost'),
      mortgage_interest: num(formData, 'mortgage_interest'),
      mortgage_principal: num(formData, 'mortgage_principal'),
      monthly_joint_contribution: num(formData, 'monthly_joint_contribution'),
      current_emergency_fund: num(formData, 'current_emergency_fund'),
      stage1_target: Math.max(num(formData, 'stage1_target'), 1),
      stage2_target: Math.max(num(formData, 'stage2_target'), 1),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (planError) throw new Error(planError.message)

  const { error: householdError } = await supabase
    .from('household_settings')
    .upsert({
      user_id: user.id,
      monthly_income: num(formData, 'monthly_income'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (householdError) throw new Error(householdError.message)

  revalidatePath('/')
  revalidatePath('/settings')
  revalidatePath('/budget')
}

export async function addGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인 필요')

  const { count } = await supabase
    .from('household_goals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const type = String(formData.get('type') || 'other')
  const allowed = new Set(['cash', 'investment', 'net_worth', 'other'])

  const { error } = await supabase.from('household_goals').insert({
    user_id: user.id,
    name: String(formData.get('name') || '').trim(),
    statement: String(formData.get('statement') || '').trim(),
    sub: String(formData.get('sub') || '').trim(),
    type: allowed.has(type) ? type : 'other',
    target: Math.max(num(formData, 'target'), 1),
    next_hint: String(formData.get('next_hint') || '').trim(),
    sort_order: (count ?? 0) + 1,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath('/settings')
}

export async function markGoalAchieved(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인 필요')

  const id = String(formData.get('id') || '')
  const { error } = await supabase
    .from('household_goals')
    .update({ achieved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath('/settings')
}

export async function deleteGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인 필요')

  const id = String(formData.get('id') || '')
  const { error } = await supabase
    .from('household_goals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath('/settings')
}
