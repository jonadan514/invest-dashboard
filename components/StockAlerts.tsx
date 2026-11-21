import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { StockAlert } from '@/lib/calc/stock-alerts'

/** 주식 알림 목록. 없으면 아무것도 그리지 않는다. */
export default function StockAlerts({ alerts, limit = 4, label = '주식 알림', embedded = false, compact = false }: { alerts: StockAlert[]; limit?: number; label?: string; embedded?: boolean; compact?: boolean }) {
  if (alerts.length === 0) return null
  const shown = alerts.slice(0, limit)
  if (compact) {
    // 알림 하나를 한 줄로: [구분] 제목 · 설명(넓은 화면에서만) ›
    return (
      <section aria-label={label} className="app-card overflow-hidden">
        <ul className="divide-y divide-[var(--color-border)]">
          {shown.map(alert => (
            <li key={alert.id}>
              <Link href={alert.href} className="flex min-h-10 items-center gap-2 px-4 py-2 text-[13px] hover:bg-[var(--color-section)]">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11.5px] font-bold ${alert.level === 'warn' ? 'bg-[var(--color-negative-soft)] text-[var(--color-negative)]' : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'}`}>{alert.level === 'warn' ? '확인 필요' : '참고'}</span>
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-[var(--color-ink)]">{alert.title}</span>
                  <span className="hidden text-[var(--color-muted)] sm:inline"> · {alert.detail}</span>
                </span>
                <ChevronRight size={14} aria-hidden="true" className="ml-auto shrink-0 text-[var(--color-subtle)]" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  return (
    <section aria-label={label} className={embedded ? 'overflow-hidden' : 'app-card overflow-hidden'}>
      <ul className="divide-y divide-[var(--color-border)]">
        {shown.map(alert => (
          <li key={alert.id} className="relative">
            <span className={`absolute inset-y-0 left-0 w-1 ${alert.level === 'warn' ? 'bg-[var(--color-negative)]' : 'bg-[var(--color-gold)]'}`} aria-hidden="true" />
            <Link href={alert.href} className="flex flex-col gap-0.5 px-5 py-3 hover:bg-[var(--color-section)]">
              <span className={`text-[11.5px] font-bold ${alert.level === 'warn' ? 'text-[var(--color-negative)]' : 'text-[var(--color-accent)]'}`}>{alert.level === 'warn' ? '확인 필요' : '참고'}</span>
              <span className="text-[13.5px] font-bold text-[var(--color-ink)]">{alert.title}</span>
              <span className="text-[12.5px] text-[var(--color-muted)]">{alert.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
      {alerts.length > shown.length ? <p className="border-t border-[var(--color-border)] px-5 py-2 text-[12.5px] text-[var(--color-muted)]">알림 {alerts.length - shown.length}개 더 있어요. 주식 계좌 화면에서 모두 볼 수 있어요.</p> : null}
    </section>
  )
}
