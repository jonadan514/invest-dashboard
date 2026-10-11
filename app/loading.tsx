'use client'

import { usePathname } from 'next/navigation'

const TITLES: Record<string, string> = {
  '/': '샘훈호 자산현황',
  '/budget': '월간 기록',
  '/net-worth': '밸런스 시트',
  '/pension': '연금 현황',
  '/children': '자녀 증여',
}

export default function Loading() {
  const pathname = usePathname()
  if (pathname === '/access') {
    return <main role="status" className="grid min-h-dvh place-items-center bg-[var(--color-sidebar)] text-sm text-white">접근 화면을 준비하고 있습니다…</main>
  }

  return (
    <>
      <div className="page-container max-w-[1600px]" role="status" aria-live="polite" aria-busy="true">
        <h1 className="page-title">{TITLES[pathname] ?? '기록 조회'}</h1>
        <p className="page-subtitle">최신 기록을 불러오고 있습니다…</p>
        <div aria-hidden="true" className="mt-6 space-y-4 motion-safe:animate-pulse">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map(index => (
              <div key={index} className="app-card space-y-4 p-5">
                <div className="h-3 w-16 bg-[var(--color-border)]/40" />
                <div className="h-7 w-3/4 bg-[var(--color-border)]/40" />
                <div className="h-3 w-1/2 bg-[var(--color-border)]/25" />
              </div>
            ))}
          </div>
          <div className="app-card h-64 p-5">
            <div className="h-4 w-40 bg-[var(--color-border)]/40" />
            <div className="mt-6 h-40 bg-[var(--color-section)]" />
          </div>
        </div>
      </div>
    </>
  )
}
