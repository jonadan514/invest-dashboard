'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBackupNow } from './actions'

export default function BackupNowButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function run() {
    setMessage(null)
    startTransition(async () => {
      try {
        await createBackupNow()
        setMessage('백업을 저장했습니다.')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '백업에 실패했습니다.')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={pending} className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {pending ? '백업 중…' : '지금 백업하기'}
      </button>
      {message ? <span role="status" className="text-[12.5px] text-[var(--color-muted)]">{message}</span> : null}
    </div>
  )
}
