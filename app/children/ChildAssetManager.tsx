'use client'

import { valuationStatus } from '@/lib/calc/child-valuation'
import { useRef, useState, useTransition } from 'react'
import type { ChildAccount, ChildAccountMonthlySnapshot, ChildProfile, ChildGiftDeposit } from '@/lib/types'
import { createChildAccount, deleteChildAccountSnapshot, saveChildAccountSnapshot } from './actions'

const INPUT = 'w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]'

export default function ChildAssetManager({
  childProfiles,
  gifts,
  accounts,
  snapshots,
  currentMonth,
}: {
  childProfiles: ChildProfile[]
  gifts: ChildGiftDeposit[]
  accounts: ChildAccount[]
  snapshots: ChildAccountMonthlySnapshot[]
  currentMonth: string
}) {
  const accountFormRef = useRef<HTMLFormElement>(null)
  const snapshotFormRef = useRef<HTMLFormElement>(null)
  const [showAccountForm, setShowAccountForm] = useState(accounts.length === 0)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const activeAccounts = accounts.filter(account => account.is_active)
  const childNameById = new Map(childProfiles.map(child => [child.id, child.name]))
  const accountById = new Map(activeAccounts.map(account => [account.id, account]))
  const latestByAccount = latestSnapshots(snapshots)
  const deposited = gifts.reduce((sum, gift) => sum + Number(gift.amount), 0)
  const currentValue = activeAccounts.reduce((sum, account) => sum + (latestByAccount.get(account.id)?.evaluation_amount ?? 0), 0)
  const cashValue = activeAccounts.reduce((sum, account) => account.asset_type === 'cash' ? sum + (latestByAccount.get(account.id)?.evaluation_amount ?? 0) : sum, 0)
  const investmentValue = currentValue - cashValue
  const gain = currentValue - deposited
  const returnRate = deposited > 0 ? gain / deposited * 100 : 0
  const latestMonth = [...latestByAccount.values()].map(item => item.month).sort().at(-1) ?? null
  const unrecordedCount = activeAccounts.filter(account => !latestByAccount.has(account.id)).length
  const valuation = valuationStatus(activeAccounts, snapshots, gifts)
  const hasCompleteValuation = valuation.ready

  function submitAccount(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        await createChildAccount(formData)
        accountFormRef.current?.reset()
        setShowAccountForm(false)
        setMessage('자녀 계좌를 추가했습니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '자녀 계좌를 추가하지 못했습니다.')
      }
    })
  }

  function submitSnapshot(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        await saveChildAccountSnapshot(formData)
        const month = String(formData.get('month') ?? currentMonth)
        const accountId = String(formData.get('account_id') ?? '')
        snapshotFormRef.current?.reset()
        const form = snapshotFormRef.current
        if (form) {
          const monthInput = form.elements.namedItem('month') as HTMLInputElement | null
          const accountSelect = form.elements.namedItem('account_id') as HTMLSelectElement | null
          if (monthInput) monthInput.value = month
          if (accountSelect) accountSelect.value = accountId
        }
        setMessage('월말 계좌 평가금액을 저장했습니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '평가금액을 저장하지 못했습니다.')
      }
    })
  }

  function removeSnapshot(id: string) {
    if (!confirm('이 월말 평가 기록을 삭제할까요?')) return
    setMessage(null)
    startTransition(async () => {
      try {
        await deleteChildAccountSnapshot(id)
        setMessage('평가 기록을 삭제했습니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '평가 기록을 삭제하지 못했습니다.')
      }
    })
  }

  return (
    <section aria-labelledby="child-assets-title" className="app-card overflow-hidden">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-section)] px-5 py-4">
        <p className="page-eyebrow">Child asset management</p>
        <h2 id="child-assets-title" className="mt-1 text-lg font-extrabold text-[var(--color-ink)]">자녀 자금 운용</h2>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">거래내역 대신 계좌별 평가금액을 월 1회 기록해 납입 원금과 현재 자산을 비교합니다.</p>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="누적 납입" value={formatKrw(deposited)} detail="증여 탭 전체 납입액" />
          <Metric label="현재 평가금액" value={activeAccounts.length > 0 ? formatKrw(currentValue) : '-'} detail={unrecordedCount > 0 ? `미평가 계좌 ${unrecordedCount}개 · 기록된 계좌만 합산` : latestMonth ? '계좌별 최근 기록 기준' : '운용 계좌 등록 필요'} />
          <Metric label="운용손익" value={hasCompleteValuation ? signedKrw(gain) : '-'} detail={hasCompleteValuation && deposited > 0 ? `${signedPercent(returnRate)} · ${valuation.reason}` : valuation.reason} tone={hasCompleteValuation && gain > 0 ? 'positive' : hasCompleteValuation && gain < 0 ? 'negative' : 'default'} />
          <Metric label="현금 / 투자" value={`${ratio(cashValue, currentValue)} / ${ratio(investmentValue, currentValue)}`} detail={`${formatKrw(cashValue)} / ${formatKrw(investmentValue)}`} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {childProfiles.map(child => {
            const childAccounts = activeAccounts.filter(account => account.child_id === child.id)
            const childDeposited = gifts.filter(gift => gift.child_id === child.id).reduce((sum, gift) => sum + Number(gift.amount), 0)
            const childValue = childAccounts.reduce((sum, account) => sum + (latestByAccount.get(account.id)?.evaluation_amount ?? 0), 0)
            const childValuation = valuationStatus(childAccounts, snapshots, gifts.filter(gift => gift.child_id === child.id))
            const childValuationComplete = childValuation.ready
            return (
              <article key={child.id} className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--color-ink)]">{child.name}</h3>
                    <p className="mt-1 text-[10px] text-[var(--color-muted)]">납입 {formatKrw(childDeposited)} · 평가 {formatKrw(childValue)}</p>
                  </div>
                  <p className={`text-sm font-extrabold tabular-nums ${childValuationComplete && childValue - childDeposited > 0 ? 'text-[var(--color-positive-strong)]' : childValuationComplete && childValue - childDeposited < 0 ? 'text-[var(--color-negative-strong)]' : 'text-[var(--color-muted)]'}`}>
                    {childValuationComplete ? signedKrw(childValue - childDeposited) : childValuation.reason}
                  </p>
                </div>
                <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
                  {childAccounts.length > 0 ? childAccounts.map(account => {
                    const latest = latestByAccount.get(account.id)
                    return (
                      <div key={account.id} className="flex items-center justify-between gap-3 text-[11px]">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[var(--color-ink)]">{account.name}</p>
                          <p className="text-[9px] text-[var(--color-subtle)]">{account.asset_type === 'cash' ? '현금성' : '투자'} · {latest ? formatMonth(latest.month) : '평가 기록 없음'}</p>
                        </div>
                        <p className="shrink-0 font-bold tabular-nums text-[var(--color-primary)]">{latest ? formatKrw(latest.evaluation_amount) : '-'}</p>
                      </div>
                    )
                  }) : <p className="text-[10px] text-[var(--color-subtle)]">운용 계좌를 추가하면 월말 평가를 기록할 수 있습니다.</p>}
                </div>
              </article>
            )
          })}
        </div>

        {activeAccounts.length > 0 ? (
          <form ref={snapshotFormRef} action={submitSnapshot} className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-section)]/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--color-ink)]">월말 평가 기록</h3>
                <p className="mt-1 text-[10px] text-[var(--color-muted)]">같은 계좌·같은 월을 다시 저장하면 금액이 수정됩니다.</p>
              </div>
              {unrecordedCount > 0 ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-bold text-[var(--color-negative-strong)]">최초 평가 필요 {unrecordedCount}개</span> : null}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="평가월 *"><input name="month" type="month" required defaultValue={currentMonth} max={currentMonth} className={INPUT} /></Field>
              <Field label="자녀 계좌 *">
                <select name="account_id" required defaultValue={activeAccounts[0]?.id} className={INPUT}>
                  {activeAccounts.map(account => <option key={account.id} value={account.id}>{childNameById.get(account.child_id)} · {account.name}</option>)}
                </select>
              </Field>
              <Field label="현재 평가금액 *"><input name="evaluation_amount" required inputMode="numeric" placeholder="예: 5,200,000" className={`${INPUT} text-right tabular-nums`} /></Field>
              <Field label="메모"><input name="memo" placeholder="예: 9월 말 기준" className={INPUT} /></Field>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="submit" disabled={pending} className="min-h-10 rounded-xl bg-[var(--color-primary)] px-5 text-xs font-semibold text-white disabled:opacity-40">평가금액 저장</button>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-section)]/45 px-4 py-6 text-center">
            <p className="text-xs font-bold text-[var(--color-ink)]">먼저 자녀 운용 계좌를 등록해 주세요</p>
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">예금·CMA·MMF는 현금성, 주식·펀드는 투자로 구분하면 됩니다.</p>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border)]">
          <button type="button" onClick={() => setShowAccountForm(current => !current)} aria-expanded={showAccountForm} aria-controls="child-account-form" className="flex min-h-14 w-full items-center justify-between gap-4 bg-white px-4 py-3 text-left hover:bg-[var(--color-section)]">
            <span>
              <span className="block text-xs font-extrabold text-[var(--color-ink)]">자녀 운용 계좌 추가</span>
              <span className="mt-0.5 block text-[9px] text-[var(--color-muted)]">새 계좌가 생겼을 때만 사용합니다.</span>
            </span>
            <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-[9px] font-bold text-[var(--color-primary)]">{showAccountForm ? '접기 ↑' : '열기 ↓'}</span>
          </button>
          {showAccountForm ? (
            <form id="child-account-form" ref={accountFormRef} action={submitAccount} className="border-t border-[var(--color-border)] bg-[var(--color-section)]/55 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="자녀 *"><select name="child_id" required defaultValue={childProfiles[0]?.id ?? ''} className={INPUT}>{childProfiles.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}</select></Field>
                <Field label="계좌명 *"><input name="name" required maxLength={100} placeholder="예: 토스증권 자녀계좌" className={INPUT} /></Field>
                <Field label="계좌 유형 *"><select name="asset_type" required defaultValue="investment" className={INPUT}><option value="cash">현금성 · 예금/CMA/MMF</option><option value="investment">투자 · 주식/펀드</option></select></Field>
              </div>
              <div className="mt-3 flex justify-end"><button type="submit" disabled={pending || childProfiles.length === 0} className="min-h-10 rounded-xl bg-[var(--color-ink)] px-5 text-xs font-semibold text-white disabled:opacity-40">계좌 추가</button></div>
            </form>
          ) : null}
        </div>

        {message ? <p role="status" className="mt-4 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-xs font-semibold text-[var(--color-primary)]">{message}</p> : null}

        {snapshots.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--color-border)]">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-section)] text-[10px] text-[var(--color-muted)]"><tr><th className="px-4 py-3">평가월</th><th className="px-3 py-3">자녀</th><th className="px-3 py-3">계좌</th><th className="px-3 py-3 text-right">평가금액</th><th className="px-3 py-3">메모</th><th className="px-4 py-3" /></tr></thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-white">
                {snapshots.map(snapshot => {
                  const account = accountById.get(snapshot.account_id)
                  return <tr key={snapshot.id}><td className="whitespace-nowrap px-4 py-3 font-medium">{formatMonth(snapshot.month)}</td><td className="px-3 py-3 font-bold">{account ? childNameById.get(account.child_id) : '-'}</td><td className="px-3 py-3 text-[var(--color-muted)]">{account?.name ?? '삭제된 계좌'}</td><td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[var(--color-primary)]">{formatKrw(snapshot.evaluation_amount)}</td><td className="max-w-[180px] truncate px-3 py-3 text-[var(--color-muted)]">{snapshot.memo || '-'}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => removeSnapshot(snapshot.id)} disabled={pending} className="text-[10px] text-[var(--color-subtle)] hover:text-[var(--color-negative)]">삭제</button></td></tr>
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function latestSnapshots(snapshots: ChildAccountMonthlySnapshot[]) {
  const result = new Map<string, ChildAccountMonthlySnapshot>()
  for (const snapshot of [...snapshots].sort((a, b) => b.month.localeCompare(a.month) || b.updated_at.localeCompare(a.updated_at))) {
    if (!result.has(snapshot.account_id)) result.set(snapshot.account_id, snapshot)
  }
  return result
}

function Metric({ label, value, detail, tone = 'default' }: { label: string; value: string; detail: string; tone?: 'default' | 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-[var(--color-positive-strong)]' : tone === 'negative' ? 'text-[var(--color-negative-strong)]' : 'text-[var(--color-primary)]'
  return <article className="rounded-2xl border border-[var(--color-border)] bg-white p-4"><p className="text-xs font-extrabold text-[var(--color-ink)]">{label}</p><p className={`mt-2 text-xl font-bold tracking-[-0.03em] tabular-nums ${color}`}>{value}</p><p className="mt-1 text-[10px] text-[var(--color-muted)]">{detail}</p></article>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</span>{children}</label>
}

function ratio(value: number, total: number) {
  return total > 0 ? `${Math.round(value / total * 100)}%` : '0%'
}

function formatKrw(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value))}원`
}

function signedKrw(value: number) {
  if (value === 0) return '0원'
  return `${value > 0 ? '+' : '-'}${formatKrw(Math.abs(value))}`
}

function signedPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatMonth(value: string) {
  const [year, month] = value.split('-')
  return `${year}년 ${Number(month)}월`
}
