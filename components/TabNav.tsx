import Link from 'next/link'
import type { ReactNode } from 'react'
import LinkPending from './LinkPending'

/** 화면 안 탭 묶음(주식·대출·밸런스 시트 공통 모양). */
export const TAB_LIST = 'flex w-fit max-w-full flex-wrap gap-0.5 rounded-xl bg-white p-1 shadow-[var(--shadow-card)]'

export function tabClass(active: boolean) {
  return `inline-flex min-h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold transition-colors ${active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted)] hover:bg-[var(--color-section)] hover:text-[var(--color-ink)]'}`
}

export default function TabNav({ label, items, active }: { label: string; items: { value: string; label: ReactNode; href: string }[]; active: string }) {
  return (
    <nav aria-label={label} className={TAB_LIST}>
      {items.map(item => (
        <Link key={item.value} href={item.href} aria-current={active === item.value ? 'page' : undefined} className={tabClass(active === item.value)}>{item.label}<LinkPending /></Link>
      ))}
    </nav>
  )
}
