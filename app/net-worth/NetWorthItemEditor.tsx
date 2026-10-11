'use client'

import { useState, useTransition } from 'react'
import type { NetWorthItem } from '@/lib/types'
import { updateNetWorthItem } from './actions'

const INPUT = 'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]'

export default function NetWorthItemEditor({ item }: { item: NetWorthItem }) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        await updateNetWorthItem(item.id, formData)
        setMessage('수정했습니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '수정하지 못했습니다.')
      }
    })
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-[10px] text-[var(--color-muted)]">항목 이름
          <input name="name" required defaultValue={item.name} className={`mt-1 ${INPUT}`} />
        </label>
        <label className="text-[10px] text-[var(--color-muted)]">소유
          <select name="owner" defaultValue={item.owner} className={`mt-1 ${INPUT}`}>
            <option value="household">공동</option><option value="me">나</option><option value="spouse">아내</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[10px] text-[var(--color-muted)]">연 이율
          <input name="interest_rate" type="number" min="0" step="0.01" defaultValue={item.interest_rate ?? ''} className={`mt-1 ${INPUT}`} />
        </label>
        <label className="text-[10px] text-[var(--color-muted)]">월 납입·상환액
          <input name="monthly_payment" inputMode="numeric" defaultValue={item.monthly_payment ?? ''} className={`mt-1 ${INPUT}`} />
        </label>
        <label className="text-[10px] text-[var(--color-muted)]">시작일
          <input name="start_date" type="date" defaultValue={item.start_date ?? ''} className={`mt-1 ${INPUT}`} />
        </label>
        <label className="text-[10px] text-[var(--color-muted)]">만기일
          <input name="maturity_date" type="date" defaultValue={item.maturity_date ?? ''} className={`mt-1 ${INPUT}`} />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-[var(--color-primary)]" role="status">{message}</p>
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {pending ? '저장 중…' : '정보 저장'}
        </button>
      </div>
    </form>
  )
}
