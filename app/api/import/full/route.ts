import { NextResponse } from 'next/server'
import { buildBackupOperations } from '@/lib/backup-restore'
import { getHouseholdContext } from '@/lib/supabase/server'

interface BackupPayload {
  format: string
  version: number
  tables: Record<string, unknown>
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 10_000_000) return NextResponse.json({ error: '백업 파일은 10MB 이하여야 합니다.' }, { status: 413 })
  const text = await request.text()
  if (text.length > 10_000_000) return NextResponse.json({ error: '백업 파일은 10MB 이하여야 합니다.' }, { status: 413 })

  let payload: BackupPayload
  try {
    payload = JSON.parse(text) as BackupPayload
  } catch {
    return NextResponse.json({ error: '올바른 JSON 백업 파일이 아닙니다.' }, { status: 400 })
  }
  if (payload.format !== 'invest-dashboard-backup' || payload.version !== 1 || !payload.tables || Array.isArray(payload.tables)) {
    return NextResponse.json({ error: '지원하지 않는 백업 파일 형식입니다.' }, { status: 400 })
  }

  const { supabase, userId } = await getHouseholdContext()
  let operations: ReturnType<typeof buildBackupOperations>
  try {
    operations = buildBackupOperations(payload.tables, userId)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }

  const { data: imported, error } = await supabase.rpc('restore_household_backup', {
    p_user_id: userId,
    p_operations: operations,
  })
  if (error) return NextResponse.json({ error: `복원 실패: ${error.message}` }, { status: 400 })
  return NextResponse.json({ imported: Number(imported ?? 0) })
}
