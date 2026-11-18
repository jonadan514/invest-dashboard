import Link from 'next/link'
import type { RepaymentRow } from '@/lib/calc/repayment-table'
import { formatMonth, krw } from '@/lib/labels'

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
}

const PAYMENT_NOTE: Record<LoanOverview['paymentSource'], string> = {
  item: '밸런스 시트에 입력한 값',
  maturity: '잔액·금리·만기로 계산',
  budget: '최근 월간 기록의 이자 + 원금',
  none: '입력 필요',
}

/** 대출 한 건의 요약, 상환 이력, 월별 상환 예정. 값은 밸런스 시트와 월간 기록에서 가져오고 여기서는 입력하지 않는다. */
export default function LoanRepayment({ loan, past, future }: { loan: LoanOverview; past: RepaymentRow[]; future: RepaymentRow[] }) {
  const next = future[0] ?? null
  return (
    <div className="space-y-4">
      <section className="app-card overflow-hidden" aria-label={`${loan.name} 요약`}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="text-[11.5px] font-bold text-[var(--color-primary)]">{loan.name} · {formatMonth(loan.balanceMonth)} 납부 후 잔액</p>
            <p className="mt-1 text-[26px] font-bold tabular-nums leading-none">{krw(loan.balance)}</p>
          </div>
          <Link href="/net-worth" className="inline-flex min-h-8 items-center text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">대출 정보 고치기 →</Link>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px border-t border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
          <Item label="연 금리" value={loan.annualRate === null ? '입력 필요' : `${loan.annualRate}%`} note={loan.rateSource === 'estimated' ? '월간 기록으로 추정' : undefined} />
          <Item label="월 상환액(원리금)" value={loan.monthlyPayment === null ? '입력 필요' : krw(loan.monthlyPayment)} note={PAYMENT_NOTE[loan.paymentSource]} />
          <Item label="만기" value={loan.maturityDate ?? '—'} note={loan.remainingPayments !== null ? `남은 ${loan.remainingPayments.toLocaleString('ko-KR')}회` : undefined} />
          <Item label={next ? `${formatMonth(next.month)} 납부 예정` : '다음 납부'} value={next ? krw(next.total) : '—'} note={next ? `원금 ${krw(next.principal)} · 이자 ${krw(next.interest)}` : undefined} strong />
        </dl>
      </section>

      <Rows title="상환 이력" rows={past} empty="아직 상환 이력이 없어요. 밸런스 시트에 지난 달 잔액을 입력하거나 월간 기록에 이자·원금을 적으면 여기에 쌓여요."
        caption="‘실제’는 월간 기록에 적은 이자·원금, ‘계산’은 잔액 기록의 변화예요." />
      <Rows title="월별 상환 예정" rows={future} empty={loan.annualRate === null || loan.monthlyPayment === null ? '연 금리와 월 상환액(또는 만기)을 밸런스 시트에 입력하면 앞으로의 일정이 보여요.' : '남은 상환 일정이 없어요.'}
        caption="이자는 납부 전 잔액 × 연 금리 ÷ 12(원 미만 버림), 원금은 월 상환액에서 이자를 뺀 값이에요. 금리가 바뀌면 달라져요." highlight={next?.month} />
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

function Rows({ title, rows, empty, caption, highlight }: { title: string; rows: RepaymentRow[]; empty: string; caption: string; highlight?: string }) {
  return (
    <section className="app-card overflow-hidden" aria-label={title}>
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="text-[15px] font-bold">{title} {rows.length > 0 ? <span className="ml-1 text-[13px] font-semibold text-[var(--color-muted)]">{rows.length}개월</span> : null}</h2>
        <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{caption}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-[var(--color-muted)]">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[12.5px] text-[var(--color-muted)]">
                <th className="px-5 py-2.5 text-left font-semibold">납부 달</th>
                <th className="px-3 py-2.5 text-right font-semibold">원금</th>
                <th className="px-3 py-2.5 text-right font-semibold">이자</th>
                <th className="px-3 py-2.5 text-right font-semibold">납부액</th>
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
                  <td className="px-3 py-2.5 text-right tabular-nums">{krw(row.principal)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{krw(row.interest)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{krw(row.total)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-[var(--color-muted)]">{row.balanceAfter === null ? '—' : krw(row.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
