'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteTransaction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/transactions')
  revalidatePath('/')
  revalidatePath('/holdings')
}

export async function updateTransaction(id: string, formData: FormData) {
  const supabase = await createClient()

  const type = formData.get('type') as string
  const needsAsset = ['buy', 'sell', 'dividend'].includes(type)
  const qty = formData.get('quantity') ? Number(formData.get('quantity')) : null
  const price = formData.get('price') ? Number(formData.get('price')) : null
  const cashAmount = formData.get('cash_amount') ? Number(formData.get('cash_amount')) : null
  const amount = needsAsset && qty && price ? qty * price : cashAmount

  const { error } = await supabase
    .from('transactions')
    .update({
      date: formData.get('date') as string,
      type,
      quantity: qty,
      price,
      amount,
      fee: Number(formData.get('fee') ?? 0),
      memo: (formData.get('memo') as string) || null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/transactions')
  revalidatePath('/')
  revalidatePath('/holdings')
}

export async function createTransaction(formData: FormData) {
  const supabase = await createClient()

  const type = formData.get('type') as string
  const needsAsset = ['buy', 'sell', 'dividend'].includes(type)
  const qty = formData.get('quantity') ? Number(formData.get('quantity')) : null
  const price = formData.get('price') ? Number(formData.get('price')) : null
  const cashAmount = formData.get('cash_amount') ? Number(formData.get('cash_amount')) : null
  const amount = needsAsset && qty && price ? qty * price : cashAmount
  const currency = (formData.get('currency') as string) || 'KRW'

  const { error } = await supabase.from('transactions').insert({
    date: formData.get('date') as string,
    account_id: formData.get('account_id') as string,
    asset_id: (formData.get('asset_id') as string) || null,
    type,
    quantity: qty,
    price,
    amount,
    fee: Number(formData.get('fee') ?? 0),
    currency,
    memo: (formData.get('memo') as string) || null,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath('/holdings')
}

export async function createAssetAndTransaction(formData: FormData) {
  const supabase = await createClient()

  const assetCurrency = (formData.get('asset_currency') as string) || 'KRW'

  // 같은 심볼이 이미 있으면 새로 만들지 않고 기존 것 사용
  const symbol = (formData.get('asset_symbol') as string) || null
  let asset: { id: string } | null = null

  if (symbol) {
    const { data: existing } = await supabase
      .from('assets')
      .select('id')
      .eq('symbol', symbol)
      .maybeSingle()
    asset = existing ?? null
  }

  if (!asset) {
    const { data: newAsset, error: assetErr } = await supabase
      .from('assets')
      .insert({
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
    date: formData.get('date') as string,
    account_id: formData.get('account_id') as string,
    asset_id: asset.id,
    type: formData.get('type') as string,
    quantity: qty,
    price,
    amount: qty * price,
    fee: Number(formData.get('fee') ?? 0),
    currency: assetCurrency,
    memo: (formData.get('memo') as string) || null,
  })
  if (txErr) throw new Error(txErr.message)

  revalidatePath('/')
  revalidatePath('/holdings')
}
