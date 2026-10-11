'use server'

import { revalidatePath } from 'next/cache'
import { getHouseholdContext } from '@/lib/supabase/server'

const ASSET_CATEGORIES = new Set([
  'cash', 'savings', 'real_estate', 'deposit', 'vehicle', 'other_asset',
])
const LIABILITY_CATEGORIES = new Set([
  'mortgage', 'credit_loan', 'lease', 'card', 'other_liability',
])

function requiredText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim()
  if (!value) throw new Error('항목 이름을 입력해 주세요.')
  return value
}

function optionalNumber(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? '').replace(/,/g, '').trim()
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error('금액과 이율은 0 이상의 숫자로 입력해 주세요.')
  return value
}

export async function createNetWorthItem(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const kind = String(formData.get('kind') ?? '')
  const category = String(formData.get('category') ?? '')
  const owner = String(formData.get('owner') ?? 'household')
  const month = String(formData.get('initial_month') ?? '')
  const initialAmount = optionalNumber(formData, 'initial_amount')
  const interestRate = optionalNumber(formData, 'interest_rate')
  const monthlyPayment = optionalNumber(formData, 'monthly_payment')
  const startDate = String(formData.get('start_date') ?? '') || null
  const maturityDate = String(formData.get('maturity_date') ?? '') || null

  if (kind !== 'asset' && kind !== 'liability') throw new Error('자산 또는 부채를 선택해 주세요.')
  const allowedCategories = kind === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES
  if (!allowedCategories.has(category)) throw new Error('올바른 분류를 선택해 주세요.')
  if (!['household', 'me', 'spouse'].includes(owner)) throw new Error('올바른 소유자를 선택해 주세요.')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('최초 금액의 기준 월을 선택해 주세요.')
  if (initialAmount === null) throw new Error('현재 금액을 입력해 주세요.')
  if (startDate && maturityDate && maturityDate < startDate) throw new Error('만기일은 시작일 이후여야 합니다.')

  const { data: item, error } = await supabase
    .from('net_worth_items')
    .insert({
      user_id: userId,
      name: requiredText(formData, 'name'),
      kind,
      category,
      owner,
      interest_rate: interestRate,
      monthly_payment: monthlyPayment,
      start_date: startDate,
      maturity_date: maturityDate,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const { error: snapshotError } = await supabase.from('net_worth_snapshots').insert({
    user_id: userId,
    item_id: item.id,
    month,
    amount: initialAmount,
  })
  if (snapshotError) {
    await supabase.from('net_worth_items').delete().eq('id', item.id).eq('user_id', userId)
    throw new Error(snapshotError.message)
  }

  revalidatePath('/net-worth')
  revalidatePath('/')
}

export async function saveNetWorthSnapshot(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const month = String(formData.get('month') ?? '')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 기준 월을 선택해 주세요.')

  const { data: items, error: itemError } = await supabase
    .from('net_worth_items')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
  if (itemError) throw new Error(itemError.message)

  const rows = (items ?? []).map(item => {
    const raw = String(formData.get(`amount_${item.id}`) ?? '0').replace(/,/g, '')
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('금액은 0 이상의 숫자로 입력해 주세요.')
    return { user_id: userId, item_id: item.id, month, amount, source: 'manual', updated_at: new Date().toISOString() }
  })

  if (rows.length > 0) {
    const { error } = await supabase
      .from('net_worth_snapshots')
      .upsert(rows, { onConflict: 'user_id,item_id,month' })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/net-worth')
  revalidatePath('/')
}

export async function updateNetWorthItem(id: string, formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const interestRate = optionalNumber(formData, 'interest_rate')
  const monthlyPayment = optionalNumber(formData, 'monthly_payment')
  const startDate = String(formData.get('start_date') ?? '') || null
  const maturityDate = String(formData.get('maturity_date') ?? '') || null
  const owner = String(formData.get('owner') ?? '')

  if (!['household', 'me', 'spouse'].includes(owner)) throw new Error('올바른 소유자를 선택해 주세요.')
  if (startDate && maturityDate && maturityDate < startDate) throw new Error('만기일은 시작일 이후여야 합니다.')

  const { error } = await supabase
    .from('net_worth_items')
    .update({
      name: requiredText(formData, 'name'),
      owner,
      interest_rate: interestRate,
      monthly_payment: monthlyPayment,
      start_date: startDate,
      maturity_date: maturityDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/net-worth')
}

export async function setNetWorthItemActive(id: string, active: boolean, month: string) {
  const { supabase, userId } = await getHouseholdContext()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 기준 월을 선택해 주세요.')

  if (!active) {
    const { error: snapshotError } = await supabase.from('net_worth_snapshots').upsert({
      user_id: userId,
      item_id: id,
      month,
      amount: 0,
      source: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,item_id,month' })
    if (snapshotError) throw new Error(snapshotError.message)
  }

  const { error } = await supabase
    .from('net_worth_items')
    .update({
      is_active: active,
      inactive_from_month: active ? null : month,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/net-worth')
  revalidatePath('/')
}
