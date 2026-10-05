'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV = [
  { href: '/', label: '홈', icon: '⌂' },
  { href: '/net-worth', label: '순자산', icon: '◫' },
  { href: '/budget', label: '재무 계획', icon: '◎' },
  { href: '/accounts', label: '금융 계좌', icon: '▤' },
  { href: '/pension', label: '연금', icon: '◇' },
  { href: '/children', label: '자녀 자산', icon: '○' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const content = (
    <aside className="w-56 h-screen bg-[#18352d] flex flex-col">
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase text-[#8eaaa0]">Household</p>
          <p className="mt-1 text-sm font-semibold text-white">Asset Management</p>
        </div>
        <button className="md:hidden text-white/60" onClick={() => setMobileOpen(false)}>✕</button>
      </div>

      <nav className="flex-1 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-medium tracking-wider text-[#708d82]">관리</p>
        <div className="space-y-1">
          {NAV.map(item => (
            <NavItem
              key={item.href}
              item={item}
              pathname={pathname}
              onClose={() => setMobileOpen(false)}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition ${
            pathname.startsWith('/settings')
              ? 'bg-white/12 text-white'
              : 'text-[#a7bbb4] hover:bg-white/8 hover:text-white'
          }`}
        >
          <span>⚙</span>
          설정
        </Link>
        <form action="/auth/signout" method="post" className="mt-1">
          <button className="w-full text-left rounded-xl px-3 py-2.5 text-xs text-[#789087] hover:bg-white/8 hover:text-white">
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden md:flex sticky top-0 h-screen shrink-0">{content}</div>

      <button
        className="md:hidden fixed bottom-5 left-5 z-40 h-12 w-12 rounded-full bg-[#18352d] text-white shadow-lg"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
      >
        ☰
      </button>

      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="md:hidden fixed left-0 top-0 z-50 h-full">{content}</div>
        </>
      )}
    </>
  )
}

function NavItem({
  item,
  pathname,
  onClose,
}: {
  item: { href: string; label: string; icon: string }
  pathname: string
  onClose: () => void
}) {
  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition ${
        active
          ? 'bg-[#2b5c4d] text-white font-semibold'
          : 'text-[#a7bbb4] hover:bg-white/8 hover:text-white'
      }`}
    >
      <span className="w-4 text-center text-sm">{item.icon}</span>
      {item.label}
    </Link>
  )
}
