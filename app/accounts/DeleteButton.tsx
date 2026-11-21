'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAccount } from './actions'

/** redirectTo가 있으면 삭제한 뒤 그 화면으로 옮긴다(계좌 상세 화면에서 쓰는 경우). */
export default function DeleteButton({ id, name, label = '삭제', redirectTo }: { id: string; name: string; label?: string; redirectTo?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`"${name}" 계좌를 삭제할까요?\n월별 평가 기록도 함께 삭제됩니다.`)) return
    startTransition(async () => {
      try {
        const result = await deleteAccount(id)
        if (!result.ok) alert('오류: ' + result.error)
        else if (redirectTo) router.push(redirectTo)
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
      {pending ? '삭제 중…' : label}
    </button>
  )
}
