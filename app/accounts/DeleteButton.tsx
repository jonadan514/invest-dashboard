'use client'
import { useTransition } from 'react'
import { deleteAccount } from './actions'

export default function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`"${name}" 계좌를 삭제할까요?\n월별 평가 기록도 함께 삭제됩니다.`)) return
    startTransition(async () => {
      try {
        const result = await deleteAccount(id)
        if (!result.ok) alert('오류: ' + result.error)
      } catch (error) {
        alert('오류: ' + (error instanceof Error ? error.message : '계좌를 삭제하지 못했습니다.'))
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-[12.5px] text-[var(--color-subtle)] hover:text-[var(--color-negative)] disabled:opacity-40 px-2 py-1 transition-colors"
    >
      {pending ? '…' : '삭제'}
    </button>
  )
}
