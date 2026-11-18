import { getHouseholdContext } from '@/lib/supabase/server'
import type { HouseholdGoal, HouseholdSettings } from '@/lib/types'
import { listBackups, type StoredBackup } from '@/lib/backup'
import { BACKUP_KEEP_COUNT, backupLabel } from '@/lib/backup-schedule'
import BackupNowButton from './BackupNowButton'
import SettingsClient from './SettingsClient'

export const metadata = { title: '설정' }

export default async function SettingsPage() {
  const { supabase, userId } = await getHouseholdContext()
  const [{ data: settingsRow }, { data: goalRows }] = await Promise.all([
    supabase.from('household_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('household_goals').select('*').eq('user_id', userId).order('sort_order').order('created_at').throwOnError(),
  ])
  const settings = settingsRow as HouseholdSettings | null
  const goals = (goalRows ?? []) as HouseholdGoal[]
  let backups: StoredBackup[] = []
  let backupError: string | null = null
  try {
    backups = await listBackups()
  } catch (error) {
    backupError = (error as Error).message
  }
  const cronConfigured = (process.env.CRON_SECRET ?? '').length >= 16
  const renderKey = `${settings?.updated_at ?? 'new'}-${goals.map(goal => goal.updated_at).join('-')}`

  return (
    <>
      <div className="page-container max-w-[1240px]">
        <header className="mb-5">
          <p className="page-eyebrow">Household settings</p>
          <h1 className="page-title">설정</h1>
          <p className="page-subtitle">가계 목표, 월 소득과 전체 데이터 백업을 관리합니다.</p>
        </header>
        <SettingsClient
          key={renderKey}
          initialSettings={{
            monthlyIncome: Number(settings?.monthly_income ?? 0),
          }}
          initialGoals={goals}
          canImportLegacy={!settings && goals.length === 0}
          backupPanel={<AutoBackupSection backups={backups} error={backupError} cronConfigured={cronConfigured} />}
        />
      </div>
    </>
  )
}

function AutoBackupSection({ backups, error, cronConfigured }: { backups: StoredBackup[]; error: string | null; cronConfigured: boolean }) {
  return (
    <section className="app-card p-5" id="auto-backup">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-sm font-semibold">자동 백업</h2>
          <p className="mt-1 text-[11.5px] leading-5 text-[var(--color-muted)]">
            매주 월요일 새벽 3시경(한국 시간) 전체 데이터를 Supabase 비공개 저장공간에 보관하고, 최근 {BACKUP_KEEP_COUNT}개만 남깁니다.
            내려받은 파일은 위의 <strong>백업 복원</strong>으로 되돌릴 수 있습니다.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${cronConfigured ? 'bg-[var(--color-positive-soft)] text-[var(--color-positive-strong)]' : 'bg-[var(--color-negative-soft)] text-[var(--color-negative-strong)]'}`}>
          {cronConfigured ? '자동 실행 켜짐' : '자동 실행 설정 필요'}
        </span>
      </div>
      {!cronConfigured ? (
        <p className="mt-3 rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[12.5px] leading-5 text-[var(--color-negative-strong)]">
          Vercel 프로젝트 환경변수에 16자 이상의 <code>CRON_SECRET</code>을 추가하고 다시 배포해야 매주 자동으로 실행됩니다. 그 전에도 아래 버튼으로 직접 백업할 수 있습니다.
        </p>
      ) : null}

      <div className="mt-4"><BackupNowButton /></div>

      {error ? (
        <p className="mt-4 text-[12.5px] text-[var(--color-negative)]">{error}</p>
      ) : backups.length === 0 ? (
        <p className="mt-4 py-3 text-center text-[12.5px] text-[var(--color-muted)]">아직 저장된 백업이 없습니다.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white/55">
          {backups.map((backup, index) => (
            <li key={backup.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]">
              <span className="tabular-nums">
                {backupLabel(backup.name)}
                {index === 0 ? <span className="ml-2 rounded-full bg-[var(--color-section)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-muted)]">최신</span> : null}
              </span>
              <span className="flex items-center gap-3">
                {backup.size !== null ? <span className="text-[11.5px] tabular-nums text-[var(--color-subtle)]">{Math.max(1, Math.round(backup.size / 1024))}KB</span> : null}
                <a href={`/api/backups/${backup.name}`} className="inline-flex min-h-8 items-center font-semibold text-[var(--color-primary)] hover:underline">다운로드</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
