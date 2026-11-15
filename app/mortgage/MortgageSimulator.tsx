'use client'

import { useState } from 'react'
import { addMonths } from '@/lib/calc/home-insights'
import { simulateMortgage, type MortgageResult } from '@/lib/calc/mortgage'
import { compactKrw, formatMonth, krw } from '@/lib/labels'

export interface MortgageLoan {
  id: string
  name: string
  balance: number
  balanceMonth: string
  annualRate: number | null
  rateSource: 'item' | 'estimated' | 'none'
  monthlyPayment: number | null
  paymentSource: 'item' | 'budget' | 'plan' | 'none'
  maturityDate: string | null
}

const RATE_NOTE: Record<MortgageLoan['rateSource'], string> = {
  item: '밸런스 시트에 입력한 금리',
  estimated: '최근 월간 기록의 이자로 추정한 금리',
  none: '금리를 입력해 주세요',
}

const PAYMENT_NOTE: Record<MortgageLoan['paymentSource'], string> = {
  item: '밸런스 시트에 입력한 월 상환액',
  budget: '최근 월간 기록의 이자 + 정기 원금',
  plan: '재무계획 기준 이자 + 정기 원금',
  none: '월 상환액을 입력해 주세요',
}

const LUMP_PRESETS = [5_000_000, 10_000_000, 30_000_000]

export default function MortgageSimulator({ loans }: { loans: MortgageLoan[] }) {
  const [loanId, setLoanId] = useState(loans[0].id)
  const loan = loans.find(item => item.id === loanId) ?? loans[0]

  return (
    <div className="space-y-4">
      {loans.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="대출 선택">
          {loans.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === loan.id}
              onClick={() => setLoanId(item.id)}
              className={`rounded-sm border px-3 py-2 text-xs font-semibold ${item.id === loan.id ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] bg-white text-[var(--color-ink)]'}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <LoanSimulator key={loan.id} loan={loan} />
    </div>
  )
}

function LoanSimulator({ loan }: { loan: MortgageLoan }) {
  const [rate, setRate] = useState(loan.annualRate != null ? String(loan.annualRate) : '')
  const [payment, setPayment] = useState(loan.monthlyPayment ?? 0)
  const [lumpSum, setLumpSum] = useState(0)
  const [extraMonthly, setExtraMonthly] = useState(0)

  const annualRate = Number(rate)
  const ready = rate.trim() !== '' && Number.isFinite(annualRate) && annualRate >= 0 && payment > 0
  const base = ready ? simulateMortgage({ balance: loan.balance, annualRate, monthlyPayment: payment }) : null
  const plan = ready ? simulateMortgage({ balance: loan.balance, annualRate, monthlyPayment: payment, lumpSum, extraMonthly }) : null
  const hasExtra = lumpSum > 0 || extraMonthly > 0

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="app-card p-5" aria-label="대출 정보와 추가 상환 입력">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{formatMonth(loan.balanceMonth)} 잔액</p>
        <h2 className="mt-1 text-xl font-bold tabular-nums text-[var(--color-ink)]">{krw(loan.balance)}</h2>
        <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{loan.name}{loan.maturityDate ? ` · 약정 만기 ${loan.maturityDate}` : ''}</p>

        <div className="mt-5 space-y-4">
          <Field label="연 금리" note={RATE_NOTE[loan.rateSource]} suffix="%">
            <input inputMode="decimal" value={rate} onChange={event => setRate(event.target.value.replace(/[^0-9.]/g, ''))} aria-label="연 금리" className="w-full bg-transparent text-right text-sm outline-none" />
          </Field>
          <Field label="월 상환액(원리금)" note={PAYMENT_NOTE[loan.paymentSource]} suffix="원">
            <MoneyInput value={payment} onChange={setPayment} label="월 상환액" />
          </Field>

          <div className="border-t border-[var(--color-border)] pt-4">
            <Field label="지금 한 번에 더 갚기" suffix="원">
              <MoneyInput value={lumpSum} onChange={setLumpSum} label="일시 상환액" />
            </Field>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LUMP_PRESETS.map(amount => (
                <button key={amount} type="button" onClick={() => setLumpSum(amount)} className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${lumpSum === amount ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted)]'}`}>
                  {compactKrw(amount)}
                </button>
              ))}
              {lumpSum > 0 ? <button type="button" onClick={() => setLumpSum(0)} className="px-2 text-[11.5px] text-[var(--color-subtle)]">지우기</button> : null}
            </div>
          </div>
          <Field label="매달 더 갚기" suffix="원">
            <MoneyInput value={extraMonthly} onChange={setExtraMonthly} label="매달 추가 상환액" />
          </Field>
        </div>
      </section>

      <section className="space-y-4" aria-live="polite">
        <ResultCard title="지금 속도 그대로" result={base} startMonth={loan.balanceMonth} ready={ready} />
        {hasExtra ? (
          <ResultCard title="추가 상환하면" result={plan} startMonth={loan.balanceMonth} ready={ready} compare={base} highlight />
        ) : (
          <div className="app-card border-dashed p-5 text-[12.5px] leading-5 text-[var(--color-muted)]">
            ‘지금 한 번에 더 갚기’나 ‘매달 더 갚기’에 금액을 넣으면 완납 시점이 얼마나 당겨지고 이자를 얼마나 아끼는지 비교해 드려요.
          </div>
        )}
        <p className="text-[11.5px] leading-4 text-[var(--color-subtle)]">
          원리금균등 상환을 가정한 참고용 계산입니다. 금리 변동, 중도상환수수료, 원금균등·거치 방식은 반영하지 않으니 실제 상환 전에는 은행 조회 결과를 확인하세요.
        </p>
      </section>
    </div>
  )
}

function ResultCard({ title, result, startMonth, ready, compare, highlight = false }: {
  title: string
  result: MortgageResult | null
  startMonth: string
  ready: boolean
  compare?: MortgageResult | null
  highlight?: boolean
}) {
  const body = !ready || !result
    ? <p className="mt-3 text-[12.5px] text-[var(--color-muted)]">금리와 월 상환액을 입력하면 계산해요.</p>
    : result.months === null
      ? <p className="mt-3 text-[12.5px] leading-5 text-[var(--color-negative)]">월 상환액이 첫 달 이자({compactKrw(result.firstMonthInterest)})보다 작아 원금이 줄지 않아요. 월 상환액을 확인해 주세요.</p>
      : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="완납 예상" value={result.months === 0 ? '바로 완납' : formatMonth(addMonths(startMonth, result.months))} sub={result.months === 0 ? '' : `남은 기간 ${formatDuration(result.months)}`} />
            <Stat label="앞으로 낼 이자" value={krw(result.totalInterest ?? 0)} />
          </div>
          {compare && compare.months !== null && compare.totalInterest !== null && result.totalInterest !== null ? (
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-[var(--color-positive-soft)] px-3 py-2.5 text-[12.5px]">
              <p className="text-[var(--color-positive-strong)]">기간 <strong className="tabular-nums">{formatDuration(compare.months - result.months)}</strong> 단축</p>
              <p className="text-[var(--color-positive-strong)]">이자 <strong className="tabular-nums">{compactKrw(compare.totalInterest - result.totalInterest)}</strong> 절약</p>
            </div>
          ) : null}
        </>
      )
  return (
    <article className={`app-card p-5 ${highlight ? 'border-[var(--color-positive)]' : ''}`}>
      <h3 className="text-sm font-bold text-[var(--color-ink)]">{title}</h3>
      {body}
    </article>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-canvas)]/75 px-3 py-2.5">
      <p className="text-[11.5px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-[var(--color-ink)]">{value}</p>
      {sub ? <p className="mt-0.5 text-[11.5px] text-[var(--color-subtle)]">{sub}</p> : null}
    </div>
  )
}

function Field({ label, note, suffix, children }: { label: string; note?: string; suffix: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--color-ink)]">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 focus-within:border-[var(--color-primary)]">
        {children}
        <span className="text-xs text-[var(--color-muted)]">{suffix}</span>
      </div>
      {note ? <p className="mt-1 text-[11.5px] text-[var(--color-subtle)]">{note}</p> : null}
    </div>
  )
}

function MoneyInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      value={value > 0 ? new Intl.NumberFormat('ko-KR').format(value) : ''}
      placeholder="0"
      onChange={event => onChange(Number(event.target.value.replace(/[^0-9]/g, '')) || 0)}
      className="w-full bg-transparent text-right text-sm tabular-nums outline-none"
    />
  )
}

function formatDuration(months: number) {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest}개월`
  return rest === 0 ? `${years}년` : `${years}년 ${rest}개월`
}
