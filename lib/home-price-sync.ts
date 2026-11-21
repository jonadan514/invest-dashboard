import 'server-only'

import { isAutoHomePrice, parseAptTrades, pickHomePrice, tradeMonths, type AptTrade } from '@/lib/calc/home-price'
import { currentKstMonth } from '@/lib/mortgage-sync'
import type { createClient } from '@/lib/supabase/server'

type Client = ReturnType<typeof createClient>

// 국토교통부 아파트 매매 실거래가(공공데이터포털). 상세 자료만 신청한 키도 쓸 수 있게 차례로 시도한다.
const ENDPOINTS = [
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
]
const PAGE_SIZE = 1000
const MAX_PAGES = 5

export function homePriceApiKey() {
  return process.env.DATA_GO_KR_API_KEY?.trim() || null
}

/** 공공데이터포털은 인코딩 키와 디코딩 키를 함께 준다. 이미 인코딩된 키(% 포함)는 그대로 쓴다. */
function encodeKey(key: string) {
  return key.includes('%') ? key : encodeURIComponent(key)
}

async function fetchPage(endpoint: string, key: string, lawdCd: string, dealYmd: string, page: number) {
  const url = `${endpoint}?serviceKey=${encodeKey(key)}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&pageNo=${page}&numOfRows=${PAGE_SIZE}`
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  const body = await response.text()
  if (!response.ok && !body.includes('<')) throw new Error(`실거래가 API 응답 ${response.status}`)
  return parseAptTrades(body)
}

async function fetchMonth(key: string, lawdCd: string, dealYmd: string) {
  // 두 서비스가 모두 실패하면 첫 서비스의 오류를 보여 준다(상세 자료를 신청하지 않은 키의 인증 오류가 원래 원인을 가리지 않게).
  let firstError: Error | null = null
  for (const endpoint of ENDPOINTS) {
    try {
      const first = await fetchPage(endpoint, key, lawdCd, dealYmd, 1)
      const trades = [...first.trades]
      const pages = Math.min(MAX_PAGES, Math.ceil(first.totalCount / PAGE_SIZE))
      for (let page = 2; page <= pages; page++) trades.push(...(await fetchPage(endpoint, key, lawdCd, dealYmd, page)).trades)
      return trades
    } catch (error) {
      firstError ??= error as Error
    }
  }
  throw firstError ?? new Error('실거래가를 불러오지 못했어요.')
}

export interface HomePriceResult {
  itemId: string
  month: string
  name: string
  status: 'saved' | 'unchanged' | 'manual' | 'no_trades'
  amount: number | null
  count: number
  latestDate: string | null
  suggestions: string[]
  sameAptFound: boolean
}

interface PriceItem {
  id: string
  name: string
  category: string
  price_lawd_cd: string | null
  price_apt_name: string | null
  price_area: number | null
}

/**
 * 실거래가를 설정한 부동산 항목의 달별 금액을, 그달까지 최근 3개월 같은 단지·면적 거래의 중간값으로 채운다(source = 'price_auto').
 * 기본은 이번 달 하나. 직접 입력한 금액(manual)은 overwriteManual일 때만 바꾸고, 맞는 거래가 없는 달은 기록하지 않아 지난 금액이 이어진다.
 */
export async function syncHomePrices(supabase: Client, userId: string, options: { itemId?: string; months?: string[]; overwriteManual?: boolean } = {}) {
  const key = homePriceApiKey()
  if (!key) throw new Error('실거래가 API 키(DATA_GO_KR_API_KEY)가 설정되지 않았어요.')
  const months = options.months?.length ? options.months : [currentKstMonth()]

  let query = supabase.from('net_worth_items')
    .select('id, name, category, price_lawd_cd, price_apt_name, price_area')
    .eq('user_id', userId).eq('category', 'real_estate').eq('is_active', true)
  if (options.itemId) query = query.eq('id', options.itemId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const items = ((data ?? []) as PriceItem[]).filter(isAutoHomePrice)
  if (items.length === 0) return []

  const { data: existingRows, error: existingError } = await supabase.from('net_worth_snapshots')
    .select('item_id, month, amount, source').eq('user_id', userId).in('month', months).in('item_id', items.map(item => item.id))
  if (existingError) throw new Error(existingError.message)
  const existing = new Map((existingRows ?? []).map(row => [`${row.item_id}:${row.month}`, { amount: Number(row.amount), source: row.source as string }]))

  // 시군구·계약 월마다 한 번만 불러온다. 공공데이터포털에 한꺼번에 몰리지 않게 4개씩 나눠 부른다.
  const fetched = new Map<string, AptTrade[]>()
  const needed = [...new Set(items.flatMap(item => months.flatMap(month => tradeMonths(month).map(ym => `${item.price_lawd_cd}:${ym}`))))]
  for (let index = 0; index < needed.length; index += 4) {
    const chunk = needed.slice(index, index + 4)
    const pages = await Promise.all(chunk.map(entry => { const [lawdCd, ym] = entry.split(':'); return fetchMonth(key, lawdCd, ym) }))
    chunk.forEach((entry, position) => fetched.set(entry, pages[position]))
  }

  const results: HomePriceResult[] = []
  const rows: { user_id: string; item_id: string; month: string; amount: number; source: 'price_auto'; updated_at: string }[] = []
  for (const item of items) {
    for (const month of months) {
      const trades = tradeMonths(month).flatMap(ym => fetched.get(`${item.price_lawd_cd}:${ym}`) ?? [])
      const picked = pickHomePrice(trades, item.price_apt_name!, Number(item.price_area))
      const current = existing.get(`${item.id}:${month}`)
      const base = { itemId: item.id, month, name: item.name, amount: picked.amount, count: picked.count, latestDate: picked.latestDate, suggestions: picked.suggestions, sameAptFound: picked.sameAptFound }
      if (picked.amount === null) { results.push({ ...base, status: 'no_trades' }); continue }
      if (current?.source === 'manual' && !options.overwriteManual) { results.push({ ...base, status: 'manual' }); continue }
      if (current && current.source !== 'manual' && Math.round(current.amount) === picked.amount) { results.push({ ...base, status: 'unchanged' }); continue }
      rows.push({ user_id: userId, item_id: item.id, month, amount: picked.amount, source: 'price_auto', updated_at: new Date().toISOString() })
      results.push({ ...base, status: 'saved' })
    }
  }
  if (rows.length > 0) {
    const { error: saveError } = await supabase.from('net_worth_snapshots').upsert(rows, { onConflict: 'user_id,item_id,month' })
    if (saveError) throw new Error(saveError.message)
  }
  return results
}

/** 매일 도는 작업용. 키가 없거나 실패해도 다른 갱신은 계속한다. */
export async function trySyncHomePrices(supabase: Client, userId: string) {
  if (!homePriceApiKey()) return null
  try {
    return await syncHomePrices(supabase, userId)
  } catch (error) {
    console.error('[home-price-sync]', error)
    return null
  }
}
