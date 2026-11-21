'use client'

import { useRef, useState, useTransition } from 'react'
import { ACCOUNT_TYPE_LABEL, formatAmountInput as formatInput, formatMonth, krw, parseAmountInput as parseAmount } from '@/lib/labels'
import Link from 'next/link'
import { ChevronRight, ClipboardCheck, ListTree, type LucideIcon } from 'lucide-react'
import MonthNavigator from '@/components/MonthNavigator'
import { TAB_LIST, tabClass } from '@/components/TabNav'
import type { Account, NetWorthItem } from '@/lib/types'
import AccountForm from '@/app/accounts/AccountForm'
import { createNetWorthItem, saveNetWorthSnapshot, setNetWorthItemActive } from './actions'
import NetWorthItemEditor from './NetWorthItemEditor'
import BalanceHistory, { type BalanceRow } from './BalanceHistory'
import { ASSET_CATEGORIES, CATEGORY_LABEL, LIABILITY_CATEGORIES, OWNER_LABEL } from './categories'
import { isAutoMortgage } from '@/lib/calc/net-worth-items'
import { isAutoHomePrice } from '@/lib/calc/home-price'
import { SOURCE_LABEL } from './BalanceHistory'

export { CATEGORY_LABEL }
const INPUT = 'field-input'

type WorkspaceView = 'record' | 'settings'

const VIEWS: Array<{ id: WorkspaceView; label: string; description: string; icon: LucideIcon }> = [
  { id: 'record', label: '월말 기록', description: '자산·부채 잔액 입력', icon: ClipboardCheck },
  { id: 'settings', label: '항목 관리', description: '계좌와 자산·부채 설정', icon: ListTree },
]

interface Props {
  month: string
  months: string[]
  activeItems: NetWorthItem[]
  inactiveItems: NetWorthItem[]
  accounts: Account[]
  latestAccountSnapshots: Record<string, { amount: number; month: string }>
  initialAmounts: Record<string, number>
  /** 항목별로 initialAmounts 값이 기록된 달. */
  latestMonths: Record<string, string>
  history: Record<string, BalanceRow[]>
  currentMonth: string
  initialView?: WorkspaceView
  hasExactSnapshot: boolean
  investmentValue: number
  investmentRecordedMonth: string | null
}

export default function NetWorthManager({
  month,
  months,
  activeItems,
  inactiveItems,
  accounts,
  latestAccountSnapshots,
  initialAmounts,
  latestMonths,
  history,
  currentMonth,
  initialView = 'record',
  hasExactSnapshot,
  investmentValue,
  investmentRecordedMonth,
}: Props) {
  const addFormRef = useRef<HTMLFormElement>(null)
  const [view, setView] = useState<WorkspaceView>(initialView)
  const [kind, setKind] = useState<'asset' | 'liability'>('asset')
  const [category, setCategory] = useState<string>('real_estate')
  const [amounts, setAmounts] = useState(initialAmounts)
  const [message, setMessage] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [correcting, setCorrecting] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  function addItem(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await createNetWorthItem(formData)
        if (!result.ok) {
          setMessage(result.error)
          return
        }
        addFormRef.current?.reset()
        setShowAdd(false)
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
        const result = await saveNetWorthSnapshot(formData)
        if (!result.ok) {
          setMessage(result.error)
          return
        }
        setCorrecting(new Set())
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
        const result = await setNetWorthItemActive(id, active, active ? month : currentMonth)
        if (!result.ok) {
          setMessage(result.error)
          return
        }
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
      <nav aria-label="밸런스 시트 메뉴" className={TAB_LIST}>
        {VIEWS.map(item => {
          const active = view === item.id
          const Icon = item.icon
          return (
            <button key={item.id} type="button" onClick={() => setView(item.id)} aria-current={active ? 'page' : undefined} title={item.description} className={tabClass(active)}>
              <Icon size={15} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />{item.label}
            </button>
          )
        })}
      </nav>

      {view !== 'settings' ? <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNavigator month={month} months={months} label="기준 월 선택" />
        <p className="text-[12.5px] text-[var(--color-muted)]">
          {hasExactSnapshot ? '● 저장된 월말 기록' : '직전 기록을 불러왔습니다. 금액을 확인하고 저장하세요.'}
        </p>
      </div> : null}


      {view === 'settings' ? <section className="app-card overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-primary-soft)] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--color-ink)]">금융계좌</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">현금·MMF·주식·연금 계좌는 여기서 한 번 등록하고, 월말 금액은 월간 기록에서 갱신합니다.</p>
            </div>
            <p className="text-sm font-bold tabular-nums text-[var(--color-primary)]">{krw(investmentValue)}</p>
          </div>
        </div>

        {accounts.length > 0 ? (
          <div className="divide-y divide-[var(--color-border)]">
            {accounts.map(account => {
              const latest = latestAccountSnapshots[account.id]
              return (
                <Link key={account.id} href={`/accounts/${account.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-section)] sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <OwnerBadge owner={account.owner} />
                      <span className="truncate text-[13px] font-semibold text-[var(--color-ink)]">{account.name}</span>
                      {account.is_emergency_fund ? <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-accent)]">비상금</span> : null}
                    </div>
                    <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}{account.broker ? ` · ${account.broker}` : ''}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-semibold tabular-nums text-[var(--color-ink)]">{krw(latest?.amount ?? 0)}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--color-subtle)]">{latest ? `${formatMonth(latest.month)} 기록` : '월말 기록 없음'}</p>
                  </div>
                  <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-[var(--color-subtle)]" />
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="px-5 py-6 text-center text-[12.5px] text-[var(--color-subtle)]">등록된 금융계좌가 없습니다.</p>
        )}

        <details className="border-t border-[var(--color-border)]">
          <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-[var(--color-primary)] sm:px-5">＋ 새 금융계좌 추가</summary>
          <div className="border-t border-[var(--color-border)] bg-white/45 p-4 sm:p-5">
            <AccountForm compact />
          </div>
        </details>
      </section> : null}

      {view === 'record' ? (
        <section className="app-card overflow-hidden">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-primary-soft)] px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--color-ink)]">금융계좌 월말 현황</h2>
                <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">이 금액은 월간 기록에서 입력하며, 밸런스 시트에 자동으로 반영됩니다.</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-[var(--color-primary)]">{krw(investmentValue)}</p>
                <Link href={`/budget?month=${month}`} className="mt-1 inline-block text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">월간 기록에서 수정 →</Link>
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
                        <p className="truncate text-[12.5px] font-semibold text-[var(--color-ink)]">{account.name}</p>
                        {account.is_emergency_fund ? <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-accent)]">비상금</span> : null}
                      </div>
                      <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}{account.broker ? ` · ${account.broker}` : ''}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12.5px] font-semibold tabular-nums text-[var(--color-ink)]">{krw(latest?.amount ?? 0)}</p>
                      <p className="mt-0.5 text-[11.5px] text-[var(--color-subtle)]">{latest ? `${latest.month.replace('-', '년 ')}월 기록` : '월말 기록 없음'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="px-5 py-6 text-center text-[12.5px] text-[var(--color-subtle)]">등록된 금융계좌가 없습니다. 항목 관리에서 계좌를 추가해 주세요.</p>
          )}
        </section>
      ) : null}

      {view === 'record' && activeItems.length > 0 ? (
        <form action={saveSnapshot} className="app-card overflow-hidden">
          <input type="hidden" name="month" value={month} />
          <div className="border-b border-[var(--color-border)] bg-[var(--color-primary-soft)] px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--color-ink)]">계좌 외 자산·부채 월말 기록</p>
                <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">
                  부동산·보증금·차량·대출 잔액을 입력합니다.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11.5px] text-[var(--color-muted)]">자동 반영 금융계좌{investmentRecordedMonth ? ` · ${investmentRecordedMonth.replace('-', '년 ')}월` : ''}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-primary)]">{krw(investmentValue)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <SnapshotGroup title="자산" description="현재 보유한 금액이나 평가액" items={assets} amounts={amounts} setAmounts={setAmounts} month={month} latestMonths={latestMonths} correcting={correcting} setCorrecting={setCorrecting} />
            <SnapshotGroup title="부채" description="현재 남아 있는 원금 잔액" items={liabilities} amounts={amounts} setAmounts={setAmounts} month={month} latestMonths={latestMonths} correcting={correcting} setCorrecting={setCorrecting} liability />
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-white/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-[12.5px] leading-5 text-[var(--color-muted)]">입력칸이 있는 항목만 이 달 잔액으로 저장해요. 자동 상환 대출은 건드리지 않아요. 항목 이름·조건·지난 잔액은 항목 관리에서 고쳐요.</p>
            <button type="submit" disabled={pending} className="min-h-10 shrink-0 rounded-xl bg-[var(--color-primary)] px-5 text-[12.5px] font-semibold text-white disabled:opacity-50">
              {pending ? '저장 중…' : `${formatMonth(month)} 기록 저장`}
            </button>
          </div>
        </form>
      ) : view === 'record' ? (
        <div className="app-card px-5 py-10 text-center">
          <p className="text-sm font-semibold">계좌 외 자산이나 부채가 있다면 항목을 추가하세요.</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">예: 아파트, 전월세 보증금, 차량, 주택담보대출</p>
          <button type="button" onClick={() => setView('settings')} className="mt-4 min-h-9 rounded-lg bg-[var(--color-primary)] px-4 text-[12.5px] font-semibold text-white">항목 관리로 이동</button>
        </div>
      ) : null}

      {message ? <p role="status" className="rounded-xl bg-[var(--color-primary-soft)] px-4 py-3 text-[12.5px] text-[var(--color-primary)]">{message}</p> : null}

      {view === 'settings' ? <section className="app-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-[var(--color-ink)]">계좌 외 자산·부채</h2>
            <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">부동산·보증금·차량·대출을 한 번 등록해 두고, 항목을 눌러 정보와 잔액 이력을 고쳐요. 금융계좌를 여기 다시 만들면 중복 계산돼요.</p>
          </div>
          <button type="button" onClick={() => setShowAdd(value => !value)} aria-expanded={showAdd} className="min-h-9 shrink-0 rounded-lg bg-[var(--color-primary)] px-4 text-[12.5px] font-semibold text-white">{showAdd ? '추가 닫기' : '＋ 새 항목 추가'}</button>
        </div>

        {showAdd ? (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-section)] p-4 sm:p-5">
        <form ref={addFormRef} action={addItem} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">항목 이름</label>
            <input name="name" required placeholder={kind === 'asset' ? '예: 우리집 아파트' : '예: 주택담보대출'} className={INPUT} />
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">구분</label>
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
            <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">분류</label>
            <select name="category" value={category} onChange={event => setCategory(event.target.value)} className={INPUT}>
              {(kind === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">소유</label>
            <select name="owner" className={INPUT}>
              <option value="household">공동</option>
              <option value="me">나</option>
              <option value="spouse">아내</option>
            </select>
          </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-white/55 p-4">
            <h3 className="text-[12.5px] font-semibold">최초 기록</h3>
            <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">항목을 만들면서 선택한 월의 잔액도 함께 저장합니다.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">기준 월</label>
                <input name="initial_month" type="month" required defaultValue={currentMonth} max={currentMonth} className={INPUT} />
              </div>
              <div>
                <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">현재 금액</label>
                <div className="flex items-center gap-2">
                  <input name="initial_amount" required inputMode="numeric" placeholder="0" className={`${INPUT} text-right`} />
                  <span className="shrink-0 text-[12.5px] text-[var(--color-muted)]">원</span>
                </div>
              </div>
            </div>
          </div>

          {hasFinancialTerms ? (
            <div className="rounded-xl border border-[var(--color-gold)] bg-[var(--color-accent-soft)] p-4">
              <h3 className="text-[12.5px] font-semibold text-[var(--color-accent)]">대출·부채 조건</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">연 이율</label>
                  <div className="flex items-center gap-2"><input name="interest_rate" type="number" min="0" step="0.01" placeholder="3.5" className={`${INPUT} text-right`} /><span className="text-[12.5px] text-[var(--color-muted)]">%</span></div>
                </div>
                <div>
                  <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">월 {kind === 'liability' ? '상환액' : '납입액'}</label>
                  <div className="flex items-center gap-2"><input name="monthly_payment" inputMode="numeric" placeholder="0" className={`${INPUT} text-right`} /><span className="text-[12.5px] text-[var(--color-muted)]">원</span></div>
                </div>
                <div>
                  <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">시작일</label>
                  <input name="start_date" type="date" className={INPUT} />
                </div>
                <div>
                  <label className="mb-1 block text-[12.5px] text-[var(--color-muted)]">만기일</label>
                  <input name="maturity_date" type="date" className={INPUT} />
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="submit" disabled={pending} className="min-h-10 rounded-xl bg-[var(--color-ink)] px-5 text-[12.5px] font-semibold text-white disabled:opacity-50">
              {pending ? '추가 중…' : '항목과 최초 금액 저장'}
            </button>
          </div>
        </form>
          </div>
        ) : null}

        {activeItems.length === 0 && !showAdd ? (
          <p className="px-5 py-8 text-center text-[13px] text-[var(--color-muted)]">등록된 자산·부채가 없어요. ‘새 항목 추가’로 아파트, 보증금, 주택담보대출 등을 등록하세요.</p>
        ) : null}
        <ul className="divide-y divide-[var(--color-border)]">
          {activeItems.map(item => {
            const auto = isAutoMortgage(item)
            const rows = history[item.id] ?? []
            const latest = rows[0] ?? null
            return (
              <li key={item.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-[var(--color-section)] sm:px-5">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <OwnerBadge owner={item.owner} />
                      <span className="truncate text-[13px] font-semibold">{item.name}</span>
                      <span className="shrink-0 text-[12.5px] text-[var(--color-muted)]">{item.kind === 'liability' ? '부채' : '자산'} · {CATEGORY_LABEL[item.category] ?? item.category}</span>
                      {auto ? <span className="shrink-0 rounded bg-[var(--color-positive-soft)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--color-positive-strong)]">자동 상환</span> : null}
                      {isAutoHomePrice(item) ? <span className="shrink-0 rounded bg-[var(--color-positive-soft)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--color-positive-strong)]">실거래가</span> : null}
                    </span>
                    <span className="text-right">
                      <span className="block text-[13px] font-bold tabular-nums">{latest ? krw(latest.amount) : '—'}</span>
                      <span className="block text-[11.5px] text-[var(--color-subtle)]">{latest ? `${formatMonth(latest.month)} ${SOURCE_LABEL[latest.source] ?? '자동'}` : '잔액 기록 없음'}</span>
                    </span>
                    <ChevronRight aria-hidden="true" size={16} className="text-[var(--color-subtle)] transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="space-y-5 border-t border-[var(--color-border)] bg-[var(--color-section)] px-4 py-4 sm:px-5">
                    <NetWorthItemEditor item={item} />
                    <div className="border-t border-[var(--color-border)] pt-4">
                      <BalanceHistory itemId={item.id} rows={rows} currentMonth={currentMonth} auto={auto} />
                    </div>
                    <div className="flex justify-end border-t border-[var(--color-border)] pt-3">
                      <button type="button" disabled={pending} onClick={() => { if (confirm(`${item.name} 항목을 이번 달부터 비활성화할까요? 과거 기록은 남아요.`)) toggleItem(item.id, false) }} className="min-h-8 text-[12.5px] text-[var(--color-subtle)] hover:text-[var(--color-negative)] disabled:opacity-50">이 항목 비활성화</button>
                    </div>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>

        {inactiveItems.length > 0 ? (
          <details className="border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-[var(--color-muted)]">비활성 항목 {inactiveItems.length}개</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {inactiveItems.map(item => (
                <button key={item.id} type="button" onClick={() => toggleItem(item.id, true)} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[12.5px]">
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
  month,
  latestMonths,
  correcting,
  setCorrecting,
  liability = false,
}: {
  title: string
  description: string
  items: NetWorthItem[]
  amounts: Record<string, number>
  setAmounts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  month: string
  latestMonths: Record<string, string>
  correcting: Set<string>
  setCorrecting: React.Dispatch<React.SetStateAction<Set<string>>>
  liability?: boolean
}) {
  const toggle = (id: string, open: boolean) => setCorrecting(current => {
    const next = new Set(current)
    if (open) next.add(id)
    else next.delete(id)
    return next
  })
  return (
    <div className="border-[var(--color-border)] p-4 lg:border-r lg:last:border-r-0 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--color-ink)]">{title}</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{description}</p>
      </div>
      {items.length === 0 ? <p className="py-6 text-center text-[12.5px] text-[var(--color-subtle)]">등록된 {title} 항목이 없습니다.</p> : null}
      <div className="space-y-3">
        {items.map(item => {
          const homePrice = isAutoHomePrice(item)
          const auto = isAutoMortgage(item) || homePrice
          const editable = !auto || correcting.has(item.id)
          const recordedMonth = latestMonths[item.id]
          return (
            <div key={item.id} className="rounded-xl border border-[var(--color-border)] bg-white/70 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <OwnerBadge owner={item.owner} />
                    <p className="truncate text-[12.5px] font-semibold">{item.name}</p>
                    {auto ? <span className="shrink-0 rounded bg-[var(--color-positive-soft)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--color-positive-strong)]">{homePrice ? '실거래가' : '자동 상환'}</span> : null}
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
                    {CATEGORY_LABEL[item.category] ?? item.category}
                    {recordedMonth && recordedMonth !== month ? ` · ${formatMonth(recordedMonth)} 값을 불러왔어요` : ''}
                  </p>
                </div>
                {auto ? (
                  <button type="button" onClick={() => toggle(item.id, !correcting.has(item.id))} className="min-h-8 shrink-0 text-[12.5px] font-semibold text-[var(--color-primary)]">{correcting.has(item.id) ? '바로잡기 취소' : '바로잡기'}</button>
                ) : null}
              </div>
              {editable ? (
                <div className="flex items-center gap-2">
                  <input
                    name={`amount_${item.id}`}
                    value={formatInput(amounts[item.id] ?? 0)}
                    onChange={event => setAmounts(current => ({ ...current, [item.id]: parseAmount(event.target.value) }))}
                    inputMode="numeric"
                    aria-label={`${item.name} ${liability ? '부채 잔액' : '자산 금액'}`}
                    className="field-input max-w-[11.5rem] flex-1 text-right font-semibold tabular-nums"
                  />
                  <span className="text-[12.5px] text-[var(--color-muted)]">원</span>
                </div>
              ) : (
                <div className="flex items-baseline justify-between gap-2 rounded-lg bg-[var(--color-section)] px-3 py-2">
                  <span className="text-[12.5px] text-[var(--color-muted)]">{homePrice ? '실거래가로 불러온 금액' : '대출 조건으로 계산한 잔액'}</span>
                  <span className="text-sm font-semibold tabular-nums">{krw(amounts[item.id] ?? 0)}</span>
                </div>
              )}
              {auto && correcting.has(item.id) ? <p className="mt-1.5 text-[11.5px] text-[var(--color-muted)]">{homePrice ? '넣은 금액은 이 달만 직접 입력으로 저장되고, 다음 달부터 다시 실거래가로 갱신돼요.' : '은행 잔액을 넣으면 이 달 잔액을 기준으로 이후 달을 다시 계산해요.'}</p> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OwnerBadge({ owner }: { owner: string }) {
  const tone = owner === 'spouse'
    ? 'bg-[var(--color-spouse-soft)] text-[var(--color-spouse)]'
    : owner === 'household'
      ? 'bg-[var(--color-section)] text-[var(--color-muted)]'
      : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'

  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tone}`}>
      {OWNER_LABEL[owner] ?? owner}
    </span>
  )
}
