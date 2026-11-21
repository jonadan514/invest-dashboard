import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/backup-schedule'
import { refreshQuotes } from '@/lib/quote-refresh'
import { syncCurrentMonthStockValues } from '@/lib/stock-sync'
import { trySyncMortgageSchedule } from '@/lib/mortgage-sync'
import { trySyncHomePrices } from '@/lib/home-price-sync'
import { getTrustedHouseholdContext } from '@/lib/supabase/server'

// 매일 미국 장 마감 뒤(06:40 KST) 현재가·환율을 갱신하고, 설정하면 월간 평가액도 맞춘다. 인증은 백업과 같은 CRON_SECRET.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const { supabase, userId } = await getTrustedHouseholdContext()
    const result = await refreshQuotes(supabase, userId)
    // 새 달이 되면 기록이 없는 달의 주담대 잔액을 채운다(화면을 열 때마다 하지 않도록 하루 한 번).
    await trySyncMortgageSchedule(supabase, userId)
    // 실거래가를 설정한 부동산은 이번 달 금액을 최근 3개월 실거래가로 맞춘다(직접 입력한 달은 그대로). 키가 없으면 건너뛴다.
    const homePrices = await trySyncHomePrices(supabase, userId)
    // 환경 변수 STOCK_VALUE_AUTO_SYNC=true 일 때만, 이번 달 월간 기록이 있는 계좌의 평가액을 보유종목 평가액으로 맞춘다.
    const synced = process.env.STOCK_VALUE_AUTO_SYNC === 'true' ? await syncCurrentMonthStockValues(supabase, userId) : null
    return NextResponse.json({ ok: true, ...result, syncedAccounts: synced?.length ?? null, homePrices: homePrices?.map(row => row.status) ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[cron/prices]', error)
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
