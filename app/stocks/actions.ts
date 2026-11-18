'use server'

import { runAction, type ActionResult } from '@/lib/action-result'
import { revalidatePath } from 'next/cache'
import { buildPriceUpdates } from '@/lib/stock-prices'
import { getHouseholdContext } from '@/lib/supabase/server'
import { buildNewAsset, buildTransactionInsert, buildTransactionUpdate } from '@/lib/transaction-edit'
import { assertAssetDeletable, buildAssetUpdate } from '@/lib/asset-edit'

type HouseholdClient = Awaited<ReturnType<typeof getHouseholdContext>>['supabase']

function revalidateStocks() {
  revalidatePath('/stocks')
  revalidatePath('/')
}

async function loadOwnedAccount(supabase: HouseholdClient, userId: string, formData: FormData) {
  const accountId = formData.get('account_id')
  if (typeof accountId !== 'string' || !accountId) return null
  const { data, error } = await supabase.from('accounts').select('id, user_id')
    .eq('id', accountId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** 매수·매도·배당 등록. asset_id가 'new'면 같은 요청에서 종목을 새로 만든다(같은 코드가 있으면 재사용). */
export async function createTrade(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const account = await loadOwnedAccount(supabase, userId, formData)

    let asset: { id: string; currency: string; user_id: string } | null = null
    if (formData.get('asset_id') === 'new') {
      const newAsset = buildNewAsset(userId, formData)
      // 종목을 만들기 전에 거래 입력부터 검증해, 잘못된 입력으로 빈 종목이 남지 않게 한다.
      buildTransactionInsert(account, { currency: newAsset.currency }, userId, formData)
      if (newAsset.symbol) {
        const { data, error } = await supabase.from('assets').select('id, currency, user_id')
          .eq('symbol', newAsset.symbol).eq('user_id', userId).maybeSingle()
        if (error) throw new Error(error.message)
        asset = data
      }
      if (!asset) {
        const { data, error } = await supabase.from('assets').insert(newAsset).select('id, currency, user_id').single()
        if (error) throw new Error(error.message)
        asset = data
      }
      formData.set('asset_id', asset!.id)
    } else {
      const assetId = formData.get('asset_id')
      if (typeof assetId === 'string' && assetId) {
        const { data, error } = await supabase.from('assets').select('id, currency, user_id')
          .eq('id', assetId).eq('user_id', userId).maybeSingle()
        if (error) throw new Error(error.message)
        asset = data
      }
    }

    const insert = buildTransactionInsert(account, asset, userId, formData)
    if (!insert.asset_id) throw new Error('종목을 선택해 주세요.')
    const { error } = await supabase.from('transactions').insert(insert)
    if (error) throw new Error(error.message)
    revalidateStocks()
  })
}

export async function updateTrade(id: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const { data: stored, error: readError } = await supabase.from('transactions')
      .select('type, asset_id, currency, user_id').eq('id', id).eq('user_id', userId).maybeSingle()
    if (readError) throw new Error(readError.message)
    let asset = null
    const newAssetId = formData.get('new_asset_id')
    const assetId = typeof newAssetId === 'string' && newAssetId ? newAssetId : stored?.asset_id
    if (stored?.asset_id && assetId) {
      const { data, error } = await supabase.from('assets').select('id, currency, user_id')
        .eq('id', assetId).eq('user_id', userId).maybeSingle()
      if (error) throw new Error(error.message)
      asset = data
    }
    const update = buildTransactionUpdate(stored, asset, userId, formData)
    const { data: updated, error } = await supabase.from('transactions').update(update)
      .eq('id', id).eq('user_id', userId).select('id').maybeSingle()
    if (error) throw new Error(error.message)
    if (!updated) throw new Error('수정할 거래를 찾을 수 없습니다.')
    revalidateStocks()
  })
}

export async function deleteTrade(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new Error(error.message)
    revalidateStocks()
  })
}

/** 현재가·원/달러 환율을 직접 입력해 저장한다. */
export async function savePrices(formData: FormData): Promise<ActionResult<{ saved: number }>> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const { data: assets, error: assetError } = await supabase.from('assets').select('id, currency').eq('user_id', userId)
    if (assetError) throw new Error(assetError.message)
    const { prices, usdKrw } = buildPriceUpdates(formData, assets ?? [])
    if (prices.length > 0) {
      const { error } = await supabase.from('prices').upsert(prices.map(row => ({ ...row, prev_close: null })), { onConflict: 'asset_id' })
      if (error) throw new Error(error.message)
    }
    if (usdKrw !== null) {
      const { error } = await supabase.from('fx_rates').upsert({ pair: 'USDKRW', rate: usdKrw, as_of: new Date().toISOString() }, { onConflict: 'pair' })
      if (error) throw new Error(error.message)
    }
    revalidateStocks()
    return { saved: prices.length + (usdKrw !== null ? 1 : 0) }
  })
}

async function assetHasTransactions(supabase: HouseholdClient, userId: string, assetId: string) {
  const { data, error } = await supabase.from('transactions').select('id').eq('user_id', userId).eq('asset_id', assetId).limit(1)
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

async function loadOwnedAsset(supabase: HouseholdClient, userId: string, id: string) {
  const { data, error } = await supabase.from('assets').select('id, user_id, currency').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** 종목 이름·코드·구분 수정. 원화↔달러가 바뀌면 그 통화로 저장된 현재가는 지운다. */
export async function updateAsset(id: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const stored = await loadOwnedAsset(supabase, userId, id)
    const rawSymbol = formData.get('symbol')
    const symbol = typeof rawSymbol === 'string' ? rawSymbol.trim() : ''
    let duplicateSymbol = false
    if (symbol) {
      const { data, error } = await supabase.from('assets').select('id').eq('user_id', userId).eq('symbol', symbol)
      if (error) throw new Error(error.message)
      duplicateSymbol = (data ?? []).some(row => row.id !== id)
    }
    const hasTransactions = stored ? await assetHasTransactions(supabase, userId, id) : false
    const { currencyChanged, ...update } = buildAssetUpdate(stored, userId, formData, { hasTransactions, duplicateSymbol })
    const { error } = await supabase.from('assets').update(update).eq('id', id).eq('user_id', userId)
    if (error) throw new Error(error.message)
    if (currencyChanged) {
      const { error: priceError } = await supabase.from('prices').delete().eq('asset_id', id)
      if (priceError) throw new Error(priceError.message)
    }
    revalidateStocks()
  })
}

/** 거래가 하나도 없는 종목만 지운다. 저장된 현재가는 함께 지워진다. */
export async function deleteAsset(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const stored = await loadOwnedAsset(supabase, userId, id)
    assertAssetDeletable(stored, userId, stored ? await assetHasTransactions(supabase, userId, id) : false)
    const { error: priceError } = await supabase.from('prices').delete().eq('asset_id', id)
    if (priceError) throw new Error(priceError.message)
    const { error } = await supabase.from('assets').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new Error(error.message)
    revalidateStocks()
  })
}
