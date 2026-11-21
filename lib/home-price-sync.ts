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
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  const body = await response.text()
  if (!response.ok && !body.includes('<')) throw new Error(`실거래가 API 응답 ${response.status}`)
  return parseAptTrades(body)
}

async function fetchMonth(key: string, lawdCd: string, dealYmd: string) {
  let lastError: Error | null = null
  for (const endpoint of ENDPOINTS) {
    try {
      const first = await fetchPage(endpoint, key, lawdCd, dealYmd, 1)
      const trades = [...first.trades]
      const pages = Math.min(MAX_PAGES, Math.ceil(first.totalCount / PAGE_SIZE))
      for (let page = 2; page <= pages; page++) trades.push(...(await fetchPage(endpoint, key, lawdCd, dealYmd, page)).trades)
      return trades
    } catch (error) {
      lastError = error as Error
    }
  }
  throw lastError ?? new Error('실거래가를 불러오지 못했어요.')
}

export interface HomePriceResult {
  itemId: string
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
 * 실거래가를 설정한 부동산 항목의 이번 달 금액을 최근 3개월 같은 단지·면적 거래의 중간값으로 채운다(source = 'price_auto').
 * 그달 직접 입력한 금액(manual)은 덮어쓰지 않고, 맞는 거래가 없으면 기록하지 않아 지난 금액이 이어진다.
 */
export async function syncHomePrices(supabase: Client, userId: string, options: { itemId?: string; month?: string } = {}) {
  const key = homePriceApiKey()
  if (!key) throw new Error('실거래가 API 키(DATA_GO_KR_API_KEY)가 설정되지 않았어요.')
  const month = options.month ?? currentKstMonth()

  let query = supabase.from('net_worth_items')
    .select('id, name, category, price_lawd_cd, price_apt_name, price_area')
    .eq('user_id', userId).eq('category', 'real_estate').eq('is_active', true)
  if (options.itemId) query = query.eq('id', options.itemId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const items = ((data ?? []) as PriceItem[]).filter(isAutoHomePrice)
  if (items.length === 0) return []

  const { data: existingRows, error: existingError } = await supabase.from('net_worth_snapshots')
    .select('item_id, amount, source').eq('user_id', userId).eq('month', month).in('item_id', items.map(item => item.id))
  if (existingError) throw new Error(existingError.message)
  const existing = new Map((existingRows ?? []).map(row => [row.item_id as string, { amount: Number(row.amount), source: row.source as string }]))

  // 같은 시군구는 한 번만 불러온다.
  const tradesByRegion = new Map<string, AptTrade[]>()
  for (const lawdCd of new Set(items.map(item => item.price_lawd_cd!))) {
    const months = await Promise.all(tradeMonths(month).map(ym => fetchMonth(key, lawdCd, ym)))
    tradesByRegion.set(lawdCd, months.flat())
  }

  const results: HomePriceResult[] = []
  for (const item of items) {
    const picked = pickHomePrice(tradesByRegion.get(item.price_lawd_cd!) ?? [], item.price_apt_name!, Number(item.price_area))
    const current = existing.get(item.id)
    const base = { itemId: item.id, name: item.name, amount: picked.amount, count: picked.count, latestDate: picked.latestDate, suggestions: picked.suggestions, sameAptFound: picked.sameAptFound }
    if (picked.amount === null) { results.push({ ...base, status: 'no_trades' }); continue }
    if (current?.source === 'manual') { results.push({ ...base, status: 'manual' }); continue }
    if (current && Math.round(current.amount) === picked.amount) { results.push({ ...base, status: 'unchanged' }); continue }
    const { error: saveError } = await supabase.from('net_worth_snapshots').upsert({
      user_id: userId, item_id: item.id, month, amount: picked.amount, source: 'price_auto', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,item_id,month' })
    if (saveError) throw new Error(saveError.message)
    results.push({ ...base, status: 'saved' })
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
