import { Suspense } from 'react'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#ece5d6]">
      <Suspense fallback={<div className="hidden md:block w-52 shrink-0 bg-[#15271d]" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
