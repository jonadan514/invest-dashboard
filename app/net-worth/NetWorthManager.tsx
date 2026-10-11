'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CircleGauge, ClipboardCheck, ListTree, type LucideIcon } from 'lucide-react'
import type { Account, NetWorthItem } from '@/lib/types'
import AccountForm from '@/app/accounts/AccountForm'
import DeleteButton from '@/app/accounts/DeleteButton'
import { createNetWorthItem, saveNetWorthSnapshot, setNetWorthItemActive } from './actions'
import NetWorthItemEditor from './NetWorthItemEditor'

const ASSET_CATEGORIES = [
  ['real_estate', '부동산'],
  ['deposit', '전월세 보증금'],
  ['vehicle', '차량'],
  ['other_asset', '기타 자산'],
] as const

const LIABILITY_CATEGORIES = [
  ['mortgage', '주택담보대출'],
  ['credit_loan', '신용대출'],
  ['lease', '임대보증금·리스'],
  ['card', '카드 미결제금'],
  ['other_liability', '기타 부채'],
] as const

export const CATEGORY_LABEL = Object.fromEntries([
  ['cash', '현금·비상금'],
  ['savings', '예·적금'],
  ...ASSET_CATEGORIES,
  ...LIABILITY_CATEGORIES,
]) as Record<string, string>

const OWNER_LABEL: Record<string, string> = { household: '공동', me: '나', spouse: '아내' }
const INPUT = 'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]'

type WorkspaceView = 'overview' | 'record' | 'settings'

const VIEWS: Array<{ id: WorkspaceView; label: string; description: string; icon: LucideIcon }> = [
  { id: 'overview', label: '한눈에 보기', description: '순자산과 월별 추이', icon: CircleGauge },
  { id: 'record', label: '월말 기록', description: '자산·부채 잔액 입력', icon: ClipboardCheck },
  { id: 'settings', label: '항목 관리', description: '계좌와 자산·부채 설정', icon: ListTree },
]

interface Props {
  overview: React.ReactNode
  month: string
  months: string[]
  activeItems: NetWorthItem[]
  inactiveItems: NetWorthItem[]
  accounts: Account[]
  latestAccountSnapshots: Record<string, { amount: number; month: string }>
  initialAmounts: Record<string, number>
  hasExactSnapshot: boolean
  investmentValue: number
  investmentRecordedMonth: string | null
}

export default function NetWorthManager({
  overview,
  month,
  months,
  activeItems,
  inactiveItems,
  accounts,
  latestAccountSnapshots,
  initialAmounts,
  hasExactSnapshot,
  investmentValue,
  investmentRecordedMonth,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const addFormRef = useRef<HTMLFormElement>(null)
  const [view, setView] = useState<WorkspaceView>('overview')
  const [kind, setKind] = useState<'asset' | 'liability'>('asset')
  const [category, setCategory] = useState<string>('real_estate')
  const [amounts, setAmounts] = useState(initialAmounts)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function changeMonth(nextMonth: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', nextMonth)
    router.push(`${pathname}?${params.toString()}`)
  }

  function addItem(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        await createNetWorthItem(formData)
        addFormRef.current?.reset()
        setKind('asset')
        setCategory('real_estate')
        setMessage('새 항목을 추가했습니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '항목을 추가하지 못했습니다.')
      }
    })
  }

  function saveSnapshot(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        await saveNetWorthSnapshot(formData)
        setMessage(`${month.replace('-', '년 ')}월 기록을 저장했습니다.`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '월별 기록을 저장하지 못했습니다.')
      }
    })
  }

  function toggleItem(id: string, active: boolean) {
    setMessage(null)
    startTransition(async () => {
      try {
        await setNetWorthItemActive(id, active, month)
        setMessage(active ? '항목을 다시 사용합니다.' : '항목을 비활성화했습니다. 과거 기록은 유지됩니다.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '항목을 변경하지 못했습니다.')
      }
    })
  }

  const assets = activeItems.filter(item => item.kind === 'asset')
  const liabilities = activeItems.filter(item => item.kind === 'liability')
  const hasFinancialTerms = kind === 'liability'

  return (
    <div className="space-y-4">
      <nav aria-label="밸런스 시트 메뉴" className="grid grid-cols-1 overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-strong)] sm:grid-cols-3">
        {VIEWS.map(item => {
          const active = view === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-14 items-center gap-3 border-b px-4 py-2.5 text-left transition-colors last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-primary)]' : 'bg-[var(--color-surface-strong)] hover:bg-[var(--color-section)]'}`}
            >
              <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]'}`}><Icon size={17} strokeWidth={active ? 2.2 : 1.7} /></span>
              <span className="min-w-0">
                <span className={`block text-xs font-extrabold ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink)]'}`}>{item.label}</span>
                <span className="mt-0.5 hidden truncate text-[9px] text-[var(--color-muted)] sm:block">{item.description}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label htmlFor="net-worth-month" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            기준 월
          </label>
          <select
            id="net-worth-month"
            value={month}
            onChange={event => changeMonth(event.target.value)}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm font-semibold outline-none"
          >
            {months.map(value => {
              const [year, number] = value.split('-')
              return <option key={value} value={value}>{year}년 {Number(number)}월</option>
            })}
          </select>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          {hasExactSnapshot ? '● 저장된 월말 기록' : '직전 기록을 불러왔습니다. 금액을 확인하고 저장하세요.'}
        </p>
      </div>

      {view === 'overview' ? overview : null}

      {view === 'settings' ? <section className="app-card overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-blue-50/55 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--color-ink)]">금융계좌</h2>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">현금·MMF·주식·연금 계좌는 여기서 한 번 등록하고, 월말 금액은 월간 기록에서 갱신합니다.</p>
            </div>
            <p className="text-sm font-bold tabular-nums text-[var(--color-primary)]">{formatKrw(investmentValue)}</p>
          </div>
        </div>

        {accounts.length > 0 ? (
          <div className="divide-y divide-[var(--color-border)]">
            {accounts.map(account => {
              const latest = latestAccountSnapshots[account.id]
              return (
                <div key={account.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <OwnerBadge owner={account.owner} />
                      <Link href={`/accounts/${account.id}`} className="truncate text-xs font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]">{account.name}</Link>
                      {account.is_emergency_fund ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">비상금</span> : null}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">{accountTypeLabel(account.type)}{account.broker ? ` · ${account.broker}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums text-[var(--color-ink)]">{formatKrw(latest?.amount ?? 0)}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--color-subtle)]">{latest ? `${latest.month.replace('-', '년 ')}월 기록` : '월말 기록 없음'}</p>
                    </div>
                    <DeleteButton id={account.id} name={account.name} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="px-5 py-6 text-center text-xs text-[var(--color-subtle)]">등록된 금융계좌가 없습니다.</p>
        )}

        <details className="border-t border-[var(--color-border)]">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[var(--color-primary)] sm:px-5">＋ 새 금융계좌 추가</summary>
          <div className="border-t border-[var(--color-border)] bg-white/45 p-4 sm:p-5">
            <AccountForm compact />
          </div>
        </details>
      </section> : null}

      {view === 'record' ? (
        <section className="app-card overflow-hidden">
          <div className="border-b border-[var(--color-border)] bg-blue-50/55 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--color-ink)]">금융계좌 월말 현황</h2>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">이 금액은 월간 기록에서 입력하며, 밸런스 시트에 자동으로 반영됩니다.</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-[var(--color-primary)]">{formatKrw(investmentValue)}</p>
                <Link href={`/budget?month=${month}`} className="mt-1 inline-block text-[11px] font-semibold text-[var(--color-primary)] hover:underline">월간 기록에서 수정 →</Link>
              </div>
            </div>
          </div>
          {accounts.length > 0 ? (
            <div className="divide-y divide-[var(--color-border)]">
              {accounts.map(account => {
                const latest = latestAccountSnapshots[account.id]
                return (
                  <div key={account.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <OwnerBadge owner={account.owner} />
                        <p className="truncate text-xs font-semibold text-[var(--color-ink)]">{account.name}</p>
                        {account.is_emergency_fund ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">비상금</span> : null}
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{accountTypeLabel(account.type)}{account.broker ? ` · ${account.broker}` : ''}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tabular-nums text-[var(--color-ink)]">{formatKrw(latest?.amount ?? 0)}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--color-subtle)]">{latest ? `${latest.month.replace('-', '년 ')}월 기록` : '월말 기록 없음'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="px-5 py-6 text-center text-xs text-[var(--color-subtle)]">등록된 금융계좌가 없습니다. 항목 관리에서 계좌를 추가해 주세요.</p>
          )}
        </section>
      ) : null}

      {view === 'record' && activeItems.length > 0 ? (
        <form action={saveSnapshot} className="app-card overflow-hidden">
          <input type="hidden" name="month" value={month} />
          <div className="border-b border-[var(--color-border)] bg-blue-50/55 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--color-ink)]">계좌 외 자산·부채 월말 기록</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                  부동산·보증금·차량·대출 잔액을 입력합니다.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[var(--color-muted)]">자동 반영 금융계좌{investmentRecordedMonth ? ` · ${investmentRecordedMonth.replace('-', '년 ')}월` : ''}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-primary)]">{formatKrw(investmentValue)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <SnapshotGroup title="자산" description="현재 보유한 금액이나 평가액" items={assets} amounts={amounts} setAmounts={setAmounts} onToggle={toggleItem} />
            <SnapshotGroup title="부채" description="현재 남아 있는 원금 잔액" items={liabilities} amounts={amounts} setAmounts={setAmounts} onToggle={toggleItem} liability />
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-white/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-[11px] leading-5 text-[var(--color-muted)]">금융계좌는 월간 기록에서, 부동산·보증금·대출 등은 이 화면에서 월말 잔액을 관리합니다.</p>
            <button type="submit" disabled={pending} className="min-h-10 shrink-0 rounded-xl bg-[var(--color-primary)] px-5 text-xs font-semibold text-white disabled:opacity-50">
              {pending ? '저장 중…' : '이달 월말 기록 저장'}
            </button>
          </div>
        </form>
      ) : view === 'record' ? (
        <div className="app-card px-5 py-10 text-center">
          <p className="text-sm font-semibold">계좌 외 자산이나 부채가 있다면 항목을 추가하세요.</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">예: 아파트, 전월세 보증금, 차량, 주택담보대출</p>
          <button type="button" onClick={() => setView('settings')} className="mt-4 min-h-9 rounded-lg bg-[var(--color-primary)] px-4 text-xs font-semibold text-white">항목 관리로 이동</button>
        </div>
      ) : null}

      {message ? <p role="status" className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-[var(--color-primary)]">{message}</p> : null}

      {view === 'settings' ? <section className="app-card p-4 sm:p-5">
        <h2 className="text-base font-bold text-[var(--color-ink)]">계좌 외 자산·부채</h2>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">부동산·보증금·차량·대출만 등록합니다. 금융계좌를 이곳에 다시 만들면 중복 계산됩니다.</p>
        <form ref={addFormRef} action={addItem} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs text-[var(--color-muted)]">항목 이름</label>
            <input name="name" required placeholder={kind === 'asset' ? '예: 우리집 아파트' : '예: 주택담보대출'} className={INPUT} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">구분</label>
            <select
              name="kind"
              value={kind}
              onChange={event => {
                const nextKind = event.target.value as 'asset' | 'liability'
                setKind(nextKind)
                setCategory(nextKind === 'asset' ? 'real_estate' : 'mortgage')
              }}
              className={INPUT}
            >
              <option value="asset">자산</option>
              <option value="liability">부채</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">분류</label>
            <select name="category" value={category} onChange={event => setCategory(event.target.value)} className={INPUT}>
              {(kind === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">소유</label>
            <select name="owner" className={INPUT}>
              <option value="household">공동</option>
              <option value="me">나</option>
              <option value="spouse">아내</option>
            </select>
          </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-white/55 p-4">
            <h3 className="text-xs font-semibold">최초 기록</h3>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">항목을 만들면서 선택한 월의 잔액도 함께 저장합니다.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[var(--color-muted)]">기준 월</label>
                <input name="initial_month" type="month" required defaultValue={month} className={INPUT} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--color-muted)]">현재 금액</label>
                <div className="flex items-center gap-2">
                  <input name="initial_amount" required inputMode="numeric" placeholder="0" className={`${INPUT} text-right`} />
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">원</span>
                </div>
              </div>
            </div>
          </div>

          {hasFinancialTerms ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/45 p-4">
              <h3 className="text-xs font-semibold text-amber-800">대출·부채 조건</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">연 이율</label>
                  <div className="flex items-center gap-2"><input name="interest_rate" type="number" min="0" step="0.01" placeholder="3.5" className={`${INPUT} text-right`} /><span className="text-xs text-[var(--color-muted)]">%</span></div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">월 {kind === 'liability' ? '상환액' : '납입액'}</label>
                  <div className="flex items-center gap-2"><input name="monthly_payment" inputMode="numeric" placeholder="0" className={`${INPUT} text-right`} /><span className="text-xs text-[var(--color-muted)]">원</span></div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">시작일</label>
                  <input name="start_date" type="date" className={INPUT} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">만기일</label>
                  <input name="maturity_date" type="date" className={INPUT} />
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="submit" disabled={pending} className="min-h-10 rounded-xl bg-[var(--color-ink)] px-5 text-xs font-semibold text-white disabled:opacity-50">
              {pending ? '추가 중…' : '항목과 최초 금액 저장'}
            </button>
          </div>
        </form>

        {activeItems.length > 0 ? (
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <p className="mb-2 text-xs font-semibold text-[var(--color-muted)]">등록 항목 정보 수정</p>
            <div className="space-y-2">
              {activeItems.map(item => (
                <details key={item.id} className="rounded-xl border border-[var(--color-border)] bg-white/55">
                  <summary className="cursor-pointer px-4 py-3 text-xs font-semibold">
                    <OwnerBadge owner={item.owner} /> <span className="ml-1.5">{item.name}</span> <span className="font-normal text-[var(--color-muted)]">· {CATEGORY_LABEL[item.category] ?? item.category}</span>
                  </summary>
                  <div className="border-t border-[var(--color-border)] p-4">
                    <NetWorthItemEditor item={item} />
                  </div>
                </details>
              ))}
            </div>
          </div>
        ) : null}

        {inactiveItems.length > 0 ? (
          <details className="mt-4 border-t border-[var(--color-border)] pt-4">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--color-muted)]">비활성 항목 {inactiveItems.length}개</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {inactiveItems.map(item => (
                <button key={item.id} type="button" onClick={() => toggleItem(item.id, true)} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs">
                  {item.name} · 다시 사용
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </section> : null}
    </div>
  )
}

function SnapshotGroup({
  title,
  description,
  items,
  amounts,
  setAmounts,
  onToggle,
  liability = false,
}: {
  title: string
  description: string
  items: NetWorthItem[]
  amounts: Record<string, number>
  setAmounts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  onToggle: (id: string, active: boolean) => void
  liability?: boolean
}) {
  return (
    <div className="border-[var(--color-border)] p-4 lg:border-r lg:last:border-r-0 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--color-ink)]">{title}</h2>
        <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{description}</p>
      </div>
      {items.length === 0 ? <p className="py-6 text-center text-xs text-[var(--color-subtle)]">등록된 {title} 항목이 없습니다.</p> : null}
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="rounded-xl border border-[var(--color-border)] bg-white/70 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <OwnerBadge owner={item.owner} />
                  <p className="truncate text-xs font-semibold">{item.name}</p>
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">{CATEGORY_LABEL[item.category] ?? item.category}</p>
                {item.interest_rate != null || item.monthly_payment != null || item.maturity_date ? (
                  <p className="mt-1 text-[10px] text-amber-700">
                    {item.interest_rate != null ? `연 ${Number(item.interest_rate).toFixed(2)}%` : null}
                    {item.monthly_payment != null ? `${item.interest_rate != null ? ' · ' : ''}월 ${formatKrw(Number(item.monthly_payment))}` : null}
                    {item.maturity_date ? `${item.interest_rate != null || item.monthly_payment != null ? ' · ' : ''}${item.maturity_date} 만기` : null}
                  </p>
                ) : null}
              </div>
              <button type="button" onClick={() => onToggle(item.id, false)} className="shrink-0 text-[10px] text-[var(--color-subtle)] hover:text-red-600">비활성화</button>
            </div>
            <div className="flex items-center gap-2">
              <input
                name={`amount_${item.id}`}
                value={formatInput(amounts[item.id] ?? 0)}
                onChange={event => setAmounts(current => ({ ...current, [item.id]: parseAmount(event.target.value) }))}
                inputMode="numeric"
                aria-label={`${item.name} ${liability ? '부채 잔액' : '자산 금액'}`}
                className={`min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-right text-sm font-semibold tabular-nums outline-none ${liability ? 'border-amber-200 focus:border-amber-500' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'}`}
              />
              <span className="text-xs text-[var(--color-muted)]">원</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OwnerBadge({ owner }: { owner: string }) {
  const tone = owner === 'spouse'
    ? 'bg-purple-100 text-purple-700'
    : owner === 'household'
      ? 'bg-slate-200 text-slate-700'
      : 'bg-blue-100 text-blue-700'

  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {OWNER_LABEL[owner] ?? owner}
    </span>
  )
}

function parseAmount(value: string) {
  const amount = Number(value.replace(/[^0-9]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function formatInput(value: number) {
  return value > 0 ? new Intl.NumberFormat('ko-KR').format(value) : ''
}

function formatKrw(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value))}원`
}

function accountTypeLabel(type: Account['type']) {
  const labels: Partial<Record<Account['type'], string>> = {
    cash: '입출금·공동계좌',
    mmf: 'CMA·MMF',
    general: '주식·증권계좌',
    pension: '연금저축',
    irp: 'IRP',
    isa: 'ISA',
    crypto: '코인',
  }
  return labels[type] ?? type
}
