'use client'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'

const NAV_TOP = [
  { href: '/', label: '대시보드', icon: '📊' },
]

const NAV_PLAN = [
  { href: '/budget',    label: '재무 계획',    icon: '🏠' },
  { href: '/accounts',  label: '계좌관리',     icon: '💳' },
  { href: '/pension',   label: '연금현황',     icon: '🏦' },
  { href: '/dividends', label: '배당/현금흐름', icon: '💰' },
]

const NAV_TRADE = [
  { href: '/holdings',     label: '보유종목', icon: '📈' },
  { href: '/transactions', label: '거래내역', icon: '📋' },
  { href: '/journal',      label: '매매일지', icon: '📝' },
]

const NAV_BOTTOM = [
  { href: '/settings', label: '설정', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const owner = searchParams.get('owner') ?? 'all'
  const [mobileOpen, setMobileOpen] = useState(false)

  function setOwner(o: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (o === 'all') params.delete('owner')
    else params.set('owner', o)
    router.push(`${pathname}?${params.toString()}`)
  }

  const sidebarContent = (
    <aside className="w-52 flex flex-col h-screen bg-[#15271d]">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#243d2b] flex items-center justify-between">
        <span className="text-white font-bold text-sm">🌿 우리집 투자</span>
        {/* Mobile close */}
        <button
          className="md:hidden text-[#6b7f73] hover:text-white p-1 -mr-1"
          onClick={() => setMobileOpen(false)}
        >
          ✕
        </button>
      </div>

      {/* Add Transaction */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/transactions/new"
          onClick={() => setMobileOpen(false)}
          className="block w-full text-center bg-[#1c6b4a] hover:bg-[#165638] text-white text-xs font-semibold rounded-lg py-2 transition-colors"
        >
          + 거래 입력
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 pt-2 overflow-y-auto">
        {/* 대시보드 */}
        {NAV_TOP.map(item => <NavItem key={item.href} item={item} pathname={pathname} onClose={() => setMobileOpen(false)} />)}

        {/* 자산 관리 */}
        <p className="text-[#4a6b56] text-[10px] font-semibold px-3 pt-4 pb-1 tracking-wider uppercase">자산 관리</p>
        {NAV_PLAN.map(item => <NavItem key={item.href} item={item} pathname={pathname} onClose={() => setMobileOpen(false)} />)}

        {/* 거래 */}
        <p className="text-[#4a6b56] text-[10px] font-semibold px-3 pt-4 pb-1 tracking-wider uppercase">거래</p>
        {NAV_TRADE.map(item => <NavItem key={item.href} item={item} pathname={pathname} onClose={() => setMobileOpen(false)} />)}

        {/* 설정 */}
        <div className="pt-4">
          {NAV_BOTTOM.map(item => <NavItem key={item.href} item={item} pathname={pathname} onClose={() => setMobileOpen(false)} />)}
        </div>

        {/* 외부 도구 */}
        <div className="pt-2 pb-2">
          <a
            href="https://alphadesk-eta.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#a8bfb0] hover:bg-[#243d2b] hover:text-white transition-colors"
          >
            <span className="text-sm">🔭</span>
            AlphaDesk
            <span className="ml-auto text-[10px] text-[#4a6b56]">↗</span>
          </a>
        </div>
      </nav>

      {/* Owner filter */}
      <div className="px-3 pt-3 border-t border-[#243d2b]">
        <p className="text-[#6b7f73] text-[10px] mb-1.5 px-1">계좌 보기</p>
        <div className="flex gap-1 mb-3">
          {(['all', 'me', 'spouse'] as const).map(v => {
            const label = v === 'all' ? '전체' : v === 'me' ? '나' : '아내'
            const active = owner === v
            return (
              <button
                key={v}
                onClick={() => setOwner(v)}
                className={`flex-1 text-[10px] py-1 rounded-md font-medium transition-colors ${
                  active
                    ? v === 'spouse'
                      ? 'bg-[#6b3fa0] text-white'
                      : 'bg-[#1c6b4a] text-white'
                    : 'text-[#a8bfb0] hover:bg-[#243d2b]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <form action="/auth/signout" method="post" className="pb-4">
          <button className="w-full text-[10px] text-[#6b7f73] hover:text-[#a8bfb0] transition-colors">
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex sticky top-0 h-screen shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed bottom-5 left-5 z-40 bg-[#15271d] text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg text-lg"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
      >
        ☰
      </button>

      {/* Mobile overlay + sidebar */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed left-0 top-0 z-50 h-full shadow-2xl">
            {sidebarContent}
          </div>
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
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
        active
          ? 'bg-[#1c6b4a] text-white font-semibold'
          : 'text-[#a8bfb0] hover:bg-[#243d2b] hover:text-white'
      }`}
    >
      <span className="text-sm">{item.icon}</span>
      {item.label}
    </Link>
  )
}
