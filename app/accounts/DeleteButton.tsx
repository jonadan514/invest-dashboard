'use client'
import { useTransition } from 'react'
import { deleteAccount } from './actions'

export default function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`"${name}" 계좌를 삭제할까요?\n거래 내역도 함께 삭제됩니다.`)) return
    startTransition(() => deleteAccount(id))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-[#b5aa98] hover:text-red-500 disabled:opacity-40 px-2 py-1 transition-colors"
    >
      {pending ? '…' : '삭제'}
    </button>
  )
}
