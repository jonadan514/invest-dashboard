import { NextResponse } from 'next/server'
import { collectBackup } from '@/lib/backup'
import { getHouseholdContext } from '@/lib/supabase/server'

export async function GET() {
  const { supabase, userId } = await getHouseholdContext()
  const payload = await collectBackup(supabase, userId)
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="invest-dashboard-backup-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
