import Link from 'next/link'
import type { RepaymentRow } from '@/lib/calc/repayment-table'
import { addMonths } from '@/lib/calc/home-insights'
import { formatMonth, krw } from '@/lib/labels'
import Hint from '@/components/Hint'

export interface LoanOverview {
  id: string
  name: string
  balance: number
  balanceMonth: string
  annualRate: number | null
  rateSource: 'item' | 'estimated' | 'none'
  monthlyPayment: number | null
  paymentSource: 'item' | 'maturity' | 'budget' | 'none'
  maturityDate: string | null
  remainingPayments: number | null
  /** 금리와 월 상환액(또는 만기)이 있어 매달 잔액이 자동으로 줄어든다. */
  auto: boolean
}

const PAYMENT_NOTE: Record<LoanOverview['paymentSource'], string> = {
  item: '밸런스 시트에 입력한 값',
  maturity: '잔액·금리·만기로 계산',
  budget: '최근 월간 기록의 이자 + 원금',
  none: '입력 필요',
}

/** 대출 한 건의 요약, 상환 이력, 월별 상환 예정. 값은 밸런스 시트와 월간 기록에서 가져오고 여기서는 입력하지 않는다. */
export default function LoanRepayment({ loan, past, future, showAll = false }: { loan: LoanOverview; past: RepaymentRow[]; future: RepaymentRow[]; showAll?: boolean }) {
  const shownFuture = showAll ? future : future.slice(0, 6)
  const next = future[0] ?? null
  return (
    <div className="space-y-4">
      <section className="app-card overflow-hidden" aria-label={`${loan.name} 요약`}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold text-[var(--color-primary)]">
              {loan.name} · {formatMonth(loan.balanceMonth)} 납부 후 잔액
              {loan.auto ? <span className="rounded bg-[var(--color-positive-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-positive-strong)]">자동 상환</span> : null}
            </p>
            <p className="mt-1 text-[26px] font-bold tabular-nums leading-none">{krw(loan.balance)}</p>
          </div>
          <Link href="/net-worth?view=settings" className="inline-flex min-h-8 items-center text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">대출 정보 고치기 →</Link>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px border-t border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
          <Item label="연 금리" value={loan.annualRate === null ? '입력 필요' : `${loan.annualRate}%`} note={loan.rateSource === 'estimated' ? '월간 기록으로 추정' : undefined} />
          <Item label="월부금(원리금)" value={loan.monthlyPayment === null ? '입력 필요' : krw(loan.monthlyPayment)} note={PAYMENT_NOTE[loan.paymentSource]} />
          <Item label="만기" value={loan.maturityDate ?? '—'} note={loan.remainingPayments !== null ? `남은 ${loan.remainingPayments.toLocaleString('ko-KR')}회` : undefined} />
          <Item label={next ? `${formatMonth(next.month)} 납부 예정` : '다음 납부'} value={next ? krw(next.total) : '—'} note={next ? `원금 상환 ${krw(next.principal)} · 이자 ${krw(next.interest)}` : undefined} strong />
        </dl>
      </section>

      <Rows title="상환 이력" rows={past} empty="아직 상환 이력이 없어요. 밸런스 시트 잔액 이력에 지난 달 잔액을 넣거나 월간 기록에 이자·원금을 적으면 쌓여요."
        hint="‘실제’는 월간 기록에 적은 이자·원금·추가 상환, ‘계산’은 잔액 기록의 변화예요. 추가 상환은 월간 기록의 ‘추가 원금 상환’에 적으면 잔액에서 빠져요." />
      <Rows title="월별 상환 예정" rows={shownFuture} empty={loan.annualRate === null || loan.monthlyPayment === null ? '연 금리와 월 상환액(또는 만기)을 밸런스 시트에 입력하면 앞으로의 일정이 보여요.' : '남은 상환 일정이 없어요.'}
        hint={`월부금(${loan.monthlyPayment === null ? '입력 필요' : krw(loan.monthlyPayment)})은 매달 같고, 이자(납부 전 잔액 × 연 금리 ÷ 12, 원 미만 버림)가 줄어드는 만큼 원금 상환이 늘어나요.`} highlight={next?.month}
        more={future.length > 6 ? { href: showAll ? '/mortgage' : '/mortgage?months=12', label: showAll ? '6개월만 보기' : `${future.length}개월 모두 보기` } : undefined} />
    </div>
  )
}

function Item({ label, value, note, strong = false }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className="bg-white px-5 py-3">
      <dt className="text-[11.5px] font-semibold text-[var(--color-muted)]">{label}</dt>
      <dd className={`mt-0.5 tabular-nums ${strong ? 'text-[17px] font-bold' : 'text-[15px] font-semibold'}`}>{value}</dd>
      {note ? <dd className="mt-0.5 text-[11.5px] text-[var(--color-subtle)]">{note}</dd> : null}
    </div>
  )
}

function Rows({ title, rows, empty, hint, highlight, more }: { title: string; rows: RepaymentRow[]; empty: string; hint: string; highlight?: string; more?: { href: string; label: string } }) {
  const hasExtra = rows.some(row => (row.extra ?? 0) > 0)
  // 원금 상환이 지난달보다 얼마나 늘었는지(같은 표 안의 바로 전 달과 비교).
  const byMonth = new Map(rows.map(row => [row.month, row]))
  const principalChange = (row: RepaymentRow) => {
    const before = byMonth.get(addMonths(row.month, -1))
    return before ? row.principal - before.principal : null
  }
  return (
    <section className="app-card overflow-hidden" aria-label={title}>
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="flex items-center gap-1 text-[15px] font-bold">{title} {rows.length > 0 ? <span className="text-[13px] font-semibold text-[var(--color-muted)]">{rows.length}개월</span> : null}<Hint text={hint} /></h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-[var(--color-muted)]">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[12.5px] text-[var(--color-muted)]">
                <th className="px-5 py-2.5 text-left font-semibold">납부 달</th>
                <th className="px-3 py-2.5 text-right font-semibold">원금 상환</th>
                <th className="px-3 py-2.5 text-right font-semibold">이자</th>
                {hasExtra ? <th className="px-3 py-2.5 text-right font-semibold">추가 상환</th> : null}
                <th className="px-5 py-2.5 text-right font-semibold">납부 후 잔액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.month} className={`border-b border-[var(--color-section)] last:border-0 ${row.month === highlight ? 'bg-[var(--color-primary-soft)]' : ''}`}>
                  <td className="px-5 py-2.5 font-semibold">
                    {formatMonth(row.month)}
                    {row.kind === 'past' ? <span className="ml-1.5 text-[11.5px] font-normal text-[var(--color-muted)]">{row.recorded ? '실제' : '계산'}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className="font-bold text-[var(--color-ink)]">{krw(row.principal)}</span>
                    {(() => {
                      const change = principalChange(row)
                      return change ? <span className={`ml-1.5 text-[11.5px] font-semibold ${change > 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{change > 0 ? '+' : '−'}{Math.abs(change).toLocaleString('ko-KR')}</span> : null
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-muted)]">{krw(row.interest)}</td>
                  {hasExtra ? <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-positive-strong)]">{(row.extra ?? 0) > 0 ? krw(row.extra!) : '—'}</td> : null}
                  <td className="px-5 py-2.5 text-right tabular-nums text-[var(--color-muted)]">{row.balanceAfter === null ? '—' : krw(row.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {more ? (
        <div className="border-t border-[var(--color-border)] px-5 py-2.5 text-center">
          <Link href={more.href} scroll={false} className="inline-flex min-h-8 items-center text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">{more.label}</Link>
        </div>
      ) : null}
    </section>
  )
}
