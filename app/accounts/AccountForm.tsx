'use client'

import { useRef, useState, useTransition } from 'react'
import { createAccount } from './actions'

const INPUT = 'w-full text-sm bg-white border border-[#ddd8ce] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#577b6d]'

export default function AccountForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState('savings')

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createAccount(formData)
        formRef.current?.reset()
        setType('savings')
      } catch (e) {
        alert('오류: ' + (e as Error).message)
      }
    })
  }

  const canHaveRate = ['savings', 'cash', 'mmf'].includes(type)

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[#7f8782]">계좌명 *</label>
          <input name="name" required placeholder="예) 비상금 예금" className={INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#7f8782]">은행/증권사</label>
          <input name="broker" placeholder="예) KB국민은행" className={INPUT} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[#7f8782]">소유자 *</label>
          <select name="owner" className={INPUT}>
            <option value="me">본인</option>
            <option value="spouse">배우자</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#7f8782]">계좌 유형 *</label>
          <select name="type" value={type} onChange={e => setType(e.target.value)} className={INPUT}>
            <option value="savings">예적금</option>
            <option value="cash">현금</option>
            <option value="mmf">MMF/CMA</option>
            <option value="pension">연금저축</option>
            <option value="irp">IRP</option>
            <option value="isa">ISA</option>
            <option value="general">일반 투자계좌</option>
            <option value="crypto">가상자산</option>
          </select>
        </div>
      </div>

      {canHaveRate && (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#f7f3eb] p-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[#7f8782]">연 이율 (%)</label>
            <input name="interest_rate" type="number" step="0.01" min="0" className={INPUT} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#7f8782]">만기일</label>
            <input name="maturity_date" type="date" className={INPUT} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {type !== 'cash' && type !== 'mmf' && (
          <label className="flex items-center gap-2 text-xs text-[#46534d]">
            <input type="checkbox" name="tax_benefit" value="true" className="accent-[#315c4c]" />
            세제혜택 계좌
          </label>
        )}
        {['savings', 'cash', 'mmf'].includes(type) && (
          <label className="flex items-center gap-2 text-xs text-[#46534d]">
            <input type="checkbox" name="is_emergency_fund" value="true" className="accent-[#315c4c]" />
            비상금에 포함
          </label>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#315c4c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#244c3e] disabled:opacity-50"
        >
          {pending ? '저장 중…' : '계좌 추가'}
        </button>
      </div>
    </form>
  )
}
