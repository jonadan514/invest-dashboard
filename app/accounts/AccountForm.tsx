'use client'
import { useRef, useTransition } from 'react'
import { createAccount } from './actions'

const INPUT = 'w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none'

export default function AccountForm({ compact = false }: { compact?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createAccount(formData)
        formRef.current?.reset()
      } catch (e) {
        alert('오류: ' + (e as Error).message)
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--color-muted)]">계좌명 *</label>
          <input name="name" required placeholder="예) 부부 공동 MMF" className={INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-muted)]">증권사/은행</label>
          <input name="broker" placeholder="예) 미래에셋" className={INPUT} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--color-muted)]">소유자 *</label>
          <select name="owner" className={INPUT}>
            <option value="me">나</option>
            <option value="spouse">아내</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-muted)]">계좌 유형 *</label>
          <select name="type" defaultValue="general" className={INPUT}>
            <option value="cash">입출금·공동계좌</option>
            <option value="mmf">CMA·MMF</option>
            <option value="general">주식·증권계좌</option>
            <option value="pension">연금저축</option>
            <option value="irp">IRP</option>
            <option value="isa">ISA</option>
            <option value="crypto">코인</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" name="tax_benefit" value="true" id="tax_benefit" className="h-4 w-4 accent-[var(--color-primary)]" />
        <label htmlFor="tax_benefit" className="text-xs text-[var(--color-ink)]">
          세제혜택 계좌 (연금저축·IRP·ISA 등)
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" name="is_emergency_fund" value="true" id="is_emergency_fund" className="h-4 w-4 accent-[var(--color-primary)]" />
        <label htmlFor="is_emergency_fund" className="text-xs text-[var(--color-ink)]">
          비상금 목표 금액에 합산
        </label>
      </div>

      {!compact ? (
        <p className="rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-[10px] leading-5 text-[var(--color-muted)]">
          현금·투자·연금 계좌는 금융계좌로, 부동산·보증금·대출은 별도 자산·부채 항목으로 관리합니다.
        </p>
      ) : null}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-strong)] disabled:opacity-50"
        >
          {pending ? '저장 중…' : '계좌 추가'}
        </button>
      </div>
    </form>
  )
}
