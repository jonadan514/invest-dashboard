'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import BrandLockup from './BrandLockup'
import {
  CalendarRange,
  CandlestickChart,
  ExternalLink,
  FileText,
  Gift,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Plus,
  Scale,
  Settings,
  Sprout,
  X,
  type LucideIcon,
} from 'lucide-react'

interface NavItemData {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

const NAV_GROUPS: { label: string | null; items: NavItemData[] }[] = [
  { label: null, items: [
    { href: '/', label: '대시보드', description: '가족 자산 한눈에', icon: LayoutDashboard },
  ] },
  { label: '월말 기록', items: [
    { href: '/budget', label: '월간 기록', description: '자금·계좌 월말 입력', icon: CalendarRange },
    { href: '/net-worth', label: '밸런스 시트', description: '자산·부채와 순자산', icon: Scale },
  ] },
  { label: '현황', items: [
    { href: '/stocks', label: '주식 계좌', description: '거래 기록·종목별 보유', icon: CandlestickChart },
    { href: '/pension', label: '연금 현황', description: '부부 납입 달성률', icon: Sprout },
    { href: '/mortgage', label: '대출 상환', description: '완납 시점·추가 상환 효과', icon: Landmark },
    { href: '/children', label: '자녀 증여', description: '자녀 계좌·증여 한도', icon: Gift },
  ] },
  { label: '정리', items: [
    { href: '/report', label: '연간 리포트', description: '한 해 결산·인쇄', icon: FileText },
    { href: '/settings', label: '설정', description: '목표·백업 관리', icon: Settings },
  ] },
]

const NAV_ITEMS: NavItemData[] = NAV_GROUPS.flatMap(group => group.items)

function getCurrentLabel(pathname: string) {
  if (pathname === '/guide') return '사용 가이드'
  if (pathname.startsWith('/accounts/')) return '계좌 기록'

  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))?.label ?? '샘훈호 FAMILY OFFICE'
}

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileOpen])

  const sidebarContent = (
    <aside className="flex h-full w-[248px] flex-col bg-[var(--color-sidebar)] text-white">
      <div className="relative flex shrink-0 items-center justify-center border-b border-white/15 px-3.5 py-4">
        <Link href="/" onClick={() => setMobileOpen(false)} className="min-w-0 py-2 opacity-95 transition-opacity hover:opacity-100">
          <BrandLockup priority />
        </Link>
        <button
          type="button"
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-sm text-white/55 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="메뉴 닫기"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="주요 메뉴" className="sidebar-navigation flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 pt-3">
        <div className="space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label ?? 'home'} role="group" aria-label={group.label ?? '대시보드'}>
              {group.label ? <p className="mb-1.5 px-3 text-[11.5px] font-semibold tracking-[0.08em] text-white/38">{group.label}</p> : null}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.href} item={item} pathname={pathname} onClose={() => setMobileOpen(false)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <details className="mx-1 my-4 shrink-0 border border-white/15 bg-white/[0.045] p-3">
          <summary className="cursor-pointer text-xs font-semibold text-blue-50/85">월말 기록 가이드</summary>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-white">월말 기록 순서</p>
            <span className="rounded-full bg-blue-300/15 px-2 py-0.5 text-[11.5px] font-semibold text-blue-100/75">월 1회</span>
          </div>
          <ol className="mt-3 space-y-2.5 text-[11.5px] text-blue-50/65">
            <li className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 font-bold text-blue-100">1</span>공금과 계좌 잔액 기록</li>
            <li className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 font-bold text-blue-100">2</span>자산·부채 변동 확인</li>
            <li className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 font-bold text-blue-100">3</span>연금 납입 현황 확인</li>
          </ol>
          <Link href="/budget" onClick={() => setMobileOpen(false)} className="mt-3 flex min-h-9 items-center justify-center rounded-sm border border-blue-200/20 bg-blue-400/20 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-400/30">
            이번 달 기록하기
          </Link>
          <Link href="/guide" onClick={() => setMobileOpen(false)} className="mt-2 flex min-h-8 items-center justify-center text-[11.5px] font-semibold text-blue-100/70 hover:text-white">
            전체 사용법 보기 →
          </Link>
        </details>

        <div className="mx-1 mt-auto shrink-0 border-t border-white/10 pt-3">
          <a
            href="https://alphadesk-eta.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="w-5" size={15} aria-hidden="true" />
            AlphaDesk
            <span className="ml-auto text-[11.5px] text-white/30">외부</span>
          </a>
          <form action="/api/access/lock" method="post">
            <button
              type="submit"
              className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LockKeyhole className="w-5" size={15} aria-hidden="true" />
              잠그기
            </button>
          </form>
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/10 px-3 py-3">
        <p className="text-center text-[11.5px] text-white/30">월 1회 기록 · 가족 전용</p>
      </div>
    </aside>
  )

  return (
    <>
      <div className="sticky top-0 hidden h-dvh shrink-0 md:block">
        {sidebarContent}
      </div>

      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-sm border border-[var(--color-border)] bg-white text-lg text-[var(--color-ink)]"
          onClick={() => setMobileOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
        >
          <Menu size={19} aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <BrandLockup tone="light" size="compact" />
          <span className="h-7 w-px bg-[var(--color-border)]" aria-hidden="true" />
          <p className="truncate text-sm font-bold text-[var(--color-ink)]">{getCurrentLabel(pathname)}</p>
        </div>
        <Link
          href="/budget"
          className="grid h-10 w-10 place-items-center rounded-sm bg-[var(--color-primary)] text-xl text-white"
          aria-label="이번 달 기록"
        >
          <Plus size={20} aria-hidden="true" />
        </Link>
      </header>

      {mobileOpen ? (
        <div id="mobile-navigation" className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-label="메뉴 닫기"
          />
          <div role="dialog" aria-modal="true" aria-label="전체 메뉴" className="relative h-full w-[248px] shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      ) : null}
    </>
  )
}

function NavItem({
  item,
  pathname,
  onClose,
}: {
  item: NavItemData
  pathname: string
  onClose: () => void
}) {
  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  const Icon = item.icon
  const [fullPrefetch, setFullPrefetch] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearHoverTimer() {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
  }

  useEffect(() => () => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
  }, [])

  return (
    <Link
      href={item.href}
      prefetch={fullPrefetch ? true : null}
      onMouseEnter={() => {
        clearHoverTimer()
        hoverTimer.current = setTimeout(() => setFullPrefetch(true), 150)
      }}
      onMouseLeave={() => {
        clearHoverTimer()
        setFullPrefetch(false)
      }}
      onFocus={() => setFullPrefetch(true)}
      onBlur={() => setFullPrefetch(false)}
      onClick={onClose}
      title={item.description}
      className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors ${
        active
          ? 'bg-white/[0.11] font-bold text-white shadow-[inset_3px_0_0_var(--color-gold)]'
          : 'font-medium text-white/65 hover:bg-white/[0.06] hover:text-white'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <NavigationPending />
      <Icon size={18} strokeWidth={active ? 2.2 : 1.7} className={active ? 'text-[var(--color-gold)]' : 'text-white/55'} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate tracking-[-0.01em]">{item.label}</span>
    </Link>
  )
}

function NavigationPending() {
  const { pending } = useLinkStatus()
  return pending ? (
    <span role="status" className="absolute inset-x-0 bottom-0 h-0.5 bg-[#d8bc83] motion-safe:animate-pulse">
      <span className="sr-only">화면으로 이동 중입니다</span>
    </span>
  ) : null
}
