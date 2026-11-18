'use client'

import { useState, useTransition } from 'react'
import { setMonthlyContribution } from './actions'
import { wonShort } from '@/lib/labels'

/** 계좌별 납입 방식: 매달 정기 납입액, 또는 비워 두면 돈 생길 때마다. */
export default function MonthlyContributionEditor({ accountId, amount }: { accountId: string; amount: number | null }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(amount ? amount.toLocaleString('ko-KR') : '')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await setMonthlyContribution(accountId, draft)
        if (!result.ok) { setMessage(result.error); return }
        setEditing(false)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '저장하지 못했어요.')
      }
    })
  }

  if (!editing) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-[var(--color-muted)]">
        {amount ? <span className="font-semibold text-[var(--color-positive-strong)]">매달 {wonShort(amount)} 정기 납입</span> : <span>돈 생길 때마다 납입</span>}
        <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-7 items-center rounded-md border border-[var(--color-border)] bg-white px-2 text-[11.5px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]">납입 방식 변경</button>
      </p>
    )
  }
  return (
    <div className="mt-2 rounded-lg bg-[var(--color-section)] p-2.5">
      <label className="text-[12.5px] font-semibold text-[var(--color-muted)]">매달 정기 납입액 <span className="font-normal">(비우면 ‘돈 생길 때마다’)</span>
        <span className="mt-1 flex items-center gap-2">
          <input value={draft} onChange={event => { const digits = event.target.value.replace(/[^0-9]/g, ''); setDraft(digits ? Number(digits).toLocaleString('ko-KR') : '') }} inputMode="numeric" placeholder="0" className="field-input max-w-[10rem] text-right font-semibold tabular-nums" />
          <span className="text-[12.5px]">원</span>
          <button type="button" disabled={pending} onClick={save} className="min-h-8 rounded-lg bg-[var(--color-primary)] px-3 text-[12.5px] font-semibold text-white disabled:opacity-50">{pending ? '저장 중…' : '저장'}</button>
          <button type="button" onClick={() => { setEditing(false); setMessage(null) }} className="min-h-8 px-1 text-[12.5px] text-[var(--color-muted)]">취소</button>
        </span>
      </label>
      <p className="mt-1 text-[11.5px] text-[var(--color-subtle)]">설정하면 월간 기록의 올해 누적 납입액이 매달 이 금액만큼 자동으로 늘어나요.</p>
      {message ? <p className="mt-1 text-[12.5px] text-[var(--color-negative)]" role="alert">{message}</p> : null}
    </div>
  )
}
