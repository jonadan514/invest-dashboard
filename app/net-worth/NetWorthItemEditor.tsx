'use client'

import { useState, useTransition } from 'react'
import type { NetWorthItem } from '@/lib/types'
import { updateNetWorthItem } from './actions'
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES } from './categories'

const INPUT = 'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-primary)]'
const LABEL = 'text-[12px] font-semibold text-[var(--color-muted)]'

/** 항목의 고정 정보(이름·분류·소유, 부채면 대출 조건). 달마다 바뀌는 잔액은 잔액 이력에서 다룬다. */
export default function NetWorthItemEditor({ item }: { item: NetWorthItem }) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const liability = item.kind === 'liability'
  const categories = liability ? LIABILITY_CATEGORIES : ASSET_CATEGORIES
  const [category, setCategory] = useState(item.category)

  function submit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await updateNetWorthItem(item.id, formData)
        setMessage(result.ok ? '저장했어요.' : result.error)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '저장하지 못했어요.')
      }
    })
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className={LABEL}>항목 이름
          <input name="name" required defaultValue={item.name} className={`mt-1 ${INPUT}`} />
        </label>
        <label className={LABEL}>분류
          <select name="category" value={category} onChange={event => setCategory(event.target.value)} className={`mt-1 ${INPUT}`}>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className={LABEL}>소유
          <select name="owner" defaultValue={item.owner} className={`mt-1 ${INPUT}`}>
            <option value="household">공동</option><option value="me">나</option><option value="spouse">아내</option>
          </select>
        </label>
      </div>
      {liability ? (
        <div className="rounded-lg bg-[var(--color-section)] p-3">
          <p className="text-[12px] font-bold">대출 조건</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={LABEL}>연 금리(%)
              <input name="interest_rate" type="number" min="0" step="0.001" defaultValue={item.interest_rate ?? ''} placeholder="3.95" className={`mt-1 ${INPUT}`} />
            </label>
            <label className={LABEL}>월 상환액(원리금)
              <input name="monthly_payment" inputMode="numeric" defaultValue={item.monthly_payment ?? ''} placeholder="비우면 만기로 계산" className={`mt-1 ${INPUT}`} />
            </label>
            <label className={LABEL}>대출 시작일
              <input name="start_date" type="date" defaultValue={item.start_date ?? ''} className={`mt-1 ${INPUT}`} />
            </label>
            <label className={LABEL}>만기일
              <input name="maturity_date" type="date" defaultValue={item.maturity_date ?? ''} className={`mt-1 ${INPUT}`} />
            </label>
          </div>
          {category === 'mortgage' ? (
            <p className="mt-2 text-[12px] leading-5 text-[var(--color-muted)]">연 금리와 월 상환액(또는 만기일)을 넣으면 매달 잔액이 자동으로 줄고, 월간 기록의 이자·원금도 채워져요. 월 상환액을 비우면 잔액·금리·만기로 계산해요.</p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="start_date" value={item.start_date ?? ''} />
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--color-primary)]" role="status">{message}</p>
        <button type="submit" disabled={pending} className="min-h-9 rounded-lg bg-[var(--color-ink)] px-4 text-[12.5px] font-semibold text-white disabled:opacity-50">
          {pending ? '저장 중…' : '정보 저장'}
        </button>
      </div>
    </form>
  )
}
