'use client'

import { useState, useTransition } from 'react'
import type { FinancialPlanSettings } from '@/lib/calc/budget'
import { saveFinancialPlanSettings } from './actions'

function formatInput(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}

function parseNumber(value: string) {
  return Number(value.replace(/,/g, '')) || 0
}

export default function PlanSettingsForm({ settings }: { settings: FinancialPlanSettings }) {
  const [values, setValues] = useState(settings)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function set<K extends keyof FinancialPlanSettings>(key: K, value: FinancialPlanSettings[K]) {
    setValues(current => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('monthly_fixed_cost', String(values.monthlyFixedCost))
    formData.set('mortgage_interest', String(values.mortgageInterest))
    formData.set('mortgage_principal', String(values.mortgagePrincipal))
    formData.set('monthly_joint_contribution', String(values.monthlyJointContribution))
    formData.set('current_emergency_fund', String(values.currentEmergencyFund))
    formData.set('stage1_target', String(values.stage1Target))
    formData.set('stage2_target', String(values.stage2Target))
    formData.set('stage2_emergency_ratio', String(values.stage2EmergencyRatio * 100))
    formData.set('stage2_investment_ratio', String(values.stage2InvestmentRatio * 100))
    formData.set('completed_investment_ratio', String(values.completedInvestmentRatio * 100))
    formData.set('completed_property_ratio', String(values.completedPropertyRatio * 100))

    startTransition(async () => {
      try {
        await saveFinancialPlanSettings(formData)
        setSaved(true)
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '설정을 저장하지 못했습니다.')
      }
    })
  }

  return (
    <section className="app-card mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-base font-bold text-[var(--color-ink)]">월간 기록 기본값</h2>
          <p className="mt-1 text-[11px] font-medium text-[var(--color-muted)]">고정비·공금·주담대·비상금 목표 · Supabase 저장</p>
        </div>
        <span className="text-xs text-[#65758a]">{open ? '접기' : '수정'}</span>
      </button>

      {open ? (
        <form onSubmit={submit} className="border-t border-[var(--color-border)] bg-[var(--color-section)]/55 px-5 py-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-semibold text-[#172233]">가계 기준</h3>
              <div className="space-y-3">
                <AmountField label="매월 고정비" value={values.monthlyFixedCost} onChange={value => set('monthlyFixedCost', value)} />
                <AmountField label="주담대 이자" value={values.mortgageInterest} onChange={value => set('mortgageInterest', value)} />
                <AmountField label="주담대 원금" value={values.mortgagePrincipal} onChange={value => set('mortgagePrincipal', value)} />
                <p className="rounded-xl bg-[#f3f7fb] px-3 py-2 text-[11px] leading-5 text-[#65758a]">
                  주담대 원금·이자는 고정비 구성과 향후 자산·부채·순자산 계산을 위한 참고값입니다. 배분 계산에서는 매월 고정비 총액만 한 번 차감합니다.
                </p>
                <AmountField label="매월 공금 납입금" value={values.monthlyJointContribution} onChange={value => set('monthlyJointContribution', value)} />
                <p className="rounded-xl bg-[#f3f7fb] px-3 py-2 text-[11px] leading-5 text-[#65758a]">
                  현재 비상금은 아래 월별 기록에서 갱신하면 Supabase 기본값에도 함께 반영됩니다.
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold text-[#172233]">비상금 목표</h3>
              <div className="space-y-3">
                <AmountField label="첫 번째 목표" value={values.stage1Target} onChange={value => set('stage1Target', value)} />
                <AmountField label="최종 목표" value={values.stage2Target} onChange={value => set('stage2Target', value)} />
                <p className="rounded-xl bg-[#f3f7fb] px-3 py-3 text-[11px] leading-5 text-[#65758a]">계좌별 실제 배분액은 매월 직접 기록합니다. 목표는 진행 상황을 보여주는 배지에만 사용합니다.</p>
              </div>
            </div>
          </div>

          {error ? <p className="mt-4 text-xs text-[#d31f47]" role="alert">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 rounded-lg bg-[#3f7fc3] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#326ba6] disabled:opacity-50"
          >
            {pending ? '저장 중…' : saved ? 'Supabase 저장됨 ✓' : '기본값 저장'}
          </button>
        </form>
      ) : null}
    </section>
  )
}

function AmountField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = `plan-${label.replace(/[^가-힣a-zA-Z0-9]/g, '-')}`
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="min-w-28 flex-1 text-xs text-[#65758a]">{label}</label>
      <input
        id={id}
        inputMode="numeric"
        value={formatInput(value)}
        onChange={event => onChange(parseNumber(event.target.value))}
        className="w-36 rounded-lg border border-[#d7e1eb] bg-white px-3 py-2 text-right text-xs tabular-nums outline-none focus:border-[#3f7fc3]"
      />
      <span className="text-xs text-[#65758a]">원</span>
    </div>
  )
}
