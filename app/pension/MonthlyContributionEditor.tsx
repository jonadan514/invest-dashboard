'use client'

import { useState, useTransition } from 'react'
import { backfillRegularContributions, setMonthlyContribution } from './actions'
import { formatMonth, wonShort } from '@/lib/labels'

/** 올해 정기 납입 횟수(시작 달이 올해 이전이면 1월부터). */
function paymentsThisYear(startMonth: string, currentMonth: string) {
  if (startMonth > currentMonth) return 0
  const from = startMonth.slice(0, 4) < currentMonth.slice(0, 4) ? 1 : Number(startMonth.slice(5, 7))
  return Number(currentMonth.slice(5, 7)) - from + 1
}

/** 계좌별 납입 방식: 매달 정기 납입액과 시작 달, 또는 비워 두면 돈 생길 때마다. */
export default function MonthlyContributionEditor({ accountId, amount, startMonth, currentMonth }: { accountId: string; amount: number | null; startMonth: string | null; currentMonth: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(amount ? amount.toLocaleString('ko-KR') : '')
  const [start, setStart] = useState(startMonth ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await setMonthlyContribution(accountId, draft, start)
        if (!result.ok) { setMessage(result.error); return }
        setEditing(false)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '저장하지 못했어요.')
      }
    })
  }

  function backfill() {
    if (!amount || !startMonth) return
    if (!confirm(`${formatMonth(startMonth)}부터 저장된 달별 기록의 '올해 누적 납입액'을 매달 ${wonShort(amount)} 기준으로 다시 맞출까요?\n정기 납입 외에 따로 넣은 금액이 있으면 그 금액은 빠져요.`)) return
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await backfillRegularContributions(accountId)
        setMessage(result.ok ? (result.updated > 0 ? `지난 기록 ${result.updated}개 달을 맞췄어요.` : '이미 정기 납입 기준과 같아요.') : result.error)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '맞추지 못했어요.')
      }
    })
  }

  if (!editing) {
    return (
      <div className="mt-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[var(--color-muted)]">
          {amount ? (
            <span className="font-semibold text-[var(--color-positive-strong)]">
              매달 {wonShort(amount)} 정기 납입{startMonth ? ` · ${formatMonth(startMonth)}부터 · 올해 ${paymentsThisYear(startMonth, currentMonth)}회` : ''}
            </span>
          ) : <span>돈 생길 때마다 납입</span>}
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-7 items-center rounded-md border border-[var(--color-border)] bg-white px-2 text-[11.5px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]">납입 방식 변경</button>
          {amount && startMonth ? (
            <button type="button" disabled={pending} onClick={backfill} className="inline-flex min-h-7 items-center rounded-md border border-[var(--color-border)] bg-white px-2 text-[11.5px] font-semibold text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50">{pending ? '맞추는 중…' : '지난 기록 맞추기'}</button>
          ) : null}
        </p>
        {message ? <p className="mt-1 text-[12.5px] text-[var(--color-primary)]" role="status">{message}</p> : null}
      </div>
    )
  }
  return (
    <div className="mt-2 rounded-lg bg-[var(--color-section)] p-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12.5px] font-semibold text-[var(--color-muted)]">매달 정기 납입액
          <span className="mt-1 flex items-center gap-1">
            <input value={draft} onChange={event => { const digits = event.target.value.replace(/[^0-9]/g, ''); setDraft(digits ? Number(digits).toLocaleString('ko-KR') : '') }} inputMode="numeric" placeholder="비우면 돈 생길 때마다" className="field-input w-40 text-right font-semibold tabular-nums" />
            <span className="text-[12.5px]">원</span>
          </span>
        </label>
        <label className="text-[12.5px] font-semibold text-[var(--color-muted)]">시작 달
          <input type="month" value={start} max={currentMonth} onChange={event => setStart(event.target.value)} className="field-input mt-1 block w-auto" />
        </label>
        <button type="button" disabled={pending} onClick={save} className="min-h-9 rounded-lg bg-[var(--color-primary)] px-3 text-[12.5px] font-semibold text-white disabled:opacity-50">{pending ? '저장 중…' : '저장'}</button>
        <button type="button" onClick={() => { setEditing(false); setMessage(null) }} className="min-h-9 px-1 text-[12.5px] text-[var(--color-muted)]">취소</button>
      </div>
      <p className="mt-1.5 text-[11.5px] text-[var(--color-subtle)]">시작 달을 넣으면 올해 누적 납입액을 시작 달부터 계산하고, 저장 뒤 ‘지난 기록 맞추기’로 이미 있는 달별 기록도 맞출 수 있어요.</p>
      {message ? <p className="mt-1 text-[12.5px] text-[var(--color-negative)]" role="alert">{message}</p> : null}
    </div>
  )
}
