'use client'

import { useLinkStatus } from 'next/link'

/**
 * <Link> 안에 넣으면, 누른 뒤 새 화면을 불러오는 동안 작은 회전 표시를 보여 준다.
 * 탭·메뉴·필터 칩처럼 눌러도 화면이 바로 바뀌지 않는 링크에 쓴다.
 */
export default function LinkPending({ tone = 'current' }: { tone?: 'current' | 'light' }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span role="status" className="inline-flex shrink-0 items-center">
      <span aria-hidden="true" className={`size-3.5 animate-spin rounded-full border-2 border-t-transparent ${tone === 'light' ? 'border-white/80' : 'border-current'}`} />
      <span className="sr-only">불러오는 중</span>
    </span>
  )
}
