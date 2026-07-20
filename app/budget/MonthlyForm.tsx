'use client'
import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { saveBudgetEntry } from './actions'
import {
  calcAllocation,
  DEFAULT_RATIOS, DEFAULT_HOUSEHOLD,
  type BudgetRatios, type HouseholdSettings, type AllocationResult,
} from '@/lib/calc/budget'

function fmtKrw(n: number) {
  if (n === 0) return '₩0'
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n))
}
function parseNum(s: string) {
  return Number(s.replace(/,/g, '')) || 0
}
function fmtInput(n: number) {
  if (n === 0) return ''
  return new Intl.NumberFormat('ko-KR').format(n)
}

type Entry = {
  joint_savings: number
  bonus_total: number
  bonus_to_plan: number
  cash_balance: number
  memo: string
}

interface Props {
  month: string
  entry: Entry | null
  months: string[]
}

export default function MonthlyForm({ month, entry, months }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [jointSavings, setJointSavings] = useState(entry?.joint_savings ?? 0)
  const [bonusTotal,   setBonusTotal]   = useState(entry?.bonus_total   ?? 0)
  const [bonusToPlan,  setBonusToPlan]  = useState(entry?.bonus_to_plan ?? 0)
  const [cashBalance,  setCashBalance]  = useState(entry?.cash_balance  ?? 0)
  const [memo,         setMemo]         = useState(entry?.memo          ?? '')
  const [ratios,    setRatios]    = useState<BudgetRatios>(DEFAULT_RATIOS)
  const [household, setHousehold] = useState<HouseholdSettings>(DEFAULT_HOUSEHOLD)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  // entry가 바뀔 때(월 변경) 폼 동기화
  useEffect(() => {
    setJointSavings(entry?.joint_savings ?? 0)
    setBonusTotal(entry?.bonus_total     ?? 0)
    setBonusToPlan(entry?.bonus_to_plan  ?? 0)
    setCashBalance(entry?.cash_balance   ?? 0)
    setMemo(entry?.memo                  ?? '')
    setSaved(false)
  }, [entry])

  useEffect(() => {
    try {
      const r = localStorage.getItem('budget_ratios')
      if (r) setRatios(JSON.parse(r))
      const h = localStorage.getItem('household_settings')
      if (h) setHousehold(JSON.parse(h))
    } catch {}
  }, [])

  const result: AllocationResult = calcAllocation(
    { jointSavings, bonusToPlan, cashBalance },
    household,
    ratios,
  )

  const cashPct = household.cashTarget > 0
    ? Math.min(100, (cashBalance / household.cashTarget) * 100)
    : 0
  const coverage = household.monthlyLivingCost > 0
    ? cashBalance / household.monthlyLivingCost
    : 0

  function changeMonth(m: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', m)
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('month',         month)
    fd.set('joint_savings', String(jointSavings))
    fd.set('bonus_total',   String(bonusTotal))
    fd.set('bonus_to_plan', String(bonusToPlan))
    fd.set('cash_balance',  String(cashBalance))
    fd.set('memo',          memo)
    start(async () => {
      await saveBudgetEntry(fd)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  const isStage2 = result.stage === 2

  return (
    <div>
      {/* 월 선택기 */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={month}
          onChange={e => changeMonth(e.target.value)}
          className="text-sm font-semibold bg-[#faf6ec] border border-[#e3d9c4] rounded-lg px-3 py-2 text-[#34322b] focus:outline-none"
        >
          {months.map(m => {
            const [y, mo] = m.split('-')
            return <option key={m} value={m}>{y}년 {parseInt(mo)}월</option>
          })}
        </select>
        {entry && <span className="text-xs text-[#1c6b4a]">• 저장된 내역 있음</span>}
      </div>

      {/* 현황 카드 3개 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
          <p className="text-xs text-[#9c9484]">비상금 달성률</p>
          <p className="text-xl font-bold text-[#34322b] mt-1">{cashPct.toFixed(1)}%</p>
          <div className="mt-2 h-1.5 bg-[#e3d9c4] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${cashPct}%`, backgroundColor: cashPct >= 100 ? '#1c6b4a' : '#e67e22' }}
            />
          </div>
          <p className="text-[10px] text-[#9c9484] mt-1">
            {fmtKrw(cashBalance)} / {fmtKrw(household.cashTarget)}
          </p>
        </div>
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
          <p className="text-xs text-[#9c9484]">비상금 커버리지</p>
          <p className="text-xl font-bold text-[#34322b] mt-1">{coverage.toFixed(1)}개월</p>
          <p className="text-[10px] text-[#9c9484] mt-1">
            목표 {(household.cashTarget / household.monthlyLivingCost).toFixed(1)}개월
          </p>
        </div>
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-4">
          <p className="text-xs text-[#9c9484]">이달 배분 가능액</p>
          <p className="text-xl font-bold text-[#34322b] mt-1">{fmtKrw(result.totalAllocatable)}</p>
          <p className="text-[10px] text-[#9c9484] mt-1">
            공금 + 성과급 합산
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 입력 섹션 */}
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-[#34322b] mb-4">이달 입력</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#9c9484] block mb-1">현재 예금 잔액 (비상금)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fmtInput(cashBalance)}
                    onChange={e => setCashBalance(parseNum(e.target.value))}
                    placeholder="15,000,000"
                    className="flex-1 text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#1c6b4a] text-right tabular-nums"
                  />
                  <span className="text-xs text-[#9c9484] shrink-0">원</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9c9484] block mb-1">공금 적립 가능액</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fmtInput(jointSavings)}
                    onChange={e => setJointSavings(parseNum(e.target.value))}
                    placeholder="2,300,000"
                    className="flex-1 text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#1c6b4a] text-right tabular-nums"
                  />
                  <span className="text-xs text-[#9c9484] shrink-0">원</span>
                </div>
                <p className="text-[10px] text-[#b5aa98] mt-1">연금계좌 납입액은 별도 관리</p>
              </div>

              <div className="border-t border-[#f0ead8] pt-4">
                <label className="text-xs text-[#9c9484] block mb-1">성과급 / 일시 수입 (전체)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fmtInput(bonusTotal)}
                    onChange={e => {
                      const v = parseNum(e.target.value)
                      setBonusTotal(v)
                      if (bonusToPlan > v) setBonusToPlan(v)
                    }}
                    placeholder="0"
                    className="flex-1 text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#1c6b4a] text-right tabular-nums"
                  />
                  <span className="text-xs text-[#9c9484] shrink-0">원</span>
                </div>
              </div>

              {bonusTotal > 0 && (
                <div>
                  <label className="text-xs text-[#9c9484] block mb-1">성과급 중 이번 달 가계 배분액</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtInput(bonusToPlan)}
                      onChange={e => setBonusToPlan(Math.min(parseNum(e.target.value), bonusTotal))}
                      placeholder="0"
                      className="flex-1 text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#1c6b4a] text-right tabular-nums"
                    />
                    <span className="text-xs text-[#9c9484] shrink-0">원</span>
                  </div>
                  <p className="text-[10px] text-[#b5aa98] mt-1">
                    나머지 {fmtKrw(bonusTotal - bonusToPlan)}은 별도 처리
                  </p>
                </div>
              )}

              <div className="border-t border-[#f0ead8] pt-4">
                <label className="text-xs text-[#9c9484] block mb-1">메모</label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="특이사항 (스키여행비 일부 반영 등)"
                  rows={2}
                  className="w-full text-xs bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none resize-none text-[#34322b]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={pending || result.totalAllocatable === 0}
              className="mt-4 w-full text-sm bg-[#1c6b4a] hover:bg-[#165638] disabled:opacity-40 text-white rounded-xl py-2.5 font-semibold transition-colors"
            >
              {pending ? '저장 중…' : saved ? '저장됨 ✓' : '이달 배분 저장'}
            </button>
          </div>

          {/* 배분 결과 */}
          <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#34322b]">배분 결과</h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isStage2
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {isStage2 ? '2단계 · 성장자본' : '1단계 · 비상금 보강'}
              </span>
            </div>

            {result.totalAllocatable === 0 ? (
              <p className="text-sm text-[#b5aa98] text-center py-8">공금 적립액을 입력하면 배분이 계산됩니다</p>
            ) : (
              <div className="space-y-3">
                {/* 총액 */}
                <div className="bg-[#f0ead8] rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[#9c9484]">총 배분 가능액</span>
                  <span className="text-base font-bold text-[#34322b]">{fmtKrw(result.totalAllocatable)}</span>
                </div>

                {/* 예금 보강 */}
                {result.cashReserve > 0 && (
                  <div className="flex justify-between items-center px-1 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-xs text-[#34322b]">예금 보강</span>
                      <span className="text-[10px] text-[#b5aa98]">
                        ({(ratios.stage1CashReserve * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-amber-700">{fmtKrw(result.cashReserve)}</span>
                  </div>
                )}

                {/* 가족 비정기 지출 */}
                <div className="flex justify-between items-center px-1 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                    <span className="text-xs text-[#34322b]">가족 비정기 지출</span>
                    <span className="text-[10px] text-[#b5aa98]">
                      ({(( isStage2 ? ratios.stage2FamilyExpense : ratios.stage1FamilyExpense) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-purple-700">{fmtKrw(result.familyExpense)}</span>
                </div>

                {/* 성장자본 */}
                {result.growthCapital > 0 && (
                  <div className="border-l-2 border-[#1c6b4a] ml-1 pl-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#1c6b4a] shrink-0" />
                        <span className="text-xs font-medium text-[#34322b]">성장자본</span>
                        <span className="text-[10px] text-[#b5aa98]">
                          ({(( isStage2 ? ratios.stage2GrowthCapital : 0) * 100).toFixed(0) || '잉여'}%)
                        </span>
                      </div>
                      <span className="text-sm font-bold text-[#1c6b4a]">{fmtKrw(result.growthCapital)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 text-xs text-[#9c9484]">
                      <span>├ 갈아타기 자본 ({(ratios.growthMoveUp * 100).toFixed(0)}%)</span>
                      <span className="font-medium text-[#34322b]">{fmtKrw(result.moveUpCapital)}</span>
                    </div>
                    <div className="flex justify-between items-center pl-4 text-xs text-[#9c9484]">
                      <span>└ 금융자산 투자 ({(ratios.growthInvestment * 100).toFixed(0)}%)</span>
                      <span className="font-medium text-[#34322b]">{fmtKrw(result.financialInvestment)}</span>
                    </div>
                  </div>
                )}

                {/* 예금 예상 잔액 */}
                <div className="mt-2 pt-3 border-t border-[#e3d9c4] flex justify-between items-center">
                  <span className="text-xs text-[#9c9484]">예금 예상 잔액</span>
                  <div className="text-right">
                    <span className="text-base font-bold text-[#34322b]">
                      {fmtKrw(result.expectedCashBalance)}
                    </span>
                    <span className="text-[10px] text-[#9c9484] ml-2">
                      ({Math.min(100, result.expectedCashBalance / household.cashTarget * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {!isStage2 && result.cashShortfall > 0 && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    목표까지 {fmtKrw(result.cashShortfall)} 남음
                    · 약 {Math.ceil(result.cashShortfall / Math.max(result.cashReserve, 1))}개월 예상
                  </p>
                )}
                {isStage2 && (
                  <p className="text-[10px] text-[#1c6b4a] bg-emerald-50 rounded-lg px-3 py-2">
                    비상금 목표 달성 · 성장자본 운용 단계
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
