'use server'
import { getHouseholdContext } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildNewAsset, buildTransactionInsert, buildTransactionUpdate } from '@/lib/transaction-edit'

type HouseholdClient = Awaited<ReturnType<typeof getHouseholdContext>>['supabase']

export async function deleteTransaction(id: string) {
  const { supabase, userId } = await getHouseholdContext()
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/transactions')
  revalidatePath('/')
  revalidatePath('/holdings')
}

export async function updateTransaction(id: string, formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()

  const { data: stored, error: readError } = await supabase.from('transactions')
    .select('type, asset_id, currency, user_id').eq('id', id).eq('user_id', userId).maybeSingle()
  if (readError) throw new Error(readError.message)
  let asset = null
  if (stored?.asset_id) {
    const { data, error } = await supabase.from('assets').select('id, currency, user_id')
      .eq('id', stored.asset_id).eq('user_id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    asset = data
  }
  const update = buildTransactionUpdate(stored, asset, userId, formData)

  const { data: updated, error } = await supabase
    .from('transactions')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select('id').maybeSingle()

  if (error) throw new Error(error.message)
  if (!updated) throw new Error('수정할 거래를 찾을 수 없습니다.')
  revalidatePath('/transactions')
  revalidatePath('/')
  revalidatePath('/holdings')
}

async function loadOwnedAccount(supabase: HouseholdClient, userId: string, formData: FormData) {
  const accountId = formData.get('account_id')
  if (typeof accountId !== 'string' || !accountId) return null
  const { data, error } = await supabase.from('accounts').select('id, user_id')
    .eq('id', accountId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function createTransaction(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()

  const account = await loadOwnedAccount(supabase, userId, formData)
  const assetId = formData.get('asset_id')
  let asset = null
  if (typeof assetId === 'string' && assetId) {
    const { data, error } = await supabase.from('assets').select('id, currency, user_id')
      .eq('id', assetId).eq('user_id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    asset = data
  }
  const insert = buildTransactionInsert(account, asset, userId, formData)

  const { error } = await supabase.from('transactions').insert(insert)
  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath('/holdings')
  revalidatePath('/transactions')
}

export async function createAssetAndTransaction(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()

  const account = await loadOwnedAccount(supabase, userId, formData)
  const newAsset = buildNewAsset(userId, formData)
  // 종목을 만들기 전에 거래 입력부터 검증해 잘못된 입력으로 빈 종목이 남지 않게 한다.
  buildTransactionInsert(account, { currency: newAsset.currency }, userId, formData)

  // 같은 심볼이 이미 있으면 새로 만들지 않고 기존 것 사용
  let asset: { id: string; currency: string; user_id: string } | null = null
  if (newAsset.symbol) {
    const { data: existing, error } = await supabase
      .from('assets')
      .select('id, currency, user_id')
      .eq('symbol', newAsset.symbol)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    asset = existing ?? null
  }

  if (!asset) {
    const { data: created, error: assetErr } = await supabase
      .from('assets')
      .insert(newAsset)
      .select('id, currency, user_id')
      .single()
    if (assetErr) throw new Error(assetErr.message)
    asset = created
  }

  if (!asset) throw new Error('종목 생성에 실패했습니다')

  // 기존 종목을 재사용했다면 그 종목의 통화로 다시 검증한다.
  formData.set('asset_id', asset.id)
  const insert = buildTransactionInsert(account, asset, userId, formData)
  const { error: txErr } = await supabase.from('transactions').insert(insert)
  if (txErr) throw new Error(txErr.message)

  revalidatePath('/')
  revalidatePath('/holdings')
  revalidatePath('/transactions')
}
