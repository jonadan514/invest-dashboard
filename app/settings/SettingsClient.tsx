'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { krw } from '@/lib/labels'
import type { HouseholdGoal } from '@/lib/types'
import {
  deleteHouseholdGoal,
  migrateLegacySettings,
  saveHouseholdGoal,
  saveHouseholdSettings,
  setGoalAchieved,
} from './actions'

interface Props {
  initialSettings: { monthlyIncome: number }
  initialGoals: HouseholdGoal[]
  canImportLegacy: boolean
  /** 서버에서 그린 자동 백업 영역. 데이터 관리 열의 아래에 놓인다. */
  backupPanel?: ReactNode
}

export default function SettingsClient({ initialSettings, initialGoals, canImportLegacy, backupPanel }: Props) {
  const router = useRouter()
  const importRef = useRef<HTMLInputElement>(null)
  const [monthlyIncome, setMonthlyIncome] = useState(initialSettings.monthlyIncome)
  const [editingGoal, setEditingGoal] = useState<HouseholdGoal | null>(null)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!canImportLegacy || localStorage.getItem('supabase_settings_migrated') === '1') return
    let goals: Array<Record<string, unknown>> = []
    try { goals = JSON.parse(localStorage.getItem('goals') ?? '[]') } catch {}
    const monthlyIncome = Number(localStorage.getItem('monthly_income') ?? 0)
    if (goals.length === 0 && monthlyIncome === 0) return

    startTransition(async () => {
      try {
        await migrateLegacySettings({ monthlyIncome, goals })
        localStorage.setItem('supabase_settings_migrated', '1')
        router.refresh()
      } catch {
        setMessage('이 기기의 기존 설정을 자동 이전하지 못했습니다.')
      }
    })
  }, [canImportLegacy, router])

  function saveSettings() {
    setMessage(null)
    startTransition(async () => {
      try {
        await saveHouseholdSettings({ monthlyIncome })
        setMessage('가계 설정을 Supabase에 저장했습니다.')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.')
      }
    })
  }

  function goalAction(action: () => Promise<void>, success: string) {
    setMessage(null)
    startTransition(async () => {
      try {
        await action()
        setEditingGoal(null)
        setShowGoalForm(false)
        setMessage(success)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '목표를 변경하지 못했습니다.')
      }
    })
  }

  async function restoreBackup(file: File) {
    if (!confirm('백업 파일의 데이터를 현재 데이터에 병합할까요? 같은 항목은 백업 값으로 갱신됩니다.')) return
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/import/full', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await file.text() })
        const result = await response.json() as { error?: string; imported?: number }
        if (!response.ok) throw new Error(result.error ?? '복원에 실패했습니다.')
        setMessage(`전체 백업을 복원했습니다. ${result.imported ?? 0}개 기록을 확인했습니다.`)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '복원에 실패했습니다.')
      } finally {
        if (importRef.current) importRef.current.value = ''
      }
    })
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-[var(--color-primary)]" role="status">{message}</p> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4">
      <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">가계 설정</p>
      <section className="app-card p-5">
        <h2 className="text-sm font-semibold">월 소득</h2>
        <p className="mt-1 text-[11.5px] text-[var(--color-muted)]">대시보드 저축률 계산에 사용합니다. 실제로 들어오는 부부 합산 세후 월급을 입력하세요. 성과급은 월간 기록에 따로 입력합니다.</p>
        <div className="mt-3 flex items-center gap-2">
          <input value={monthlyIncome > 0 ? formatNumber(monthlyIncome) : ''} onChange={event => setMonthlyIncome(parseNumber(event.target.value))} inputMode="numeric" className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-right text-sm" />
          <span className="text-xs text-[var(--color-muted)]">원</span>
        </div>
        <button type="button" onClick={saveSettings} disabled={pending} className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          {pending ? '저장 중…' : '설정 저장'}
        </button>
      </section>

      <section className="app-card p-5" id="goals">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold">목표 마일스톤</h2><p className="mt-1 text-[11.5px] text-[var(--color-muted)]">첫 번째 미달성 목표가 대시보드에 표시됩니다.</p></div>
          <button type="button" onClick={() => { setEditingGoal(null); setShowGoalForm(current => !current) }} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white">＋ 목표</button>
        </div>
        {showGoalForm ? <GoalForm initial={editingGoal} nextOrder={initialGoals.length} pending={pending} onSave={input => goalAction(() => saveHouseholdGoal(input), '목표를 저장했습니다.')} onCancel={() => { setShowGoalForm(false); setEditingGoal(null) }} /> : null}
        <div className="mt-4 space-y-2">
          {initialGoals.length === 0 ? <p className="py-4 text-center text-xs text-[var(--color-muted)]">등록된 목표가 없습니다.</p> : null}
          {initialGoals.map(goal => (
            <div key={goal.id} className={`rounded-xl border border-[var(--color-border)] px-4 py-3 ${goal.achieved_at ? 'opacity-55' : 'bg-white/55'}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div><p className="text-xs font-semibold">{goal.name} {goal.achieved_at ? '✓' : ''}</p><p className="mt-1 text-[11.5px] text-[var(--color-muted)]">{goal.statement} · 목표 {krw(Number(goal.target))}</p></div>
                <div className="flex shrink-0 gap-1.5 text-[12.5px] font-semibold">
                  <button type="button" className="min-h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5" onClick={() => { setEditingGoal(goal); setShowGoalForm(true) }}>수정</button>
                  <button type="button" className="min-h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[var(--color-primary)]" onClick={() => goalAction(() => setGoalAchieved(goal.id, !goal.achieved_at), goal.achieved_at ? '달성을 취소했습니다.' : '목표를 달성 처리했습니다.')}>{goal.achieved_at ? '되돌리기' : '달성'}</button>
                  <button type="button" className="min-h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[var(--color-negative)]" onClick={() => { if (confirm('이 목표를 삭제할까요?')) goalAction(() => deleteHouseholdGoal(goal.id), '목표를 삭제했습니다.') }}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      </div>

      <div className="space-y-4">
      <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">데이터 관리</p>
      <section className="app-card p-5">
        <h2 className="text-sm font-semibold">전체 데이터 백업·복원</h2>
        <p className="mt-1 text-[11.5px] leading-5 text-[var(--color-muted)]">금융계좌, 거래, 월간 기록, 밸런스 시트, 목표와 설정을 하나의 JSON 파일로 보관합니다.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/export/full" className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold text-white">전체 백업 다운로드</a>
          <button type="button" onClick={() => importRef.current?.click()} disabled={pending} className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-xs font-semibold">백업 복원</button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void restoreBackup(file) }} />
          <a href="/api/export/transactions" className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-xs">거래 CSV</a>
        </div>
      </section>
      {backupPanel}
      </div>
      </div>
    </div>
  )
}

function GoalForm({ initial, nextOrder, pending, onSave, onCancel }: { initial: HouseholdGoal | null; nextOrder: number; pending: boolean; onSave: (input: Parameters<typeof saveHouseholdGoal>[0]) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [statement, setStatement] = useState(initial?.statement ?? '')
  const [type, setType] = useState<HouseholdGoal['type']>(initial?.type ?? 'cash')
  const [target, setTarget] = useState(Number(initial?.target ?? 0))
  return (
    <form onSubmit={event => { event.preventDefault(); onSave({ id: initial?.id, name, statement, sub: initial?.sub ?? '', type, target, nextHint: initial?.next_hint ?? '', sortOrder: initial?.sort_order ?? nextOrder }) }} className="mt-4 rounded-xl border border-[var(--color-border)] bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input aria-label="목표 이름" required value={name} onChange={event => setName(event.target.value)} placeholder="목표 이름" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs" />
        <select aria-label="목표 유형" value={type} onChange={event => setType(event.target.value as HouseholdGoal['type'])} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs"><option value="cash">현금</option><option value="investment">투자</option><option value="net_worth">순자산</option><option value="other">기타</option></select>
        <input aria-label="목표 문장" required value={statement} onChange={event => setStatement(event.target.value)} placeholder="목표 문장" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs sm:col-span-2" />
        <input aria-label="목표 금액" required inputMode="numeric" value={target > 0 ? formatNumber(target) : ''} onChange={event => setTarget(parseNumber(event.target.value))} placeholder="목표 금액" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-right text-xs" />
        <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="px-3 text-xs">취소</button><button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white">저장</button></div>
      </div>
    </form>
  )
}

function parseNumber(value: string) { return Number(value.replace(/[^0-9]/g, '')) || 0 }
function formatNumber(value: number) { return new Intl.NumberFormat('ko-KR').format(Math.round(value)) }
