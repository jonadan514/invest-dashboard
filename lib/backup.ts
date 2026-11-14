import 'server-only'

import { BACKUP_KEEP_COUNT, backupFileName, backupsToDelete, isBackupFileName } from '@/lib/backup-schedule'
import { createBackupStorage, type createClient } from '@/lib/supabase/server'

export const BACKUP_TABLES = [
  'accounts',
  'assets',
  'transactions',
  'balances',
  'monthly_budgets',
  'account_monthly_snapshots',
  'financial_plan_settings',
  'net_worth_items',
  'net_worth_snapshots',
  'portfolio_snapshots',
  'household_settings',
  'household_goals',
  'children',
  'child_accounts',
  'child_gift_deposits',
  'child_account_monthly_snapshots',
] as const

type Client = ReturnType<typeof createClient>

/** 설정 화면의 '전체 백업 다운로드'와 같은 형식(invest-dashboard-backup v1)의 백업을 만든다. */
export async function collectBackup(supabase: Client, userId: string) {
  const results = await Promise.all(BACKUP_TABLES.map(table => supabase.from(table).select('*').eq('user_id', userId).throwOnError()))
  const tables: Record<string, unknown[]> = {}
  BACKUP_TABLES.forEach((table, index) => { tables[table] = results[index].data ?? [] })
  return {
    format: 'invest-dashboard-backup',
    version: 1,
    generated_at: new Date().toISOString(),
    tables,
  }
}

export interface StoredBackup {
  name: string
  size: number | null
}

async function ensureBucket() {
  const { storage, bucket } = createBackupStorage()
  const { data, error } = await storage.getBucket(bucket)
  if (data && !error) {
    if (data.public) throw new Error(`백업 버킷(${bucket})이 공개 상태입니다. Supabase에서 비공개로 바꿔 주세요.`)
    return { storage, bucket }
  }
  const created = await storage.createBucket(bucket, { public: false })
  if (created.error && !/already exists/i.test(created.error.message)) throw new Error(`백업 버킷을 만들지 못했습니다: ${created.error.message}`)
  return { storage, bucket }
}

/** 백업을 비공개 버킷에 저장하고, 최신 BACKUP_KEEP_COUNT개만 남긴다. */
export async function storeBackup(supabase: Client, userId: string, now = new Date()) {
  const payload = await collectBackup(supabase, userId)
  const { storage, bucket } = await ensureBucket()
  const name = backupFileName(now)
  const body = JSON.stringify(payload)
  const uploaded = await storage.from(bucket).upload(name, new Blob([body], { type: 'application/json' }), {
    contentType: 'application/json',
    upsert: false,
  })
  if (uploaded.error) throw new Error(`백업을 저장하지 못했습니다: ${uploaded.error.message}`)

  const existing = await listBackups()
  const stale = backupsToDelete(existing.map(item => item.name), BACKUP_KEEP_COUNT)
  if (stale.length > 0) {
    const removed = await storage.from(bucket).remove(stale)
    if (removed.error) throw new Error(`오래된 백업을 정리하지 못했습니다: ${removed.error.message}`)
  }
  return { name, bytes: body.length, deleted: stale }
}

/** 저장된 백업 목록(최신 먼저). 버킷이 아직 없으면 빈 목록. */
export async function listBackups(): Promise<StoredBackup[]> {
  const { storage, bucket } = createBackupStorage()
  const { data, error } = await storage.from(bucket).list('', { limit: 100, sortBy: { column: 'name', order: 'desc' } })
  if (error) {
    if (/not found/i.test(error.message)) return []
    throw new Error(`백업 목록을 읽지 못했습니다: ${error.message}`)
  }
  return (data ?? [])
    .filter(item => isBackupFileName(item.name))
    .map(item => ({ name: item.name, size: typeof item.metadata?.size === 'number' ? item.metadata.size : null }))
    .sort((a, b) => b.name.localeCompare(a.name))
}

export async function downloadBackup(name: string) {
  if (!isBackupFileName(name)) return null
  const { storage, bucket } = createBackupStorage()
  const { data, error } = await storage.from(bucket).download(name)
  if (error || !data) return null
  return data.text()
}
