import Link from 'next/link'
import type { SavingsPoint } from '@/lib/calc/savings'
import { compactKrw, formatMonth } from '@/lib/labels'

interface Props {
  points: SavingsPoint[]
  average: { months: number; rate: number } | null
  hasIncome: boolean
}

export default function SavingsCard({ points, average, hasIncome }: Props) {
  const latest = points.at(-1) ?? null

  if (!hasIncome || !latest) {
    return (
      <article className="app-card flex flex-col border-dashed p-5 lg:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">Savings rate</p>
        <h2 className="mt-1 text-sm font-bold text-[var(--color-ink)]">저축률</h2>
        <p className="mt-3 text-[11px] leading-5 text-[var(--color-muted)]">
          {!hasIncome
            ? '설정에 월 소득을 입력하면 월간 기록으로 저축률과 추이를 계산해 드려요.'
            : '월간 기록을 저장하면 저축률이 표시돼요.'}
        </p>
        <Link href={!hasIncome ? '/settings' : '/budget'} className="mt-auto w-fit pt-4 text-[11px] font-semibold text-[var(--color-primary)] hover:underline">
          {!hasIncome ? '월 소득 입력하기' : '월간 기록하기'} →
        </Link>
      </article>
    )
  }

  const recent = points.slice(-6)
  const maxRate = Math.max(...recent.map(point => point.rate ?? 0), 1)

  return (
    <article className="app-card flex flex-col p-5 lg:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{formatMonth(latest.month)} 기록</p>
          <h2 className="mt-1 text-sm font-bold text-[var(--color-ink)]">저축률</h2>
        </div>
        <strong className="text-lg tabular-nums text-[var(--color-ink)]">{latest.rate === null ? '—' : `${Math.round(latest.rate)}%`}</strong>
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-muted)]">
        소득 {compactKrw(latest.income)} 중 <strong className="tabular-nums text-[var(--color-ink)]">{compactKrw(latest.saving)}</strong> 배분
      </p>
      {latest.principal > 0 && latest.rateWithPrincipal !== null ? (
        <p className="mt-0.5 text-[10px] text-[var(--color-subtle)]">주담대 정기 원금 포함 시 {Math.round(latest.rateWithPrincipal)}%</p>
      ) : null}

      <div className="mt-4 flex h-16 items-end gap-1.5 lg:mt-3" role="img" aria-label={`최근 ${recent.length}개월 저축률`}>
        {recent.map(point => (
          <div key={point.month} className="flex h-full flex-1 flex-col items-center gap-1">
            <div className="flex min-h-0 w-full flex-1 items-end justify-center">
              <div
                className={`w-full max-w-7 rounded-t-sm ${point.month === latest.month ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-primary)]/35'}`}
                style={{ height: `${Math.max((point.rate ?? 0) / maxRate * 100, 4)}%` }}
                title={`${formatMonth(point.month)} ${point.rate === null ? '-' : `${Math.round(point.rate)}%`}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-[var(--color-subtle)]">{Number(point.month.slice(5))}월</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-[var(--color-muted)]">{average ? `최근 ${average.months}개월 평균 ${Math.round(average.rate)}%` : ''}</span>
        <Link href="/budget" className="shrink-0 font-semibold text-[var(--color-primary)] hover:underline">기록 →</Link>
      </div>
    </article>
  )
}
