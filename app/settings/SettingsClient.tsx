'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ALLOCATION_CLASSES, DEFAULT_TARGET_ALLOCATION } from '@/lib/settings'
import type { HouseholdGoal } from '@/lib/types'
import {
  deleteHouseholdGoal,
  migrateLegacySettings,
  saveHouseholdGoal,
  saveHouseholdSettings,
  setGoalAchieved,
} from './actions'

interface Props {
  initialSettings: { monthlyIncome: number; targetAllocation: Record<string, number> }
  initialGoals: HouseholdGoal[]
  canImportLegacy: boolean
}

export default function SettingsClient({ initialSettings, initialGoals, canImportLegacy }: Props) {
  const router = useRouter()
  const importRef = useRef<HTMLInputElement>(null)
  const [allocation, setAllocation] = useState(initialSettings.targetAllocation)
  const [monthlyIncome, setMonthlyIncome] = useState(initialSettings.monthlyIncome)
  const [editingGoal, setEditingGoal] = useState<HouseholdGoal | null>(null)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const total = Object.values(allocation).reduce((sum, value) => sum + value, 0)

  useEffect(() => {
    if (!canImportLegacy || localStorage.getItem('supabase_settings_migrated') === '1') return
    let targetAllocation: Record<string, number> | null = null
    let goals: Array<Record<string, unknown>> = []
    try { targetAllocation = JSON.parse(localStorage.getItem('target_allocation') ?? 'null') } catch {}
    try { goals = JSON.parse(localStorage.getItem('goals') ?? '[]') } catch {}
    const monthlyIncome = Number(localStorage.getItem('monthly_income') ?? 0)
    if (!targetAllocation && goals.length === 0 && monthlyIncome === 0) return

    startTransition(async () => {
      try {
        await migrateLegacySettings({ monthlyIncome, targetAllocation, goals })
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
        await saveHouseholdSettings({ monthlyIncome, targetAllocation: allocation })
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
    <div className="space-y-5">
      <section className="app-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-sm font-semibold">목표 자산배분</h2><p className="mt-1 text-[10px] text-[var(--color-muted)]">5%p 이상 벗어나면 대시보드에 표시합니다.</p></div>
          <span className={`text-sm font-bold ${Math.abs(total - 100) < 0.001 ? 'text-[var(--color-primary)]' : 'text-red-600'}`}>{total}%</span>
        </div>
        <div className="mt-4 space-y-3">
          {ALLOCATION_CLASSES.map(item => (
            <div key={item.key} className="flex items-center gap-3">
              <label htmlFor={`allocation-${item.key}`} className="w-16 shrink-0 text-xs">{item.label}</label>
              <input id={`allocation-${item.key}`} type="range" min="0" max="100" value={allocation[item.key] ?? 0} onChange={event => setAllocation(current => ({ ...current, [item.key]: Number(event.target.value) }))} className="h-1.5 flex-1 accent-[var(--color-primary)]" />
              <input aria-label={`${item.label} 목표 비율`} type="number" min="0" max="100" value={allocation[item.key] ?? 0} onChange={event => setAllocation(current => ({ ...current, [item.key]: Number(event.target.value) }))} className="w-14 rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-right text-xs" />
              <span className="text-xs text-[var(--color-muted)]">%</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setAllocation(DEFAULT_TARGET_ALLOCATION)} className="mt-3 text-[10px] text-[var(--color-muted)]">기본값으로 되돌리기</button>
      </section>

      <section className="app-card p-5">
        <h2 className="text-sm font-semibold">월 소득</h2>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">향후 가계 저축률 계산에 사용합니다.</p>
        <div className="mt-3 flex items-center gap-2">
          <input value={monthlyIncome > 0 ? formatNumber(monthlyIncome) : ''} onChange={event => setMonthlyIncome(parseNumber(event.target.value))} inputMode="numeric" className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-right text-sm" />
          <span className="text-xs text-[var(--color-muted)]">원</span>
        </div>
        <button type="button" onClick={saveSettings} disabled={pending || Math.abs(total - 100) > 0.001} className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          {pending ? '저장 중…' : '설정 저장'}
        </button>
      </section>

      <section className="app-card p-5" id="goals">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold">목표 마일스톤</h2><p className="mt-1 text-[10px] text-[var(--color-muted)]">첫 번째 미달성 목표가 대시보드에 표시됩니다.</p></div>
          <button type="button" onClick={() => { setEditingGoal(null); setShowGoalForm(current => !current) }} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white">＋ 목표</button>
        </div>
        {showGoalForm ? <GoalForm initial={editingGoal} nextOrder={initialGoals.length} pending={pending} onSave={input => goalAction(() => saveHouseholdGoal(input), '목표를 저장했습니다.')} onCancel={() => { setShowGoalForm(false); setEditingGoal(null) }} /> : null}
        <div className="mt-4 space-y-2">
          {initialGoals.length === 0 ? <p className="py-4 text-center text-xs text-[var(--color-muted)]">등록된 목표가 없습니다.</p> : null}
          {initialGoals.map(goal => (
            <div key={goal.id} className={`rounded-xl border border-[var(--color-border)] px-4 py-3 ${goal.achieved_at ? 'opacity-55' : 'bg-white/55'}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold">{goal.name} {goal.achieved_at ? '✓' : ''}</p><p className="mt-1 text-[10px] text-[var(--color-muted)]">{goal.statement} · 목표 {formatNumber(Number(goal.target))}원</p></div>
                <div className="flex shrink-0 gap-2 text-[10px]">
                  <button type="button" onClick={() => { setEditingGoal(goal); setShowGoalForm(true) }}>수정</button>
                  <button type="button" className="text-[var(--color-primary)]" onClick={() => goalAction(() => setGoalAchieved(goal.id, !goal.achieved_at), goal.achieved_at ? '달성을 취소했습니다.' : '목표를 달성 처리했습니다.')}>{goal.achieved_at ? '되돌리기' : '달성'}</button>
                  <button type="button" className="text-red-600" onClick={() => { if (confirm('이 목표를 삭제할까요?')) goalAction(() => deleteHouseholdGoal(goal.id), '목표를 삭제했습니다.') }}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="app-card p-5">
        <h2 className="text-sm font-semibold">전체 데이터 백업·복원</h2>
        <p className="mt-1 text-[10px] leading-5 text-[var(--color-muted)]">금융계좌, 거래, 월간 기록, 밸런스 시트, 목표와 설정을 하나의 JSON 파일로 보관합니다.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/export/full" className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold text-white">전체 백업 다운로드</a>
          <button type="button" onClick={() => importRef.current?.click()} disabled={pending} className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-xs font-semibold">백업 복원</button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void restoreBackup(file) }} />
          <a href="/api/export/transactions" className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-xs">거래 CSV</a>
        </div>
      </section>

      {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-[var(--color-primary)]" role="status">{message}</p> : null}
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
