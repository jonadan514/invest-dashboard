import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { Account, AccountMonthlySnapshot } from '@/lib/types'

const TYPE_LABEL: Partial<Record<Account['type'], string>> = {
  cash: '입출금·공동계좌', mmf: 'CMA·MMF', general: '주식·증권계좌', pension: '연금저축', irp: 'IRP', isa: 'ISA', crypto: '코인',
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, userId } = await getHouseholdContext()
  const [{ data: accountRow }, { data: snapshotRows }] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', id).eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('account_monthly_snapshots').select('*').eq('user_id', userId).eq('account_id', id).order('month', { ascending: false }).limit(36).throwOnError(),
  ])
  if (!accountRow) notFound()

  const account = accountRow as Account
  const snapshots = (snapshotRows ?? []) as AccountMonthlySnapshot[]
  const latest = snapshots[0] ?? null
  const previous = snapshots[1] ?? null
  const evaluationChange = latest && previous
    ? Number(latest.evaluation_amount) - Number(previous.evaluation_amount)
    : null
  const isPension = account.type === 'pension' || account.type === 'irp'
  const now = new Date()
  const currentMonth = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul' }).format(now)

  return (
    <>
      <div className="page-container max-w-[1100px]">
        <Link href="/net-worth" className="mb-4 inline-block text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)]">← 밸런스 시트</Link>

        <header className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${account.owner === 'spouse' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {account.owner === 'spouse' ? '아내' : '나'}
              </span>
              <span className="rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-[10px] text-[var(--color-muted)]">{TYPE_LABEL[account.type] ?? account.type}</span>
            </div>
            <h1 className="page-title">{account.name}</h1>
            <p className="page-subtitle">{account.broker ? `${account.broker} · ` : ''}월말 평가금액 기록</p>
          </div>
          <Link href={`/budget?month=${currentMonth}`} className="inline-flex min-h-10 w-fit items-center rounded-lg bg-[var(--color-primary)] px-4 text-xs font-semibold text-white hover:bg-[var(--color-primary-strong)]">
            이번 달 기록하기
          </Link>
        </header>

        <section className={`mb-5 grid grid-cols-1 gap-3 ${isPension ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <MetricCard label="최근 평가금액" value={latest ? Number(latest.evaluation_amount) : null} detail={latest ? formatMonth(latest.month) : '기록 없음'} />
          <MetricCard label="전월 기록 대비" value={evaluationChange} signed detail={previous ? `${formatMonth(previous.month)} 대비` : '비교 기록 필요'} />
          {isPension ? <MetricCard label={`${currentMonth.slice(0, 4)}년 누적 납입`} value={latest?.month.startsWith(currentMonth.slice(0, 4)) ? Number(latest.ytd_contribution) : null} detail="세액공제 달성률에 반영" /> : null}
        </section>

        <section className="app-card overflow-hidden">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-section)] px-5 py-3.5">
            <h2 className="text-base font-bold text-[var(--color-ink)]">월별 기록</h2>
          </div>
          {snapshots.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-[var(--color-muted)]">아직 월말 기록이 없습니다.</p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">월간 기록에서 증권사 앱의 평가금액을 입력하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                    <th className="px-5 py-3 text-left font-medium">기준 월</th>
                    <th className="px-4 py-3 text-right font-medium">이번 달 배분</th>
                    <th className="px-4 py-3 text-right font-medium">평가금액</th>
                    {isPension ? <th className="px-5 py-3 text-right font-medium">연간 누적 납입</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map(snapshot => (
                    <tr key={snapshot.id} className="border-b border-[var(--color-border)]/65 last:border-0">
                      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{formatMonth(snapshot.month)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">{fmtKrw(Number(snapshot.monthly_allocation))}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--color-ink)]">{fmtKrw(Number(snapshot.evaluation_amount))}</td>
                      {isPension ? <td className="px-5 py-3 text-right tabular-nums text-[var(--color-primary)]">{fmtKrw(Number(snapshot.ytd_contribution))}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function MetricCard({ label, value, detail, signed = false }: { label: string; value: number | null; detail: string; signed?: boolean }) {
  const tone = value == null ? 'text-[var(--color-subtle)]' : signed && value < 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-ink)]'
  return (
    <article className="app-card p-4">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone}`}>{value == null ? '-' : `${signed && value > 0 ? '+' : ''}${fmtKrw(value)}`}</p>
      <p className="mt-1 text-[10px] text-[var(--color-subtle)]">{detail}</p>
    </article>
  )
}

function fmtKrw(value: number) {
  return `₩${new Intl.NumberFormat('ko-KR').format(Math.round(value))}`
}

function formatMonth(month: string) {
  const [year, value] = month.split('-')
  return `${year}년 ${Number(value)}월`
}
