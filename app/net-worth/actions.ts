'use server'

import { runAction, type ActionResult } from '@/lib/action-result'
import { revalidatePath } from 'next/cache'
import { getHouseholdContext } from '@/lib/supabase/server'
import { syncMortgageSchedule } from '@/lib/mortgage-sync'
import { pickBalances } from '@/lib/calc/net-worth-items'
import { syncHomePrices } from '@/lib/home-price-sync'
import { formatMonth, kstMonth } from '@/lib/labels'

function friendly(message: string) {
  return /price_(lawd_cd|apt_name|area)|price_auto/.test(message)
    ? 'Supabase에 실거래가 칸이 아직 없어요. 안내받은 SQL을 Supabase SQL Editor에서 먼저 실행해 주세요.'
    : message
}

/** 실거래가 조회 조건. 셋 다 비우면 자동 갱신을 끈다. */
function priceTerms(formData: FormData) {
  const lawdCd = String(formData.get('price_lawd_cd') ?? '').trim()
  const aptName = String(formData.get('price_apt_name') ?? '').trim()
  const areaText = String(formData.get('price_area') ?? '').trim()
  if (!lawdCd && !aptName && !areaText) return { price_lawd_cd: null, price_apt_name: null, price_area: null }
  if (!/^\d{5}$/.test(lawdCd)) throw new Error('시군구 코드는 숫자 5자리로 입력해 주세요. 예: 서울 강남구 11680')
  if (!aptName) throw new Error('실거래가에 나오는 단지명을 입력해 주세요.')
  const area = Number(areaText)
  if (!Number.isFinite(area) || area <= 0) throw new Error('전용면적(㎡)을 숫자로 입력해 주세요. 예: 84.97')
  return { price_lawd_cd: lawdCd, price_apt_name: aptName, price_area: area }
}

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

export async function createNetWorthItem(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
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

    const { error: snapshotError } = await supabase.rpc('save_net_worth_snapshot', {
      p_user_id: userId,
      p_month: month,
      p_balances: [{ item_id: item.id, amount: initialAmount }],
    })
    if (snapshotError) {
      await supabase.from('net_worth_items').delete().eq('id', item.id).eq('user_id', userId)
      throw new Error(snapshotError.message)
    }

    await syncMortgageSchedule(supabase, userId)
    revalidatePath('/net-worth')
    revalidatePath('/mortgage')
    revalidatePath('/')
  })
}

export async function saveNetWorthSnapshot(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const month = String(formData.get('month') ?? '')
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 기준 월을 선택해 주세요.')

    const { data: items, error: itemError } = await supabase
      .from('net_worth_items')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
    if (itemError) throw new Error(itemError.message)

    // 폼에 있는 항목만 저장한다. 자동 상환 대출처럼 입력칸이 없는 항목은 그달 기록을 건드리지 않는다.
    const rows = pickBalances((items ?? []).map(item => item.id as string), name => {
      const value = formData.get(name)
      return value === null ? null : String(value)
    })
    if (rows.length === 0) throw new Error('저장할 금액이 없습니다.')

    if (rows.length > 0) {
      const { error } = await supabase.rpc('save_net_worth_snapshot', {
        p_user_id: userId,
        p_month: month,
        p_balances: rows,
      })
      if (error) throw new Error(error.message)
    }

    await syncMortgageSchedule(supabase, userId)
    revalidatePath('/net-worth')
    revalidatePath('/mortgage')
    revalidatePath('/')
  })
}

export async function updateNetWorthItem(id: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const interestRate = optionalNumber(formData, 'interest_rate')
    const monthlyPayment = optionalNumber(formData, 'monthly_payment')
    const startDate = String(formData.get('start_date') ?? '') || null
    const maturityDate = String(formData.get('maturity_date') ?? '') || null
    const owner = String(formData.get('owner') ?? '')
    const category = String(formData.get('category') ?? '')

    if (!['household', 'me', 'spouse'].includes(owner)) throw new Error('올바른 소유자를 선택해 주세요.')
    if (startDate && maturityDate && maturityDate < startDate) throw new Error('만기일은 시작일 이후여야 합니다.')

    const { data: current, error: currentError } = await supabase.from('net_worth_items').select('kind, category').eq('id', id).eq('user_id', userId).single()
    if (currentError) throw new Error(currentError.message)
    const liability = current.kind === 'liability'
    if (category && !(liability ? LIABILITY_CATEGORIES : ASSET_CATEGORIES).has(category)) throw new Error('올바른 분류를 선택해 주세요.')
    // 실거래가 조건은 부동산에만 쓴다. 부동산에서 다른 분류로 바꾸면 비운다.
    const realEstate = (category || current.category) === 'real_estate'
    const empty = { price_lawd_cd: null, price_apt_name: null, price_area: null }
    const price = realEstate
      ? formData.has('price_lawd_cd') ? priceTerms(formData) : {}
      : current.category === 'real_estate' ? empty : {}
    const priceIsEmpty = Object.values(price).every(value => value === null)

    const fields = {
      name: requiredText(formData, 'name'),
      owner,
      ...(category ? { category } : {}),
      // 대출 조건은 부채에만 쓴다. 자산은 비운다.
      interest_rate: liability ? interestRate : null,
      monthly_payment: liability ? monthlyPayment : null,
      start_date: startDate,
      maturity_date: liability ? maturityDate : null,
      updated_at: new Date().toISOString(),
    }
    let { error } = await supabase.from('net_worth_items').update({ ...fields, ...price }).eq('id', id).eq('user_id', userId)
    // SQL을 아직 실행하지 않았어도, 실거래가 칸을 비워 둔 저장은 나머지 정보만 저장한다.
    if (error && priceIsEmpty && Object.keys(price).length > 0 && friendly(error.message) !== error.message) {
      ({ error } = await supabase.from('net_worth_items').update(fields).eq('id', id).eq('user_id', userId))
    }
    if (error) throw new Error(friendly(error.message))

    await syncMortgageSchedule(supabase, userId)
    revalidatePath('/net-worth')
    revalidatePath('/mortgage')
  })
}

export async function setNetWorthItemActive(id: string, active: boolean, month: string): Promise<ActionResult> {
  return runAction(async () => {
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

    await syncMortgageSchedule(supabase, userId)
    revalidatePath('/net-worth')
    revalidatePath('/mortgage')
    revalidatePath('/')
  })
}

/** 한 항목의 한 달 잔액만 저장한다(직접 입력). 자동 상환 대출은 이 값을 기준으로 다시 계산한다. */
export async function saveItemBalance(itemId: string, month: string, amountText: string): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 달을 선택해 주세요.')
    const [row] = pickBalances([itemId], () => amountText)
    const { error } = await supabase.rpc('save_net_worth_snapshot', { p_user_id: userId, p_month: month, p_balances: [row] })
    if (error) throw new Error(error.message)
    await syncMortgageSchedule(supabase, userId)
    revalidatePath('/net-worth')
    revalidatePath('/mortgage')
    revalidatePath('/')
  })
}

/** 직접 입력한 한 달 잔액을 지운다. 자동 상환 잔액은 남은 기록을 기준으로 다시 계산한다. */
export async function deleteItemBalance(itemId: string, month: string): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 달을 선택해 주세요.')
    const { count, error: countError } = await supabase.from('net_worth_snapshots').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('item_id', itemId).eq('source', 'manual')
    if (countError) throw new Error(countError.message)
    if ((count ?? 0) <= 1) throw new Error('마지막 남은 잔액 기록은 지울 수 없어요. 금액을 고쳐 주세요.')
    const { error } = await supabase.from('net_worth_snapshots').delete()
      .eq('user_id', userId).eq('item_id', itemId).eq('month', month).eq('source', 'manual')
    if (error) throw new Error(error.message)
    // 지운 기준점으로 계산된 자동 잔액을 비우고 남은 기준점으로 다시 채운다.
    const { error: autoError } = await supabase.from('net_worth_snapshots').delete()
      .eq('user_id', userId).eq('item_id', itemId).eq('source', 'mortgage_auto')
    if (autoError) throw new Error(autoError.message)
    const { error: recomputeError } = await supabase.rpc('recompute_mortgage_snapshots', { p_user_id: userId })
    if (recomputeError) throw new Error(recomputeError.message)
    await syncMortgageSchedule(supabase, userId)
    revalidatePath('/net-worth')
    revalidatePath('/mortgage')
    revalidatePath('/')
  })
}

/** 부동산 한 항목의 이번 달 금액을 지금 실거래가로 불러온다. 결과를 문장으로 돌려준다. */
export async function refreshHomePrice(itemId: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const { supabase, userId } = await getHouseholdContext()
    const month = kstMonth()
    let results
    try {
      results = await syncHomePrices(supabase, userId, { itemId, month })
    } catch (error) {
      throw new Error(friendly((error as Error).message))
    }
    const result = results[0]
    if (!result) throw new Error('시군구 코드·단지명·전용면적을 먼저 저장해 주세요.')
    revalidatePath('/net-worth')
    revalidatePath('/')
    const won = (value: number) => `${Math.round(value / 10_000).toLocaleString('ko-KR')}만 원`
    if (result.status === 'no_trades') {
      const hint = result.sameAptFound
        ? ` 이 단지의 거래 면적: ${result.suggestions.join(', ')}`
        : result.suggestions.length > 0 ? ` 비슷한 단지명: ${result.suggestions.join(', ')}` : ' 단지명이 실거래가 자료와 같은지 확인해 주세요.'
      return { message: `최근 3개월 맞는 거래가 없어 지난 금액을 그대로 둬요.${hint}` }
    }
    const summary = `최근 3개월 ${result.count}건 중간값 ${won(result.amount!)} (마지막 거래 ${result.latestDate})`
    if (result.status === 'manual') return { message: `${summary}. ${formatMonth(month)}은 직접 입력한 금액이 있어 바꾸지 않았어요.` }
    return { message: `${summary}${result.status === 'saved' ? `으로 ${formatMonth(month)} 금액을 저장했어요.` : ', 이미 같은 금액이에요.'}` }
  })
}
