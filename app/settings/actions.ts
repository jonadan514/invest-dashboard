'use server'

import { revalidatePath } from 'next/cache'
import { getHouseholdContext } from '@/lib/supabase/server'
import { ALLOCATION_CLASSES, DEFAULT_TARGET_ALLOCATION } from '@/lib/settings'
import type { HouseholdGoal } from '@/lib/types'

function nonNegative(value: unknown, label: string) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} 값이 올바르지 않습니다.`)
  return number
}

function validateAllocation(value: unknown) {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : DEFAULT_TARGET_ALLOCATION
  const allocation = Object.fromEntries(ALLOCATION_CLASSES.map(item => [item.key, nonNegative(input[item.key], item.label)]))
  const total = Object.values(allocation).reduce((sum, ratio) => sum + ratio, 0)
  if (Math.abs(total - 100) > 0.001) throw new Error('목표 자산배분의 합은 100%여야 합니다.')
  return allocation
}

export async function saveHouseholdSettings(input: { monthlyIncome: number; targetAllocation: Record<string, number> }) {
  const { supabase, userId } = await getHouseholdContext()
  const { error } = await supabase.from('household_settings').upsert({
    user_id: userId,
    monthly_income: nonNegative(input.monthlyIncome, '월 소득'),
    target_allocation: validateAllocation(input.targetAllocation),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
  revalidatePath('/')
}

export async function saveHouseholdGoal(input: {
  id?: string
  name: string
  statement: string
  sub: string
  type: HouseholdGoal['type']
  target: number
  nextHint: string
  sortOrder: number
}) {
  const { supabase, userId } = await getHouseholdContext()
  if (!input.name.trim() || !input.statement.trim()) throw new Error('목표 이름과 문장을 입력해 주세요.')
  if (!['cash', 'investment', 'net_worth', 'other'].includes(input.type)) throw new Error('목표 유형이 올바르지 않습니다.')

  const row = {
    user_id: userId,
    name: input.name.trim(),
    statement: input.statement.trim(),
    sub: input.sub.trim(),
    type: input.type,
    target: nonNegative(input.target, '목표 금액'),
    next_hint: input.nextHint.trim(),
    sort_order: Math.max(0, Math.round(input.sortOrder)),
    updated_at: new Date().toISOString(),
  }
  if (row.target <= 0) throw new Error('목표 금액은 0보다 커야 합니다.')

  const query = input.id
    ? supabase.from('household_goals').update(row).eq('id', input.id).eq('user_id', userId)
    : supabase.from('household_goals').insert(row)
  const { error } = await query
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
  revalidatePath('/')
}

export async function setGoalAchieved(id: string, achieved: boolean) {
  const { supabase, userId } = await getHouseholdContext()
  const { error } = await supabase.from('household_goals')
    .update({ achieved_at: achieved ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
  revalidatePath('/')
}

export async function deleteHouseholdGoal(id: string) {
  const { supabase, userId } = await getHouseholdContext()
  const { error } = await supabase.from('household_goals').delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
  revalidatePath('/')
}

export async function migrateLegacySettings(input: {
  monthlyIncome: number
  targetAllocation: Record<string, number> | null
  goals: Array<Record<string, unknown>>
}) {
  const { supabase, userId } = await getHouseholdContext()
  const allocation = validateAllocation(input.targetAllocation ?? DEFAULT_TARGET_ALLOCATION)
  const settingsResult = await supabase.from('household_settings').upsert({
    user_id: userId,
    monthly_income: nonNegative(input.monthlyIncome, '월 소득'),
    target_allocation: allocation,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (settingsResult.error) throw new Error(settingsResult.error.message)

  const goals = input.goals.slice(0, 50).flatMap((goal, index) => {
    const type = String(goal.type ?? 'other')
    const target = Number(goal.target ?? 0)
    if (!String(goal.name ?? '').trim() || !String(goal.statement ?? '').trim() || target <= 0) return []
    return [{
      id: typeof goal.id === 'string' ? goal.id : crypto.randomUUID(),
      user_id: userId,
      name: String(goal.name).trim(),
      statement: String(goal.statement).trim(),
      sub: String(goal.sub ?? '').trim(),
      type: ['cash', 'investment', 'net_worth', 'other'].includes(type) ? type : 'other',
      target,
      next_hint: String(goal.next_hint ?? '').trim(),
      sort_order: Number(goal.order ?? index),
      achieved_at: typeof goal.achieved_at === 'string' ? goal.achieved_at : null,
      updated_at: new Date().toISOString(),
    }]
  })
  if (goals.length > 0) {
    const { error } = await supabase.from('household_goals').upsert(goals, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
  revalidatePath('/settings')
  revalidatePath('/')
}
