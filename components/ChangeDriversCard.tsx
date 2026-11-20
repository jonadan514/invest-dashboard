import Link from 'next/link'
import type { ChangeDriver } from '@/lib/calc/home-insights'
import { formatMonth, signedCompactKrw } from '@/lib/labels'

interface Props {
  fromMonth: string | null
  toMonth: string
  totalChange: number
  drivers: ChangeDriver[]
  limit?: number
}

const SOURCE_LABEL: Record<ChangeDriver['source'], string> = {
  account: '계좌',
  asset: '자산',
  liability: '부채',
}

export default function ChangeDriversCard({ fromMonth, toMonth, totalChange, drivers, limit = 5 }: Props) {
  const visible = drivers.slice(0, limit)
  const rest = drivers.slice(limit)
  const restChange = rest.reduce((sum, driver) => sum + driver.change, 0)
  const maxChange = Math.max(...visible.map(driver => Math.abs(driver.change)), Math.abs(restChange), 1)

  return (
    <article className="app-card flex flex-col p-5 lg:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">순자산 변화 요인</h2>
          <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{fromMonth ? `${formatMonth(fromMonth)} → ${formatMonth(toMonth)}` : '지난달과 비교'}</p>
        </div>
        {fromMonth ? (
          <strong className={`shrink-0 text-[22px] font-extrabold leading-none tracking-[-0.03em] tabular-nums ${toneClass(totalChange)}`}>{signedCompactKrw(totalChange)}</strong>
        ) : null}
      </div>

      {!fromMonth ? (
        <p className="mt-4 rounded-lg bg-[var(--color-canvas)]/75 px-3 py-6 text-center text-[12.5px] leading-5 text-[var(--color-muted)]">
          두 달 이상 기록하면 어떤 계좌와 항목이<br />순자산을 움직였는지 보여 드려요.
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-lg bg-[var(--color-canvas)]/75 px-3 py-6 text-center text-[12.5px] text-[var(--color-muted)]">
          지난달과 달라진 금액이 없어요.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5 lg:mt-3 lg:space-y-2">
          {visible.map(driver => (
            <DriverRow key={driver.key} label={driver.label} tag={SOURCE_LABEL[driver.source]} change={driver.change} max={maxChange} />
          ))}
          {rest.length > 0 ? (
            <DriverRow label={`그 외 ${rest.length}개`} tag={null} change={restChange} max={maxChange} muted />
          ) : null}
        </ul>
      )}

      {fromMonth && drivers.length > 0 ? (
        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3 text-center">
          {(['account', 'asset', 'liability'] as const).map(source => {
            const sum = drivers.filter(driver => driver.source === source).reduce((total, driver) => total + driver.change, 0)
            return (
              <div key={source} className="rounded-lg bg-[var(--color-canvas)]/75 px-2 py-2">
                <dt className="text-[11.5px] text-[var(--color-muted)]">{SOURCE_LABEL[source]}{source === 'liability' ? ' 감소' : ''}</dt>
                <dd className={`mt-0.5 text-[13px] font-bold tabular-nums ${sum === 0 ? 'text-[var(--color-subtle)]' : toneClass(sum)}`}>{sum === 0 ? '변화 없음' : signedCompactKrw(sum)}</dd>
              </div>
            )
          })}
        </dl>
      ) : null}

      <div className={`${fromMonth && drivers.length > 0 ? '' : 'mt-auto '}pt-3 text-right`}>
        <Link href="/net-worth" className="inline-flex min-h-8 items-center text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">밸런스 시트 보기 →</Link>
      </div>
    </article>
  )
}

function DriverRow({ label, tag, change, max, muted = false }: { label: string; tag: string | null; change: number; max: number; muted?: boolean }) {
  const width = Math.max(Math.abs(change) / max * 100, change === 0 ? 0 : 2)
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[12.5px]">
      <span className="flex min-w-0 items-center gap-1.5">
        {tag ? <span className="shrink-0 rounded-sm bg-[var(--color-section)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--color-muted)]">{tag}</span> : null}
        <span className={`truncate ${muted ? 'text-[var(--color-muted)]' : 'font-semibold text-[var(--color-ink)]'}`}>{label}</span>
      </span>
      <span className={`text-right font-semibold tabular-nums ${toneClass(change)}`}>{signedCompactKrw(change)}</span>
      <span className="col-span-2 h-1 overflow-hidden rounded-full bg-[var(--color-border)]/60" aria-hidden="true">
        <span className={`block h-full rounded-full ${change >= 0 ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-negative)]'}`} style={{ width: `${width}%` }} />
      </span>
    </li>
  )
}

function toneClass(value: number) {
  if (value > 0) return 'text-[var(--color-positive-strong)]'
  if (value < 0) return 'text-[var(--color-negative)]'
  return 'text-[var(--color-ink)]'
}
