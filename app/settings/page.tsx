'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import {
  DEFAULT_RATIOS, DEFAULT_HOUSEHOLD,
  type BudgetRatios, type HouseholdSettings,
} from '@/lib/calc/budget'
import { loadGoals, saveGoals, type Goal } from '@/lib/goals'

const CLASS_ITEMS = [
  { key: 'kr_stock', label: '국내주식' },
  { key: 'us_stock', label: '미국주식' },
  { key: 'etf_kr',  label: '국내ETF'  },
  { key: 'etf_us',  label: '미국ETF'  },
  { key: 'crypto',  label: '코인'     },
  { key: 'deposit', label: '예적금'   },
  { key: 'other',   label: '기타'     },
]

type Alloc = Record<string, number>

const DEFAULT: Alloc = { kr_stock: 30, us_stock: 30, etf_kr: 10, etf_us: 10, crypto: 10, deposit: 10, other: 0 }

function fmtNum(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}
function parseNum(s: string) {
  return Number(s.replace(/,/g, '')) || 0
}

export default function SettingsPage() {
  const [alloc, setAlloc] = useState<Alloc>(DEFAULT)
  const [saved, setSaved] = useState(false)
  const [mounted, setMounted] = useState(false)

  // 가계 기본 설정
  const [household, setHousehold] = useState<HouseholdSettings>(DEFAULT_HOUSEHOLD)
  const [householdSaved, setHouseholdSaved] = useState(false)

  // 배분 비율
  const [ratios, setRatios] = useState<BudgetRatios>(DEFAULT_RATIOS)
  const [ratiosSaved, setRatiosSaved] = useState(false)

  // 목표 마일스톤
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsSaved, setGoalsSaved] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [showGoalForm, setShowGoalForm] = useState(false)

  // 월 소득
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [incomeSaved, setIncomeSaved] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem('target_allocation')
      if (raw) setAlloc(JSON.parse(raw))
      const h = localStorage.getItem('household_settings')
      if (h) setHousehold(JSON.parse(h))
      const r = localStorage.getItem('budget_ratios')
      if (r) setRatios(JSON.parse(r))
      setGoals(loadGoals())
      const inc = localStorage.getItem('monthly_income')
      if (inc) setMonthlyIncome(Number(inc))
    } catch {}
  }, [])

  const total = Object.values(alloc).reduce((s, v) => s + v, 0)
  const ok = total === 100

  function set(key: string, val: number) {
    setAlloc(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, val)) }))
    setSaved(false)
  }

  function save() {
    localStorage.setItem('target_allocation', JSON.stringify(alloc))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function reset() {
    setAlloc(DEFAULT)
    setSaved(false)
  }

  function saveHousehold() {
    localStorage.setItem('household_settings', JSON.stringify(household))
    setHouseholdSaved(true)
    setTimeout(() => setHouseholdSaved(false), 2000)
  }

  function saveRatios() {
    const s1ok = Math.abs(ratios.stage1CashReserve + ratios.stage1FamilyExpense - 1) < 0.001
    const s2ok = Math.abs(ratios.stage2FamilyExpense + ratios.stage2GrowthCapital - 1) < 0.001
    const gcok = Math.abs(ratios.growthMoveUp + ratios.growthInvestment - 1) < 0.001
    if (!s1ok || !s2ok || !gcok) return alert('각 단계 비율의 합이 100%여야 합니다')
    localStorage.setItem('budget_ratios', JSON.stringify(ratios))
    setRatiosSaved(true)
    setTimeout(() => setRatiosSaved(false), 2000)
  }

  function saveIncome() {
    localStorage.setItem('monthly_income', String(monthlyIncome))
    setIncomeSaved(true)
    setTimeout(() => setIncomeSaved(false), 2000)
  }

  // 목표 CRUD
  function submitGoal(g: Omit<Goal, 'id' | 'order' | 'achieved_at'>) {
    let updated: Goal[]
    if (editingGoal) {
      updated = goals.map(og => og.id === editingGoal.id ? { ...editingGoal, ...g } : og)
    } else {
      const newGoal: Goal = {
        ...g,
        id: crypto.randomUUID(),
        order: goals.length + 1,
        achieved_at: null,
      }
      updated = [...goals, newGoal]
    }
    saveGoals(updated)
    setGoals(updated)
    setEditingGoal(null)
    setShowGoalForm(false)
    setGoalsSaved(true)
    setTimeout(() => setGoalsSaved(false), 2000)
  }

  function markAchieved(id: string) {
    const updated = goals.map(g => g.id === id ? { ...g, achieved_at: new Date().toISOString() } : g)
    saveGoals(updated)
    setGoals(updated)
  }

  function deleteGoal(id: string) {
    const updated = goals.filter(g => g.id !== id)
    saveGoals(updated)
    setGoals(updated)
  }

  if (!mounted) return <AppShell><div className="p-6" /></AppShell>

  return (
    <AppShell>
      <div className="p-6 max-w-xl">
        <h1 className="text-lg font-bold text-[#34322b] mb-6">설정</h1>

        {/* 목표 자산배분 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#34322b]">목표 자산배분</h2>
              <p className="text-[10px] text-[#9c9484] mt-0.5">±5%p 이탈 시 대시보드에 리밸런싱 알림 표시</p>
            </div>
            <span className={`text-sm font-bold tabular-nums ${ok ? 'text-[#1c6b4a]' : 'text-[#d31f47]'}`}>
              {total}%
            </span>
          </div>

          <div className="space-y-3">
            {CLASS_ITEMS.map(({ key, label }) => {
              const val = alloc[key] ?? 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-[#34322b] w-16 shrink-0">{label}</span>
                  <input
                    type="range"
                    min={0} max={100} step={1}
                    value={val}
                    onChange={e => set(key, Number(e.target.value))}
                    className="flex-1 accent-[#1c6b4a] h-1.5"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0} max={100}
                      value={val}
                      onChange={e => set(key, Number(e.target.value))}
                      className="w-12 text-xs bg-white border border-[#e3d9c4] rounded-md px-1.5 py-1 text-right tabular-nums"
                    />
                    <span className="text-xs text-[#9c9484]">%</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 비중 미니바 */}
          <div className="mt-4 h-2.5 bg-[#e3d9c4] rounded-full overflow-hidden flex">
            {CLASS_ITEMS.map(({ key }, i) => {
              const colors = ['#1c6b4a','#1763c9','#3d9970','#2ecc71','#9b59b6','#e67e22','#95a5a6']
              const val = alloc[key] ?? 0
              return val > 0 ? (
                <div key={key} style={{ width: `${val}%`, backgroundColor: colors[i] }} className="h-full" />
              ) : null
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {CLASS_ITEMS.map(({ key, label }, i) => {
              const colors = ['#1c6b4a','#1763c9','#3d9970','#2ecc71','#9b59b6','#e67e22','#95a5a6']
              const val = alloc[key] ?? 0
              if (val === 0) return null
              return (
                <span key={key} className="flex items-center gap-1 text-[10px] text-[#9c9484]">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: colors[i] }} />
                  {label} {val}%
                </span>
              )
            })}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={save}
              disabled={!ok}
              className="text-xs bg-[#1c6b4a] text-white rounded-lg px-4 py-2 hover:bg-[#165638] disabled:opacity-40 font-semibold transition-colors"
            >
              {saved ? '저장됨 ✓' : '저장'}
            </button>
            <button
              onClick={reset}
              className="text-xs text-[#9c9484] hover:text-[#34322b] transition-colors"
            >
              초기화
            </button>
            {!ok && (
              <span className="text-xs text-[#d31f47]">합계가 100%여야 합니다</span>
            )}
          </div>
          <p className="text-[10px] text-[#b5aa98] mt-3">
            * 이 기기에만 저장됩니다 (localStorage)
          </p>
        </div>

        {/* 가계 기본 설정 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-[#34322b] mb-4">가계 기본 설정</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#9c9484] block mb-1">월 생활비 기준 (주담대 포함)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={fmtNum(household.monthlyLivingCost)}
                  onChange={e => setHousehold(h => ({ ...h, monthlyLivingCost: parseNum(e.target.value) }))}
                  className="flex-1 text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none text-right tabular-nums"
                />
                <span className="text-xs text-[#9c9484]">원</span>
              </div>
              <p className="text-[10px] text-[#b5aa98] mt-1">비상금 커버리지 계산에 사용</p>
            </div>
            <div>
              <label className="text-xs text-[#9c9484] block mb-1">비상금 목표</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={fmtNum(household.cashTarget)}
                  onChange={e => setHousehold(h => ({ ...h, cashTarget: parseNum(e.target.value) }))}
                  className="flex-1 text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none text-right tabular-nums"
                />
                <span className="text-xs text-[#9c9484]">원</span>
              </div>
            </div>
          </div>
          <button
            onClick={saveHousehold}
            className="mt-4 text-xs bg-[#1c6b4a] text-white rounded-lg px-4 py-2 hover:bg-[#165638] font-semibold transition-colors"
          >
            {householdSaved ? '저장됨 ✓' : '저장'}
          </button>
        </div>

        {/* 재무 계획 배분 비율 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-[#34322b] mb-1">재무 계획 배분 비율</h2>
          <p className="text-[10px] text-[#9c9484] mb-4">각 단계 내 비율 합계가 100%여야 합니다</p>

          {/* 1단계 */}
          <div className="mb-4">
            <p className="text-xs font-medium text-amber-700 mb-2">1단계 — 비상금 목표 달성 전</p>
            <div className="space-y-2">
              {[
                { key: 'stage1CashReserve',   label: '예금 보강',       color: 'bg-amber-400' },
                { key: 'stage1FamilyExpense',  label: '가족 비정기 지출', color: 'bg-purple-400' },
              ].map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                  <span className="text-xs text-[#34322b] flex-1">{label}</span>
                  <input
                    type="number" min={0} max={100} step={1}
                    value={Math.round((ratios as any)[key] * 100)}
                    onChange={e => setRatios(r => ({ ...r, [key]: Number(e.target.value) / 100 }))}
                    className="w-16 text-xs bg-white border border-[#e3d9c4] rounded-md px-2 py-1 text-right"
                  />
                  <span className="text-xs text-[#9c9484]">%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2단계 */}
          <div className="mb-4">
            <p className="text-xs font-medium text-[#1c6b4a] mb-2">2단계 — 비상금 목표 달성 후</p>
            <div className="space-y-2">
              {[
                { key: 'stage2FamilyExpense',  label: '가족 비정기 지출', color: 'bg-purple-400' },
                { key: 'stage2GrowthCapital',  label: '성장자본',         color: 'bg-[#1c6b4a]' },
              ].map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                  <span className="text-xs text-[#34322b] flex-1">{label}</span>
                  <input
                    type="number" min={0} max={100} step={1}
                    value={Math.round((ratios as any)[key] * 100)}
                    onChange={e => setRatios(r => ({ ...r, [key]: Number(e.target.value) / 100 }))}
                    className="w-16 text-xs bg-white border border-[#e3d9c4] rounded-md px-2 py-1 text-right"
                  />
                  <span className="text-xs text-[#9c9484]">%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 성장자본 분배 */}
          <div>
            <p className="text-xs font-medium text-[#34322b] mb-2">성장자본 내부 분배</p>
            <div className="space-y-2">
              {[
                { key: 'growthMoveUp',      label: '갈아타기 자본' },
                { key: 'growthInvestment',  label: '금융자산 투자' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-[#b5aa98] shrink-0" />
                  <span className="text-xs text-[#34322b] flex-1">{label}</span>
                  <input
                    type="number" min={0} max={100} step={1}
                    value={Math.round((ratios as any)[key] * 100)}
                    onChange={e => setRatios(r => ({ ...r, [key]: Number(e.target.value) / 100 }))}
                    className="w-16 text-xs bg-white border border-[#e3d9c4] rounded-md px-2 py-1 text-right"
                  />
                  <span className="text-xs text-[#9c9484]">%</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={saveRatios}
            className="mt-4 text-xs bg-[#1c6b4a] text-white rounded-lg px-4 py-2 hover:bg-[#165638] font-semibold transition-colors"
          >
            {ratiosSaved ? '저장됨 ✓' : '저장'}
          </button>
          <p className="text-[10px] text-[#b5aa98] mt-2">* 이 기기에만 저장됩니다 (localStorage)</p>
        </div>

        {/* 월 소득 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5 mb-4" id="income">
          <h2 className="text-sm font-semibold text-[#34322b] mb-1">월 소득</h2>
          <p className="text-[10px] text-[#9c9484] mb-4">저축률 계산에 사용됩니다</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={monthlyIncome > 0 ? fmtNum(monthlyIncome) : ''}
              onChange={e => setMonthlyIncome(parseNum(e.target.value))}
              placeholder="7,000,000"
              className="flex-1 text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none text-right tabular-nums"
            />
            <span className="text-xs text-[#9c9484]">원</span>
          </div>
          <button
            onClick={saveIncome}
            className="mt-3 text-xs bg-[#1c6b4a] text-white rounded-lg px-4 py-2 hover:bg-[#165638] font-semibold transition-colors"
          >
            {incomeSaved ? '저장됨 ✓' : '저장'}
          </button>
        </div>

        {/* 목표 마일스톤 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5 mb-4" id="goals">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#34322b]">목표 마일스톤</h2>
              <p className="text-[10px] text-[#9c9484] mt-0.5">달성 순서대로 대시보드 북극성 카드에 표시됩니다</p>
            </div>
            <button
              onClick={() => { setEditingGoal(null); setShowGoalForm(v => !v) }}
              className="text-xs bg-[#1c6b4a] text-white rounded-lg px-3 py-1.5 font-semibold hover:bg-[#165638] transition-colors"
            >
              + 목표 추가
            </button>
          </div>

          {/* 목표 목록 */}
          {goals.length === 0 && !showGoalForm && (
            <p className="text-xs text-[#b5aa98] text-center py-4">등록된 목표가 없습니다</p>
          )}
          <div className="space-y-2 mb-3">
            {goals.map(g => (
              <div key={g.id} className={`border rounded-xl px-4 py-3 ${
                g.achieved_at ? 'border-[#e3d9c4] opacity-50' : 'border-[#c5dece] bg-emerald-50/30'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] bg-[#e3d9c4] text-[#9c9484] px-1.5 py-0.5 rounded font-medium">
                        {g.type === 'cash' ? '현금' : g.type === 'investment' ? '투자' : g.type === 'net_worth' ? '순자산' : '기타'}
                      </span>
                      <span className="text-xs font-semibold text-[#34322b]">{g.name}</span>
                      {g.achieved_at && <span className="text-[10px] text-[#1c6b4a]">✓ 달성</span>}
                    </div>
                    <p className="text-xs text-[#34322b]">{g.statement}</p>
                    {g.sub && <p className="text-[10px] text-[#9c9484] mt-0.5">{g.sub}</p>}
                    <p className="text-[10px] text-[#b5aa98] mt-0.5">
                      목표: ₩{new Intl.NumberFormat('ko-KR').format(g.target)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!g.achieved_at && (
                      <>
                        <button
                          onClick={() => { setEditingGoal(g); setShowGoalForm(true) }}
                          className="text-[10px] text-[#9c9484] hover:text-[#34322b] px-2 py-1 rounded transition-colors"
                        >
                          편집
                        </button>
                        <button
                          onClick={() => markAchieved(g.id)}
                          className="text-[10px] text-[#1c6b4a] hover:text-[#165638] px-2 py-1 rounded transition-colors"
                        >
                          달성
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteGoal(g.id)}
                      className="text-[10px] text-[#d31f47] hover:text-red-700 px-2 py-1 rounded transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 목표 추가/편집 폼 */}
          {showGoalForm && (
            <GoalForm
              initial={editingGoal}
              onSubmit={submitGoal}
              onCancel={() => { setShowGoalForm(false); setEditingGoal(null) }}
            />
          )}

          {goalsSaved && (
            <p className="text-xs text-[#1c6b4a] mt-2">저장됨 ✓</p>
          )}
          <p className="text-[10px] text-[#b5aa98] mt-3">* 이 기기에만 저장됩니다 (localStorage)</p>
        </div>

        {/* 데이터 관리 */}
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#34322b] mb-4">데이터 관리</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#34322b]">거래 내역 CSV 내보내기</p>
              <p className="text-[10px] text-[#9c9484] mt-0.5">전체 거래 내역을 CSV로 백업합니다</p>
            </div>
            <a
              href="/api/export/transactions"
              className="text-xs bg-[#34322b] hover:bg-[#1a1914] text-white rounded-lg px-4 py-2 font-semibold transition-colors whitespace-nowrap"
            >
              ↓ CSV
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function GoalForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Goal | null
  onSubmit: (g: Omit<Goal, 'id' | 'order' | 'achieved_at'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [statement, setStatement] = useState(initial?.statement ?? '')
  const [sub, setSub] = useState(initial?.sub ?? '')
  const [type, setType] = useState<Goal['type']>(initial?.type ?? 'cash')
  const [target, setTarget] = useState(initial?.target ?? 0)
  const [nextHint, setNextHint] = useState(initial?.next_hint ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !statement || target <= 0) return
    onSubmit({ name, statement, sub, type, target, next_hint: nextHint })
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[#e3d9c4] rounded-xl p-4 bg-white space-y-3">
      <p className="text-xs font-semibold text-[#34322b]">{initial ? '목표 편집' : '새 목표 추가'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-[#9c9484] block mb-1">목표 이름 (짧게)</label>
          <input
            value={name} onChange={e => setName(e.target.value)} required
            placeholder="현금 3,000만"
            className="w-full text-xs border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#9c9484] block mb-1">유형</label>
          <select
            value={type} onChange={e => setType(e.target.value as Goal['type'])}
            className="w-full text-xs border border-[#e3d9c4] rounded-lg px-3 py-2 bg-white focus:outline-none"
          >
            <option value="cash">현금</option>
            <option value="investment">투자</option>
            <option value="net_worth">순자산</option>
            <option value="other">기타</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-[#9c9484] block mb-1">목표 문장 (카드 제목)</label>
        <input
          value={statement} onChange={e => setStatement(e.target.value)} required
          placeholder="현금 방어력 완성하기"
          className="w-full text-xs border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-[10px] text-[#9c9484] block mb-1">부제 (선택)</label>
        <input
          value={sub} onChange={e => setSub(e.target.value)}
          placeholder="수익률보다 구조를 지키는 시기"
          className="w-full text-xs border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-[10px] text-[#9c9484] block mb-1">목표 금액</label>
        <div className="flex items-center gap-2">
          <input
            type="number" value={target || ''} onChange={e => setTarget(Number(e.target.value))} required min={1}
            placeholder="30000000"
            className="flex-1 text-xs border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none text-right"
          />
          <span className="text-xs text-[#9c9484]">원</span>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-[#9c9484] block mb-1">다음 단계 안내 (선택)</label>
        <input
          value={nextHint} onChange={e => setNextHint(e.target.value)}
          placeholder="달성 후 투자 포트폴리오 고도화 검토"
          className="w-full text-xs border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="text-xs bg-[#1c6b4a] text-white rounded-lg px-4 py-2 font-semibold hover:bg-[#165638] transition-colors"
        >
          {initial ? '수정 완료' : '추가'}
        </button>
        <button
          type="button" onClick={onCancel}
          className="text-xs text-[#9c9484] hover:text-[#34322b] px-3 py-2 transition-colors"
        >
          취소
        </button>
      </div>
    </form>
  )
}
