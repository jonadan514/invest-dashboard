'use client'

import Link from 'next/link'
import { useState } from 'react'
import { addMonths } from '@/lib/calc/home-insights'
import { simulatePrepayment, type PrepayMethod } from '@/lib/calc/prepayment'
import { formatMonth, krw, wonShort } from '@/lib/labels'

export interface PrepayLoan {
  id: string
  name: string
  balance: number
  balanceMonth: string
  annualRate: number | null
  monthlyPayment: number | null
  startDate: string | null
}

const PRESETS = [10_000_000, 30_000_000, 50_000_000, 100_000_000]
const INPUT = 'field-input'

function years(months: number) {
  const y = Math.floor(months / 12)
  const m = months % 12
  return y > 0 ? `${y}년${m > 0 ? ` ${m}개월` : ''}` : `${m}개월`
}

/** 한 번에 더 갚기 계산기. 계산만 하고 기록은 바꾸지 않는다. */
export default function PrepaymentCalculator({ loan }: { loan: PrepayLoan }) {
  const firstMonth = addMonths(loan.balanceMonth, 1)
  const [amountText, setAmountText] = useState('')
  const [month, setMonth] = useState(firstMonth)
  const [method, setMethod] = useState<PrepayMethod>('shorten')
  const [feeText, setFeeText] = useState('')
  const amount = Number(amountText.replace(/[^0-9]/g, '')) || 0
  const feeRate = Number(feeText) || 0
  const ready = loan.annualRate !== null && loan.monthlyPayment !== null

  const result = ready && amount > 0 && month >= firstMonth
    ? simulatePrepayment({ balance: loan.balance, balanceMonth: loan.balanceMonth, annualRate: loan.annualRate!, monthlyPayment: loan.monthlyPayment!, amount, prepayMonth: month, method, feeRatePercent: feeRate, startDate: loan.startDate })
    : null

  if (!ready) {
    return (
      <section className="app-card p-6 text-center text-[13px] text-[var(--color-muted)]">
        연 금리와 월 상환액(또는 만기)을 입력하면 계산할 수 있어요. <Link href="/net-worth?view=settings" className="font-semibold text-[var(--color-primary)]">대출 정보 입력 →</Link>
      </section>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="app-card p-5" aria-label={`${loan.name} 한 번에 더 갚기 입력`}>
        <p className="text-[11.5px] font-bold text-[var(--color-primary)]">{loan.name} · {formatMonth(loan.balanceMonth)} 납부 후 잔액 {krw(loan.balance)}</p>
        <div className="mt-4 space-y-4">
          <label className="block text-[12.5px] font-semibold text-[var(--color-muted)]">더 갚을 금액
            <div className="mt-1 flex items-center gap-2">
              <input value={amountText} onChange={event => { const digits = event.target.value.replace(/[^0-9]/g, ''); setAmountText(digits ? Number(digits).toLocaleString('ko-KR') : '') }} inputMode="numeric" placeholder="0" className={`${INPUT} text-right font-semibold tabular-nums`} />
              <span className="text-[13px]">원</span>
            </div>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(value => (
              <button key={value} type="button" onClick={() => setAmountText(value.toLocaleString('ko-KR'))} className={`min-h-8 rounded-full border px-3 text-[12.5px] font-semibold ${amount === value ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted)]'}`}>{wonShort(value)}</button>
            ))}
          </div>
          <label className="block text-[12.5px] font-semibold text-[var(--color-muted)]">갚는 달 <span className="font-normal">(그달 정기 납부 직후)</span>
            <input type="month" value={month} min={firstMonth} onChange={event => setMonth(event.target.value || firstMonth)} className={`mt-1 ${INPUT}`} />
          </label>
          <fieldset>
            <legend className="text-[12.5px] font-semibold text-[var(--color-muted)]">상환 후 방식</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {([['shorten', '기간 단축', '월 상환액 그대로, 일찍 끝남'], ['reduce', '월 상환액 감소', '만기 그대로, 매달 덜 냄']] as const).map(([value, label, note]) => (
                <button key={value} type="button" aria-pressed={method === value} onClick={() => setMethod(value)} className={`rounded-lg border px-3 py-2 text-left ${method === value ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] bg-white'}`}>
                  <span className="block text-[13px] font-bold">{label}</span>
                  <span className="block text-[11.5px] text-[var(--color-muted)]">{note}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-[12.5px] font-semibold text-[var(--color-muted)]">중도상환수수료율
            <div className="mt-1 flex items-center gap-2">
              <input value={feeText} onChange={event => setFeeText(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" className={`${INPUT} text-right`} />
              <span className="text-[13px]">%</span>
            </div>
            <span className="mt-1 block text-[11.5px] font-normal leading-4 text-[var(--color-subtle)]">
              주담대는 보통 1.2% 안팎이고 대출 후 3년이 지나면 면제돼요. {loan.startDate ? `대출 시작일(${loan.startDate})로 남은 기간만큼 줄여 계산해요.` : '대출 시작일을 입력하면 3년 중 남은 기간만큼 줄여 계산해요.'}
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-4" aria-live="polite" aria-label="한 번에 더 갚기 결과">
        {!result ? (
          <div className="app-card border-dashed p-6 text-[13px] leading-6 text-[var(--color-muted)]">
            더 갚을 금액을 넣으면 줄어드는 이자, 끝나는 시점, 월 상환액 변화를 지금과 비교해 드려요.
          </div>
        ) : (
          <>
            <div className="app-card p-5">
              <p className="text-[11.5px] font-bold text-[var(--color-positive-strong)]">{formatMonth(month)}에 {wonShort(result.applied)} 더 갚으면</p>
              <p className="mt-1 text-[26px] font-bold tabular-nums leading-tight text-[var(--color-positive)]">이자 {wonShort(result.interestSaved)} 절약</p>
              <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                {method === 'shorten'
                  ? (result.monthsSaved > 0 ? `${years(result.monthsSaved)} 일찍 끝나요 (${formatMonth(result.base.lastMonth)} → ${formatMonth(result.plan.lastMonth)})` : '끝나는 시점은 같아요')
                  : `월 상환액이 ${krw(loan.monthlyPayment! - result.plan.monthlyPayment)} 줄어요 (${krw(loan.monthlyPayment!)} → ${krw(result.plan.monthlyPayment)})`}
              </p>
              {result.fee > 0 ? (
                <p className="mt-3 rounded-lg bg-[var(--color-section)] px-3 py-2 text-[13px] tabular-nums">
                  중도상환수수료 <strong>{krw(result.fee)}</strong> 빼면 실제로 아끼는 돈 <strong className={result.netSaving >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>{krw(result.netSaving)}</strong>
                </p>
              ) : null}
            </div>

            <div className="app-card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[12.5px] text-[var(--color-muted)]">
                    <th className="px-5 py-2.5 text-left font-semibold">비교</th>
                    <th className="px-3 py-2.5 text-right font-semibold">지금대로</th>
                    <th className="px-5 py-2.5 text-right font-semibold">더 갚으면</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  <Row label="월 상환액" base={krw(loan.monthlyPayment!)} plan={result.plan.monthlyPayment > 0 ? krw(result.plan.monthlyPayment) : '완납'} />
                  <Row label="끝나는 달" base={formatMonth(result.base.lastMonth)} plan={formatMonth(result.plan.lastMonth)} />
                  <Row label="남은 납부" base={`${result.base.months.toLocaleString('ko-KR')}회`} plan={`${result.plan.months.toLocaleString('ko-KR')}회`} />
                  <Row label="앞으로 낼 이자" base={wonShort(result.base.totalInterest)} plan={wonShort(result.plan.totalInterest)} />
                  <Row label="갚기 직전 잔액" base={krw(result.balanceBefore)} plan={krw(result.balanceBefore - result.applied)} />
                </tbody>
              </table>
            </div>

            <p className="text-[12.5px] leading-5 text-[var(--color-muted)]">
              계산만 하고 기록은 바꾸지 않아요. 실제로 갚았다면 <Link href={`/budget?month=${month}`} className="font-semibold text-[var(--color-primary)] hover:underline">{formatMonth(month)} 월간 기록</Link>의 ‘추가 원금 상환’에 적거나, 밸런스 시트 잔액 이력에 은행 잔액을 넣으세요.
              {method === 'reduce' ? ' 월 상환액 감소를 골랐다면 은행이 바꿔 준 월 상환액도 대출 정보에 넣어 주세요.' : ''}
            </p>
            <p className="text-[11.5px] leading-4 text-[var(--color-subtle)]">지금 금리가 끝까지 유지된다고 본 참고용 계산이에요. 금리가 바뀌면 결과도 달라져요.</p>
          </>
        )}
      </section>
    </div>
  )
}

function Row({ label, base, plan }: { label: string; base: string; plan: string }) {
  return (
    <tr className="border-b border-[var(--color-section)] last:border-0">
      <td className="px-5 py-2.5 text-[var(--color-muted)]">{label}</td>
      <td className="px-3 py-2.5 text-right">{base}</td>
      <td className="px-5 py-2.5 text-right font-semibold">{plan}</td>
    </tr>
  )
}
