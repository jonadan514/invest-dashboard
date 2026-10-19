'use server'
import { getHouseholdContext } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildTransactionUpdate } from '@/lib/transaction-edit'

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

export async function createTransaction(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()

  const type = formData.get('type') as string
  const needsAsset = ['buy', 'sell', 'dividend'].includes(type)
  const qty = formData.get('quantity') ? Number(formData.get('quantity')) : null
  const price = formData.get('price') ? Number(formData.get('price')) : null
  const cashAmount = formData.get('cash_amount') ? Number(formData.get('cash_amount')) : null
  const amount = needsAsset && qty && price ? qty * price : cashAmount
  const currency = (formData.get('currency') as string) || 'KRW'

  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    date: formData.get('date') as string,
    account_id: formData.get('account_id') as string,
    asset_id: (formData.get('asset_id') as string) || null,
    type,
    quantity: qty,
    price,
    amount,
    fee: Number(formData.get('fee') ?? 0),
    tax: Number(formData.get('tax') ?? 0),
    fx_rate: currency === 'USD' ? Number(formData.get('fx_rate') ?? 0) || 1 : 1,
    currency,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath('/holdings')
}

export async function createAssetAndTransaction(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()

  const assetCurrency = (formData.get('asset_currency') as string) || 'KRW'

  // 같은 심볼이 이미 있으면 새로 만들지 않고 기존 것 사용
  const symbol = (formData.get('asset_symbol') as string) || null
  let asset: { id: string } | null = null

  if (symbol) {
    const { data: existing } = await supabase
      .from('assets')
      .select('id')
      .eq('symbol', symbol)
      .eq('user_id', userId)
      .maybeSingle()
    asset = existing ?? null
  }

  if (!asset) {
    const { data: newAsset, error: assetErr } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        name: formData.get('asset_name') as string,
        symbol,
        asset_class: formData.get('asset_class') as string,
        currency: assetCurrency,
        price_source: 'manual',
      })
      .select()
      .single()
    if (assetErr) throw new Error(assetErr.message)
    asset = newAsset
  }

  if (!asset) throw new Error('종목 생성에 실패했습니다')

  const qty = Number(formData.get('quantity'))
  const price = Number(formData.get('price'))

  const { error: txErr } = await supabase.from('transactions').insert({
    user_id: userId,
    date: formData.get('date') as string,
    account_id: formData.get('account_id') as string,
    asset_id: asset.id,
    type: formData.get('type') as string,
    quantity: qty,
    price,
    amount: qty * price,
    fee: Number(formData.get('fee') ?? 0),
    tax: Number(formData.get('tax') ?? 0),
    fx_rate: assetCurrency === 'USD' ? Number(formData.get('fx_rate') ?? 0) || 1 : 1,
    currency: assetCurrency,
  })
  if (txErr) throw new Error(txErr.message)

  revalidatePath('/')
  revalidatePath('/holdings')
}
