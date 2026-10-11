'use client'

import { useRef, useState, useTransition } from 'react'
import { calculateChildGiftStatus } from '@/lib/calc/child-gifts'
import type { GiftDeductionBucket } from '@/lib/calc/child-gifts'
import type { ChildAccount, ChildGiftDeposit, ChildGiftDonor, ChildGiftTransferType, ChildProfile } from '@/lib/types'
import { createChild, createChildGift, deleteChildGift } from './actions'

const INPUT = 'w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]'
const DONOR_LABEL: Record<ChildGiftDonor, string> = {
  parents: '부모 공동 (기존 기록)',
  me: '나 (부모)',
  spouse: '아내 (부모)',
  grandparents: '조부모',
  other_relative: '고모·이모·삼촌 등 기타 친족',
  non_relative: '친족 외',
}
const DONOR_OPTIONS: ChildGiftDonor[] = ['me', 'spouse', 'grandparents', 'other_relative', 'non_relative']
const TRANSFER_LABEL: Record<ChildGiftTransferType, string> = {
  gift: '증여 · 공제 한도에 포함',
  living_education: '생활비·교육비 · 비과세 분류',
  customary: '통상적 용돈·축하금 · 비과세 분류',
}

export default function ChildGiftManager({
  childProfiles,
  gifts,
  childAccounts,
  today,
  view,
}: {
  childProfiles: ChildProfile[]
  gifts: ChildGiftDeposit[]
  childAccounts: ChildAccount[]
  today: string
  view: 'overview' | 'deposits' | 'settings'
}) {
  const childFormRef = useRef<HTMLFormElement>(null)
  const giftFormRef = useRef<HTMLFormElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showChildForm, setShowChildForm] = useState(childProfiles.length === 0)
  const [selectedDonor, setSelectedDonor] = useState<ChildGiftDonor>('me')
  const [selectedTransferType, setSelectedTransferType] = useState<ChildGiftTransferType>('gift')
  const [selectedGiftChildId, setSelectedGiftChildId] = useState(childProfiles[0]?.id ?? '')
  const [pending, startTransition] = useTransition()
  const childNameById = new Map(childProfiles.map(child => [child.id, child.name]))
  const statuses = new Map(childProfiles.map(child => [child.id, calculateChildGiftStatus(child, gifts, today)]))
  const totalDeposited = gifts.reduce((sum, gift) => sum + Number(gift.amount), 0)
  const totalTaxableWindow = childProfiles.reduce((sum, child) => sum + (statuses.get(child.id)?.taxableInWindow ?? 0), 0)
  const totalNonTaxableWindow = childProfiles.reduce((sum, child) => sum + (statuses.get(child.id)?.nonTaxableInWindow ?? 0), 0)
  const totalRemaining = childProfiles.reduce((sum, child) => {
    const status = statuses.get(child.id)
    return sum + (status?.directAscendant.remaining ?? 0) + (status?.otherRelative.remaining ?? 0)
  }, 0)

  function submitChild(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        await createChild(formData)
        childFormRef.current?.reset()
        setShowChildForm(false)
        setMessage('자녀를 등록했습니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '자녀를 등록하지 못했습니다.')
      }
    })
  }

  function submitGift(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        await createChildGift(formData)
        giftFormRef.current?.reset()
        setSelectedDonor('me')
        setSelectedTransferType('gift')
        setMessage('자녀 계좌 납입 기록을 저장했습니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '납입 기록을 저장하지 못했습니다.')
      }
    })
  }

  function removeGift(id: string) {
    if (!confirm('이 납입 기록을 삭제할까요?')) return
    setMessage(null)
    startTransition(async () => {
      try {
        await deleteChildGift(id)
        setMessage('납입 기록을 삭제했습니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '납입 기록을 삭제하지 못했습니다.')
      }
    })
  }

  return (
    <div className="space-y-4">
      {view === 'overview' ? (
        <>
          <section aria-label="자녀 증여 요약" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="등록 자녀" value={`${childProfiles.length}명`} description="별도 자녀 재산으로 관리" />
            <SummaryCard label="누적 납입액" value={formatKrw(totalDeposited)} description="증여·생활비·용돈 전체" />
            <SummaryCard label="최근 10년 증여" value={formatKrw(totalTaxableWindow)} description={`한도 제외 분류 ${formatKrw(totalNonTaxableWindow)}`} />
            <SummaryCard label="남은 관계별 공제" value={formatKrw(totalRemaining)} description="직계존속·기타 친족 한도 합계" positive />
          </section>

          {childProfiles.length > 0 ? (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {childProfiles.map(child => {
                const status = statuses.get(child.id)!
                return (
                  <article key={child.id} className="app-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-extrabold text-[var(--color-ink)]">{child.name}</h2>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.isMinor ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
                            {status.isMinor ? '미성년' : '성년'} · 만 {status.age}세
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                          {formatDate(child.birth_date)} 출생{child.account_name ? ` · ${child.account_name}` : ''}
                        </p>
                      </div>
                      <p className="text-right text-[10px] text-[var(--color-subtle)]">최근 10년 기준</p>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DeductionBucketCard label="직계존속" description={status.isMinor ? '미성년 한도' : '성년 한도'} bucket={status.directAscendant} />
                      <DeductionBucketCard label="기타 친족" description="고모·이모·삼촌 등" bucket={status.otherRelative} />
                    </div>
                    {status.nonRelativeAmount > 0 ? (
                      <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold text-[var(--color-negative-strong)]">
                        친족 외 증여 {formatKrw(status.nonRelativeAmount)}에는 관계별 증여재산공제가 없습니다.
                      </p>
                    ) : null}
                    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--color-border)] pt-4 text-[11px]">
                      <div>
                        <p className="text-[var(--color-muted)]">전체 누적 납입</p>
                        <p className="mt-1 font-bold tabular-nums text-[var(--color-ink)]">{formatKrw(status.totalDeposited)}</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-muted)]">최근 10년 증여</p>
                        <p className="mt-1 font-bold tabular-nums text-[var(--color-ink)]">{formatKrw(status.taxableInWindow)}</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-muted)]">한도 제외 분류</p>
                        <p className="mt-1 font-bold tabular-nums text-[var(--color-positive-strong)]">{formatKrw(status.nonTaxableInWindow)}</p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </section>
          ) : (
            <section className="app-card px-5 py-9 text-center">
              <p className="text-sm font-bold text-[var(--color-ink)]">자녀를 먼저 등록해 주세요</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">생년월일을 기준으로 미성년 여부와 현재 공제 한도를 계산합니다.</p>
            </section>
          )}
        </>
      ) : null}

      {view === 'settings' ? <section className="app-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowChildForm(current => !current)}
          aria-expanded={showChildForm}
          aria-controls="child-registration-form"
          className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-[var(--color-section)]"
        >
          <span>
            <span className="block text-sm font-extrabold text-[var(--color-ink)]">자녀 추가 등록</span>
            <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">처음 등록하거나 자녀를 추가할 때만 사용합니다.</span>
          </span>
          <span className="shrink-0 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-[10px] font-bold text-[var(--color-primary)]">
            {showChildForm ? '접기 ↑' : '열기 ↓'}
          </span>
        </button>

        {showChildForm ? (
          <form id="child-registration-form" ref={childFormRef} action={submitChild} className="border-t border-[var(--color-border)] bg-[var(--color-section)]/45 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="이름·별칭 *"><input name="name" required placeholder="예: 첫째" className={INPUT} /></Field>
              <Field label="생년월일 *"><input name="birth_date" type="date" required max={today} className={INPUT} /></Field>
              <Field label="대표 계좌"><input name="account_name" placeholder="예: 토스증권 자녀계좌" className={INPUT} /></Field>
              <Field label="메모"><input name="memo" placeholder="선택 입력" className={INPUT} /></Field>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={pending} className="min-h-10 rounded-xl bg-[var(--color-ink)] px-5 text-xs font-semibold text-white disabled:opacity-50">자녀 등록</button>
            </div>
          </form>
        ) : null}
      </section> : null}

      {view === 'settings' && message ? <p role="status" className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-xs font-semibold text-[var(--color-primary)]">{message}</p> : null}

      {view === 'deposits' ? <>
      <section>
        <form ref={giftFormRef} action={submitGift} className="app-card p-5">
          <h2 className="text-base font-bold text-[var(--color-ink)]">자녀 계좌 납입 기록</h2>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">실제 증여자를 구분하고, 자녀 계좌 적립·투자는 ‘증여’로 기록합니다.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="자녀 *">
              <select name="child_id" required disabled={childProfiles.length === 0} className={INPUT} value={selectedGiftChildId} onChange={event => setSelectedGiftChildId(event.target.value)}>
                {childProfiles.length === 0 ? <option value="">선택</option> : null}
                {childProfiles.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
              </select>
            </Field>
            <Field label="납입일 *"><input name="gift_date" type="date" required defaultValue={today} max={today} className={INPUT} /></Field>
            <Field label="납입액 *"><input name="amount" inputMode="numeric" required placeholder="예: 2,000,000" className={`${INPUT} text-right tabular-nums`} /></Field>
            <Field label="입금자 *">
              <select name="donor" value={selectedDonor} onChange={event => setSelectedDonor(event.target.value as ChildGiftDonor)} className={INPUT}>
                {DONOR_OPTIONS.map(value => <option key={value} value={value}>{DONOR_LABEL[value]}</option>)}
              </select>
            </Field>
            <Field label="입금자 이름"><input name="donor_name" placeholder={selectedDonor === 'other_relative' ? '예: 고모' : '선택 입력'} className={INPUT} /></Field>
            <Field label="입금 성격 *">
              <select name="transfer_type" value={selectedTransferType} onChange={event => setSelectedTransferType(event.target.value as ChildGiftTransferType)} className={INPUT}>
                {Object.entries(TRANSFER_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="입금 계좌">
              <select key={selectedGiftChildId} name="child_account_id" defaultValue="" className={INPUT}>
                <option value="">대표 계좌·미지정</option>
                {childAccounts.filter(account => account.child_id === selectedGiftChildId && account.is_active).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </Field>
            <Field label="메모"><input name="memo" placeholder="예: 첫 증여 신고" className={INPUT} /></Field>
          </div>
          <p className={`mt-3 rounded-xl border px-3 py-2 text-[10px] leading-4 ${selectedTransferType === 'gift' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            {selectedTransferType === 'gift'
              ? '선택한 관계의 최근 10년 공제 한도에 포함됩니다.'
              : '사용자 판단으로 공제 한도 계산에서 제외합니다. 남겨 두거나 투자하는 돈, 반복적으로 쌓이는 돈이라면 증여를 선택하세요.'}
          </p>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={pending || childProfiles.length === 0} className="min-h-10 rounded-xl bg-[var(--color-primary)] px-5 text-xs font-semibold text-white disabled:opacity-40">납입 기록 저장</button>
          </div>
        </form>
      </section>

      {message ? <p role="status" className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-xs font-semibold text-[var(--color-primary)]">{message}</p> : null}

      <section className="app-card overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-section)] px-4 py-4 sm:px-5">
          <h2 className="text-base font-bold text-[var(--color-ink)]">납입 내역</h2>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">최신 납입일부터 표시합니다.</p>
        </div>
        {gifts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-[var(--color-border)] text-[11px] text-[var(--color-muted)]">
                <tr><th className="px-5 py-3">납입일</th><th className="px-3 py-3">자녀</th><th className="px-3 py-3">입금자</th><th className="px-3 py-3">입금 성격</th><th className="px-3 py-3">계좌</th><th className="px-3 py-3 text-right">금액</th><th className="px-3 py-3">메모</th><th className="px-5 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {gifts.map(gift => {
                  return (
                    <tr key={gift.id}>
                      <td className="whitespace-nowrap px-5 py-3 font-medium">{formatDate(gift.gift_date)}</td>
                      <td className="px-3 py-3 font-bold">{childNameById.get(gift.child_id) ?? '삭제된 자녀'}</td>
                      <td className="px-3 py-3 text-[var(--color-muted)]">{gift.donor_name || DONOR_LABEL[gift.donor]}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${gift.transfer_type === 'gift' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}`}>{TRANSFER_LABEL[gift.transfer_type]}</span></td>
                      <td className="px-3 py-3 text-[var(--color-muted)]">{gift.account_name || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[var(--color-primary)]">{formatKrw(Number(gift.amount))}</td>
                      <td className="max-w-[180px] truncate px-3 py-3 text-[var(--color-muted)]">{gift.memo || '-'}</td>
                      <td className="px-5 py-3 text-right"><button type="button" onClick={() => removeGift(gift.id)} disabled={pending} className="text-[10px] text-[var(--color-subtle)] hover:text-[var(--color-negative)]">삭제</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="px-5 py-8 text-center text-xs text-[var(--color-subtle)]">아직 등록된 납입 내역이 없습니다.</p>}
      </section>
      </> : null}
    </div>
  )
}

function DeductionBucketCard({
  label,
  description,
  bucket,
}: {
  label: string
  description: string
  bucket: GiftDeductionBucket
}) {
  const tone = bucket.percent >= 100 ? 'var(--color-negative)' : bucket.percent >= 80 ? '#d69a2d' : 'var(--color-primary)'
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-section)]/55 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-[var(--color-ink)]">{label}</p>
          <p className="mt-0.5 text-[9px] text-[var(--color-subtle)]">{description}</p>
        </div>
        <p className={`text-[10px] font-bold ${bucket.overage > 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-positive-strong)]'}`}>
          {bucket.overage > 0 ? `초과 ${formatKrw(bucket.overage)}` : `남음 ${formatKrw(bucket.remaining)}`}
        </p>
      </div>
      <p className="mt-3 text-lg font-bold tabular-nums text-[var(--color-ink)]">{formatKrw(bucket.used)}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full" style={{ width: `${bucket.percent}%`, backgroundColor: tone }} />
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[9px] text-[var(--color-subtle)]">
        <span>{Math.round(bucket.percent)}% · 한도 {formatKrw(bucket.limit)}</span>
        <span>{bucket.nextReleaseDate ? `${formatDate(bucket.nextReleaseDate)} 회복` : '기록 없음'}</span>
      </div>
    </section>
  )
}

function SummaryCard({ label, value, description, positive = false }: { label: string; value: string; description: string; positive?: boolean }) {
  return (
    <article className={`app-card border-t-4 p-4 ${positive ? 'border-t-[var(--color-positive-bright)]' : 'border-t-[var(--color-primary)]'}`}>
      <p className="text-sm font-extrabold text-[var(--color-ink)]">{label}</p>
      <p className={`mt-2 text-xl font-bold tracking-[-0.03em] tabular-nums ${positive ? 'text-[var(--color-positive-strong)]' : 'text-[var(--color-primary)]'}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{description}</p>
    </article>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</span>{children}</label>
}

function formatKrw(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value))}원`
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${year}.${month}.${day}`
}
