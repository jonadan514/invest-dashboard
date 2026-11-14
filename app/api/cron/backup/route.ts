import { NextResponse } from 'next/server'
import { storeBackup } from '@/lib/backup'
import { isAuthorizedCron } from '@/lib/backup-schedule'
import { getTrustedHouseholdContext } from '@/lib/supabase/server'

// Vercel Cron이 CRON_SECRET을 Authorization: Bearer 헤더로 보낸다.
// 이 경로는 접근 비밀번호 쿠키 대신 그 헤더로만 인증한다(proxy.ts 참고).
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const { supabase, userId } = await getTrustedHouseholdContext()
    const result = await storeBackup(supabase, userId)
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[cron/backup]', error)
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
