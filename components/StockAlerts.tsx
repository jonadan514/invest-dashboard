import Link from 'next/link'
import type { StockAlert } from '@/lib/calc/stock-alerts'

/** 주식 알림 목록. 없으면 아무것도 그리지 않는다. */
export default function StockAlerts({ alerts, limit = 4, label = '주식 알림' }: { alerts: StockAlert[]; limit?: number; label?: string }) {
  if (alerts.length === 0) return null
  const shown = alerts.slice(0, limit)
  return (
    <section aria-label={label} className="app-card overflow-hidden">
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
      {alerts.length > shown.length ? <p className="border-t border-[var(--color-border)] px-5 py-2 text-[12px] text-[var(--color-muted)]">알림 {alerts.length - shown.length}개 더 있어요. 주식 계좌 화면에서 모두 볼 수 있어요.</p> : null}
    </section>
  )
}
