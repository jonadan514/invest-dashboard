'use client'

import { useRef, useState, useTransition } from 'react'
import { saveAccountBalance } from './actions'

interface Props {
  accountId: string
  accountType: 'savings' | 'debt'
  defaultDate: string
}

export default function BalanceForm({ accountId, accountType, defaultDate }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  function handleSubmit(formData: FormData) {
    setResult(null)
    startTransition(async () => {
      try {
        await saveAccountBalance(accountId, formData)
        formRef.current?.reset()
        setResult({ kind: 'success', message: '잔액을 기록했습니다' })
      } catch (error) {
        setResult({
          kind: 'error',
          message: error instanceof Error ? error.message : '잔액 저장에 실패했습니다',
        })
      }
    })
  }

  const valueLabel = accountType === 'debt' ? '잔여 원금' : '현재 잔액'

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
      <label>
        <span className="block text-[10px] text-[#65758a] mb-1">기준일</span>
        <input
          name="as_of"
          type="date"
          required
          defaultValue={defaultDate}
          className="w-full text-xs bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]"
        />
      </label>
      <label>
        <span className="block text-[10px] text-[#65758a] mb-1">{valueLabel}</span>
        <div className="flex items-center gap-2">
          <input
            name="value"
            type="number"
            min="0"
            step="1"
            required
            placeholder="0"
            className="min-w-0 flex-1 text-xs bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 text-right focus:outline-none focus:border-[#3f7fc3]"
          />
          <span className="text-xs text-[#65758a]">원</span>
        </div>
      </label>
      <label className="sm:col-span-2">
        <span className="block text-[10px] text-[#65758a] mb-1">메모</span>
        <input
          name="memo"
          maxLength={500}
          placeholder={accountType === 'debt' ? '예: 8월 원리금 납부 후' : '예: 월말 잔액'}
          className="w-full text-xs bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]"
        />
      </label>
      <div className="sm:col-span-2 flex items-center justify-between gap-3">
        <p aria-live="polite" className={`text-[10px] ${result?.kind === 'success' ? 'text-[#3f7fc3]' : 'text-red-600'}`}>
          {result?.message}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="text-xs bg-[#3f7fc3] hover:bg-[#326ba6] disabled:opacity-50 text-white rounded-lg px-4 py-2 font-semibold transition-colors"
        >
          {pending ? '저장 중…' : '잔액 기록'}
        </button>
      </div>
    </form>
  )
}
