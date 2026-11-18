import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/backup-schedule'
import { refreshQuotes } from '@/lib/quote-refresh'
import { getTrustedHouseholdContext } from '@/lib/supabase/server'

// 매일 미국 장 마감 뒤(06:40 KST) 현재가·환율을 갱신한다. 인증은 백업과 같은 CRON_SECRET.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const { supabase, userId } = await getTrustedHouseholdContext()
    const result = await refreshQuotes(supabase, userId)
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[cron/prices]', error)
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
