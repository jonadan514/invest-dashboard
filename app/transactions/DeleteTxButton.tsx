'use client'
import { useTransition } from 'react'
import { deleteTransaction } from './actions'

export default function DeleteTxButton({ id }: { id: string }) {
  const [pending, start] = useTransition()

  function handleClick() {
    if (!confirm('이 거래를 삭제할까요?')) return
    start(() => deleteTransaction(id))
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-[10px] text-[#93a2b5] hover:text-red-500 disabled:opacity-40 transition-colors px-1"
    >
      {pending ? '…' : '삭제'}
    </button>
  )
}
