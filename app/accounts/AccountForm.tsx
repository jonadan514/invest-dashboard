'use client'
import { useState, useRef, useTransition } from 'react'
import { createAccount } from './actions'

const INPUT = 'w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]'

export default function AccountForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState('general')

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createAccount(formData)
        formRef.current?.reset()
        setType('general')
      } catch (e) {
        alert('오류: ' + (e as Error).message)
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs text-[#9c9484] mb-1">계좌명 *</label>
          <input name="name" required placeholder="예) 미래에셋 연금저축" className={INPUT} />
        </div>
        <div>
          <label className="block text-xs text-[#9c9484] mb-1">증권사/은행</label>
          <input name="broker" placeholder="예) 미래에셋" className={INPUT} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#9c9484] mb-1">소유자 *</label>
          <select name="owner" className={INPUT}>
            <option value="me">나</option>
            <option value="spouse">아내</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#9c9484] mb-1">계좌 유형 *</label>
          <select name="type" value={type} onChange={e => setType(e.target.value)} className={INPUT}>
            <option value="general">일반</option>
            <option value="pension">연금저축</option>
            <option value="irp">IRP</option>
            <option value="isa">ISA</option>
            <option value="crypto">코인</option>
            <option value="savings">예적금</option>
            <option value="debt">대출/부채</option>
          </select>
        </div>
      </div>

      {/* 대출 전용 필드 */}
      {type === 'debt' && (
        <div className="space-y-3 border border-amber-200 rounded-xl p-3 bg-amber-50/40">
          <p className="text-xs font-semibold text-amber-700">대출 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9c9484] mb-1">연이자율 (%)</label>
              <input name="interest_rate" type="number" step="0.01" min="0" placeholder="예) 3.50" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-[#9c9484] mb-1">월 납입금 (원)</label>
              <input name="monthly_payment" type="number" min="0" placeholder="예) 500000" className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#9c9484] mb-1">만기일</label>
            <input name="maturity_date" type="date" className={INPUT} />
          </div>
        </div>
      )}

      {type !== 'debt' && (
        <div className="flex items-center gap-2">
          <input type="checkbox" name="tax_benefit" value="true" id="tax_benefit" className="accent-[#1c6b4a] w-4 h-4" />
          <label htmlFor="tax_benefit" className="text-xs text-[#34322b]">
            세제혜택 계좌 (연금저축·IRP·ISA 등)
          </label>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={pending}
          className="bg-[#1c6b4a] hover:bg-[#165638] disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-colors"
        >
          {pending ? '저장 중…' : '계좌 추가'}
        </button>
      </div>
    </form>
  )
}
