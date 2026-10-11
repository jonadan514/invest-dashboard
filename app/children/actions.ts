'use server'

import { revalidatePath } from 'next/cache'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { ChildAccountAssetType, ChildGiftDonor, ChildGiftRelationship, ChildGiftTransferType } from '@/lib/types'

const DONOR_RELATIONSHIP: Record<ChildGiftDonor, ChildGiftRelationship> = {
  parents: 'direct_ascendant',
  me: 'direct_ascendant',
  spouse: 'direct_ascendant',
  grandparents: 'direct_ascendant',
  other_relative: 'other_relative',
  non_relative: 'non_relative',
}
const DONORS = new Set<ChildGiftDonor>(Object.keys(DONOR_RELATIONSHIP) as ChildGiftDonor[])
const TRANSFER_TYPES = new Set<ChildGiftTransferType>(['gift', 'living_education', 'customary'])
const CHILD_ACCOUNT_ASSET_TYPES = new Set<ChildAccountAssetType>(['cash', 'investment'])
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requiredText(formData: FormData, name: string, message: string) {
  const value = String(formData.get(name) ?? '').trim()
  if (!value) throw new Error(message)
  return value
}

function optionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim()
  return value || null
}

function validDate(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '')
  if (!DATE_PATTERN.test(value)) {
    throw new Error('올바른 날짜를 입력해 주세요.')
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  const normalized = [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    String(parsed.getUTCDate()).padStart(2, '0'),
  ].join('-')
  if (normalized !== value) throw new Error('올바른 날짜를 입력해 주세요.')
  return value
}

function todayInKorea() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date())
}

export async function createChild(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const birthDate = validDate(formData, 'birth_date')
  const today = todayInKorea()
  if (birthDate > today) throw new Error('생년월일은 오늘 이후일 수 없습니다.')

  const { error } = await supabase.from('children').insert({
    user_id: userId,
    name: requiredText(formData, 'name', '자녀 이름이나 별칭을 입력해 주세요.'),
    birth_date: birthDate,
    account_name: optionalText(formData, 'account_name'),
    memo: optionalText(formData, 'memo'),
  })
  if (error) throw new Error(error.message)

  revalidatePath('/children')
}

export async function createChildGift(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const childId = String(formData.get('child_id') ?? '')
  const donor = String(formData.get('donor') ?? '') as ChildGiftDonor
  const transferType = String(formData.get('transfer_type') ?? '') as ChildGiftTransferType
  const giftDate = validDate(formData, 'gift_date')
  const today = todayInKorea()
  const amount = Number(String(formData.get('amount') ?? '').replace(/,/g, ''))
  const childAccountId = String(formData.get('child_account_id') ?? '')

  if (!UUID_PATTERN.test(childId)) throw new Error('자녀를 선택해 주세요.')
  if (!DONORS.has(donor)) throw new Error('입금자를 선택해 주세요.')
  if (!TRANSFER_TYPES.has(transferType)) throw new Error('입금 성격을 선택해 주세요.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('납입액은 0보다 큰 숫자로 입력해 주세요.')
  if (giftDate > today) throw new Error('아직 납입하지 않은 미래 날짜는 기록할 수 없습니다.')
  if (childAccountId && !UUID_PATTERN.test(childAccountId)) throw new Error('올바른 자녀 계좌를 선택해 주세요.')

  const { data: child, error: childError } = await supabase
    .from('children')
    .select('id, account_name')
    .eq('id', childId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (childError) throw new Error(childError.message)
  if (!child) throw new Error('등록된 자녀를 찾을 수 없습니다.')

  let childAccount: { id: string; name: string } | null = null
  if (childAccountId) {
    const { data, error } = await supabase
      .from('child_accounts')
      .select('id, name')
      .eq('id', childAccountId)
      .eq('child_id', childId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('선택한 자녀 계좌를 찾을 수 없습니다.')
    childAccount = data
  }

  const { error } = await supabase.from('child_gift_deposits').insert({
    user_id: userId,
    child_id: childId,
    gift_date: giftDate,
    amount,
    donor,
    donor_name: optionalText(formData, 'donor_name'),
    relationship_category: DONOR_RELATIONSHIP[donor],
    transfer_type: transferType,
    child_account_id: childAccount?.id ?? null,
    account_name: childAccount?.name ?? child.account_name,
    memo: optionalText(formData, 'memo'),
  })
  if (error) throw new Error(error.message)

  revalidatePath('/children')
}

export async function createChildAccount(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const childId = String(formData.get('child_id') ?? '')
  const assetType = String(formData.get('asset_type') ?? '') as ChildAccountAssetType
  const name = requiredText(formData, 'name', '계좌명을 입력해 주세요.')

  if (!UUID_PATTERN.test(childId)) throw new Error('자녀를 선택해 주세요.')
  if (!CHILD_ACCOUNT_ASSET_TYPES.has(assetType)) throw new Error('계좌 유형을 선택해 주세요.')
  if (name.length > 100) throw new Error('계좌명은 100자 이하로 입력해 주세요.')

  const { data: child, error: childError } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (childError) throw new Error(childError.message)
  if (!child) throw new Error('등록된 자녀를 찾을 수 없습니다.')

  const { error } = await supabase.from('child_accounts').insert({
    user_id: userId,
    child_id: childId,
    name,
    asset_type: assetType,
  })
  if (error?.code === '23505') throw new Error('같은 이름의 자녀 계좌가 이미 있습니다.')
  if (error) throw new Error(error.message)

  revalidatePath('/children')
}

export async function saveChildAccountSnapshot(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const accountId = String(formData.get('account_id') ?? '')
  const monthInput = String(formData.get('month') ?? '')
  const evaluationAmount = Number(String(formData.get('evaluation_amount') ?? '').replace(/,/g, ''))

  if (!UUID_PATTERN.test(accountId)) throw new Error('자녀 계좌를 선택해 주세요.')
  if (!MONTH_PATTERN.test(monthInput)) throw new Error('올바른 평가월을 입력해 주세요.')
  if (`${monthInput}-01` > todayInKorea().slice(0, 7) + '-01') throw new Error('미래 평가월은 기록할 수 없습니다.')
  if (!Number.isSafeInteger(evaluationAmount) || evaluationAmount < 0) throw new Error('평가금액은 0 이상의 원 단위 숫자로 입력해 주세요.')

  const { data: account, error: accountError } = await supabase
    .from('child_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (accountError) throw new Error(accountError.message)
  if (!account) throw new Error('등록된 자녀 계좌를 찾을 수 없습니다.')

  const { error } = await supabase.from('child_account_monthly_snapshots').upsert({
    user_id: userId,
    account_id: accountId,
    month: `${monthInput}-01`,
    evaluation_amount: evaluationAmount,
    memo: optionalText(formData, 'memo'),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,account_id,month' })
  if (error) throw new Error(error.message)

  revalidatePath('/children')
}

export async function deleteChildAccountSnapshot(id: string) {
  if (!UUID_PATTERN.test(id)) throw new Error('올바른 평가 기록이 아닙니다.')
  const { supabase, userId } = await getHouseholdContext()
  const { error } = await supabase
    .from('child_account_monthly_snapshots')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/children')
}

export async function deleteChildGift(id: string) {
  if (!UUID_PATTERN.test(id)) throw new Error('올바른 납입 기록이 아닙니다.')
  const { supabase, userId } = await getHouseholdContext()
  const { error } = await supabase
    .from('child_gift_deposits')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/children')
}
