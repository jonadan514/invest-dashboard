import { NextResponse } from 'next/server'
import { downloadBackup } from '@/lib/backup'
import { getHouseholdContext } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  await getHouseholdContext()
  const { name } = await params
  const body = await downloadBackup(name)
  if (body === null) return NextResponse.json({ error: '백업을 찾을 수 없습니다.' }, { status: 404 })
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="invest-dashboard-${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}
