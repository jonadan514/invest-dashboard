'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/access') return <>{children}</>

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-canvas)] md:flex-row">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        본문으로 건너뛰기
      </a>
      <Suspense fallback={<div className="hidden w-[248px] shrink-0 bg-[var(--color-sidebar)] md:block" />}>
        <Sidebar />
      </Suspense>
      <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
