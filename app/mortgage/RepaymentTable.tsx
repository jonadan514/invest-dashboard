import type { RepaymentRow } from '@/lib/calc/repayment-table'
import { formatMonth, krw } from '@/lib/labels'

/** 월별 상환 내역 표와 다음 달 납부 예정액. 일수에 따라 이자가 달라지는 모습을 보여 준다. */
export default function RepaymentTable({ rows, hasRate, hasPayment }: { rows: RepaymentRow[]; hasRate: boolean; hasPayment: boolean }) {
  const next = rows.find(row => row.kind === 'future') ?? null
  const following = next ? rows[rows.indexOf(next) + 1] : null
  return (
    <section className="app-card overflow-hidden" aria-label="월별 상환 내역">
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="text-[15px] font-bold">월별 상환 내역</h2>
        <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">이자는 잔액 × 연 금리 × 그달 일수 ÷ 365예요. 일수가 다른 달은 이자와 납부액이 조금씩 달라져요.</p>
      </div>

      {!hasRate ? (
        <p className="px-5 py-8 text-center text-[13px] text-[var(--color-muted)]">연 금리를 입력하면 월별 상환 내역이 보여요.</p>
      ) : (
        <>
          {next ? (
            <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] sm:grid-cols-4">
              <Summary label={`${formatMonth(next.month)} 납부 예정`} value={krw(next.total)} strong />
              <Summary label="이자" value={krw(next.interest)} note={`${next.days}일`} />
              <Summary label="정기 원금" value={krw(next.principal)} />
              <Summary label="다음 달과 차이" value={following ? `${following.total - next.total > 0 ? '+' : ''}${krw(following.total - next.total).replace('₩-', '-₩')}` : '—'} note={following ? `${following.days}일` : undefined} />
            </div>
          ) : null}
          {!hasPayment ? (
            <p className="border-b border-[var(--color-border)] px-5 py-3 text-[12.5px] text-[var(--color-accent)]">월 상환액을 입력하면 앞으로의 상환 일정이 보여요.</p>
          ) : null}
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--color-muted)]">보여 줄 상환 내역이 아직 없어요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[12.5px] text-[var(--color-muted)]">
                    <th className="px-5 py-2.5 text-left font-semibold">달</th>
                    <th className="px-3 py-2.5 text-right font-semibold">일수</th>
                    <th className="px-3 py-2.5 text-right font-semibold">이자</th>
                    <th className="px-3 py-2.5 text-right font-semibold">원금</th>
                    <th className="px-3 py-2.5 text-right font-semibold">납부액</th>
                    <th className="px-5 py-2.5 text-right font-semibold">상환 후 잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.month} className={`border-b border-[var(--color-section)] last:border-0 ${row === next ? 'bg-[var(--color-primary-soft)]' : ''}`}>
                      <td className="px-5 py-2.5 font-semibold">{formatMonth(row.month)} <span className="ml-1 text-[11.5px] font-normal text-[var(--color-muted)]">{row.kind === 'past' ? '기록' : row === next ? '예정' : '예상'}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-muted)]">{row.days}일</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{krw(row.interest)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{krw(row.principal)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{krw(row.total)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-[var(--color-muted)]">{krw(row.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-5 py-3 text-[11.5px] leading-4 text-[var(--color-subtle)]">‘기록’은 잔액 기록의 변화로, ‘예정·예상’은 위에 입력한 금리와 월 상환액으로 계산해요. 실제 납부액은 은행 조회 결과를 확인하세요.</p>
        </>
      )}
    </section>
  )
}

function Summary({ label, value, note, strong = false }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className="bg-white px-5 py-3">
      <p className="text-[11.5px] font-semibold text-[var(--color-muted)]">{label}{note ? ` · ${note}` : ''}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? 'text-[18px] font-bold' : 'text-[15px] font-semibold'}`}>{value}</p>
    </div>
  )
}
