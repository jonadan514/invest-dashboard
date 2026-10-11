'use client'
import { useTransition } from 'react'
import { deleteAccount } from './actions'

export default function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`"${name}" 계좌를 삭제할까요?\n월별 평가 기록도 함께 삭제됩니다.`)) return
    startTransition(() => deleteAccount(id))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-[#93a2b5] hover:text-red-500 disabled:opacity-40 px-2 py-1 transition-colors"
    >
      {pending ? '…' : '삭제'}
    </button>
  )
}
