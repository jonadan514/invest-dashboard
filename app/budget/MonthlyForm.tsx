'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { FinancialPlanSettings } from '@/lib/calc/budget'
import type { Account } from '@/lib/types'
import { saveBudgetEntry } from './actions'

function formatKrw(value: number) {
  return `₩${new Intl.NumberFormat('ko-KR').format(Math.round(value))}`
}

function parseNumber(value: string) {
  return Number(value.replace(/,/g, '')) || 0
}

function formatInput(value: number) {
  return value === 0 ? '' : new Intl.NumberFormat('ko-KR').format(value)
}

type Entry = {
  joint_savings: number
  bonus_total: number
  bonus_to_plan: number
  cash_balance: number
  mortgage_interest: number
  mortgage_principal: number
  mortgage_extra_principal: number
  memo: string
}

type AccountValue = {
  evaluationAmount: number
  monthlyAllocation: number
  ytdContribution: number
}

export default function MonthlyForm({
  month,
  entry,
  months,
  settings,
  accounts,
  initialAccountValues,
  hasAccountSnapshot,
  mortgageDefaults = null,
  mortgageBalance = null,
  stockValues = {},
}: {
  month: string
  entry: Entry | null
  months: string[]
  settings: FinancialPlanSettings
  accounts: Account[]
  initialAccountValues: Record<string, AccountValue>
  hasAccountSnapshot: boolean
  /** 대출 조건으로 계산한 이번 달 이자·정기 원금. 저장된 기록이 없을 때 기본값으로 쓴다. */
  mortgageDefaults?: { interest: number; principal: number | null } | null
  /** 직전 달 대출 잔액(주담대가 하나일 때). manualThisMonth면 이 달 잔액을 직접 입력해 둔 상태다. */
  mortgageBalance?: { previous: number; previousMonth: string; manualThisMonth: boolean } | null
  /** 계좌별 보유종목 평가액(이번 달 기록에서만 넘어온다). */
  stockValues?: Record<string, { value: number; holdings: number; missing: number; priceDate: string | null }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [jointContribution, setJointContribution] = useState(entry?.joint_savings ?? settings.monthlyJointContribution)
  const [bonusTotal, setBonusTotal] = useState(entry?.bonus_total ?? 0)
  const [bonusToPlan, setBonusToPlan] = useState(entry?.bonus_to_plan ?? 0)
  const [manualEmergencyFund, setManualEmergencyFund] = useState(entry?.cash_balance ?? settings.currentEmergencyFund)
  const [mortgageInterest, setMortgageInterest] = useState(Number(entry?.mortgage_interest ?? 0) > 0 ? Number(entry!.mortgage_interest) : mortgageDefaults?.interest ?? entry?.mortgage_interest ?? settings.mortgageInterest)
  const [mortgagePrincipal, setMortgagePrincipal] = useState(Number(entry?.mortgage_principal ?? 0) > 0 ? Number(entry!.mortgage_principal) : mortgageDefaults?.principal ?? entry?.mortgage_principal ?? settings.mortgagePrincipal)
  const [mortgageExtraPrincipal, setMortgageExtraPrincipal] = useState(entry?.mortgage_extra_principal ?? 0)
  const [memo, setMemo] = useState(entry?.memo ?? '')
  const [accountValues, setAccountValues] = useState(initialAccountValues)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const emergencyAccounts = accounts.filter(account => account.is_emergency_fund)
  const emergencyFund = emergencyAccounts.length > 0
    ? emergencyAccounts.reduce((sum, account) => sum + (accountValues[account.id]?.evaluationAmount ?? 0), 0)
    : manualEmergencyFund
  const regularSurplus = Math.max(jointContribution - settings.monthlyFixedCost, 0)
  const totalAllocatable = regularSurplus + bonusToPlan
  const allocatedTotal = accounts.reduce((sum, account) => sum + (accountValues[account.id]?.monthlyAllocation ?? 0), 0)
  const unallocated = totalAllocatable - allocatedTotal
  const coverage = settings.monthlyFixedCost > 0 ? emergencyFund / settings.monthlyFixedCost : 0

  function changeMonth(nextMonth: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', nextMonth)
    router.push(`${pathname}?${params.toString()}`)
  }

  function updateAccount(accountId: string, key: keyof AccountValue, value: number) {
    setAccountValues(current => ({
      ...current,
      [accountId]: { ...current[accountId], [key]: value },
    }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('month', month)
    formData.set('joint_savings', String(jointContribution))
    formData.set('bonus_total', String(bonusTotal))
    formData.set('bonus_to_plan', String(bonusToPlan))
    formData.set('cash_balance', String(emergencyFund))
    formData.set('mortgage_interest', String(mortgageInterest))
    formData.set('mortgage_principal', String(mortgagePrincipal))
    formData.set('mortgage_extra_principal', String(mortgageExtraPrincipal))
    formData.set('memo', memo)
    for (const account of accounts) {
      const values = accountValues[account.id] ?? { evaluationAmount: 0, monthlyAllocation: 0, ytdContribution: 0 }
      formData.set(`account_${account.id}_evaluation`, String(values.evaluationAmount))
      formData.set(`account_${account.id}_allocation`, String(values.monthlyAllocation))
      formData.set(`account_${account.id}_ytd`, String(values.ytdContribution))
    }

    startTransition(async () => {
      try {
        const result = await saveBudgetEntry(formData)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '저장하지 못했습니다.')
      }
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={month} onChange={event => changeMonth(event.target.value)} aria-label="기록 월 선택" className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm font-bold text-[var(--color-ink)] shadow-sm outline-none">
          {months.map(value => {
            const [year, monthNumber] = value.split('-')
            return <option key={value} value={value}>{year}년 {Number(monthNumber)}월</option>
          })}
        </select>
        {entry || hasAccountSnapshot ? <span className="text-xs text-[var(--color-primary)]">● 저장된 기록</span> : null}
      </div>

      <div className="metric-strip mb-4 grid grid-cols-2 sm:grid-cols-3">
        <div className="metric-cell col-span-2 p-4 sm:col-span-1">
          <p className="text-xs text-[var(--color-muted)]">현재 비상금</p>
          <p className="mt-1 whitespace-nowrap text-lg font-bold tracking-[-0.03em] text-[var(--color-ink)] sm:text-2xl">{formatKrw(emergencyFund)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <GoalBadge label="3천만 달성" achieved={emergencyFund >= settings.stage1Target} />
            <GoalBadge label="5천만 달성" achieved={emergencyFund >= settings.stage2Target} />
          </div>
        </div>
        <div className="metric-cell p-4">
          <p className="text-xs text-[var(--color-muted)]">고정비 방어력</p>
          <p className="mt-1 whitespace-nowrap text-lg font-bold tracking-[-0.03em] text-[var(--color-ink)] sm:text-2xl">{coverage.toFixed(1)}개월</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">월 고정비 {formatKrw(settings.monthlyFixedCost)}</p>
        </div>
        <div className="metric-cell p-4">
          <p className="text-xs text-[var(--color-muted)]">이달 배분 가능액</p>
          <p className="mt-1 whitespace-nowrap text-lg font-bold tracking-[-0.03em] text-[var(--color-ink)] sm:text-2xl">{formatKrw(totalAllocatable)}</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">공금 − 고정비 + 포함 성과급</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="app-card p-5">
            <h2 className="mb-4 text-base font-bold text-[var(--color-ink)]">이달 자금</h2>
            <div className="space-y-4">
              <MoneyInput label="매월 공금 납입금" value={jointContribution} onChange={setJointContribution} placeholder="7,000,000" />
              <p className="-mt-2 text-[12.5px] text-[var(--color-subtle)]">고정비를 제외한 정기 잉여금은 {formatKrw(regularSurplus)}입니다.</p>
              <MoneyInput label="성과급·일시 수입" value={bonusTotal} onChange={value => { setBonusTotal(value); setBonusToPlan(current => Math.min(current, value)) }} placeholder="0" />
              {bonusTotal > 0 ? <MoneyInput label="이번 달 배분에 포함할 성과급" value={bonusToPlan} onChange={value => setBonusToPlan(Math.min(value, bonusTotal))} placeholder="0" /> : null}
              {emergencyAccounts.length === 0 ? (
                <div className="border-t border-[var(--color-section)] pt-4">
                  <MoneyInput label="현재 비상금 (임시 수동 입력)" value={manualEmergencyFund} onChange={setManualEmergencyFund} placeholder="13,000,000" />
                  <p className="mt-1 text-[12.5px] text-amber-700">밸런스 시트에서 공동계좌나 MMF를 비상금으로 지정하면 자동 합산됩니다.</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="app-card p-5">
            <h2 className="mb-1 text-base font-bold text-[var(--color-ink)]">주택담보대출 납부</h2>
            <p className="mb-4 text-[12.5px] leading-5 text-[var(--color-muted)]">이자와 정기 원금은 고정비의 구성 내역입니다. 다시 비용으로 차감하지 않으며, 원금만 밸런스 시트의 대출 잔액을 줄입니다.</p>
            <div className="space-y-4">
              {mortgageDefaults ? (
                <div className="rounded-lg bg-[var(--color-primary-soft)] px-3 py-2 text-[12.5px] leading-5 text-[var(--color-primary)]">
                  <p>
                    대출 정보로 계산한 이번 달 납부: 이자 <strong className="tabular-nums">{formatKrw(mortgageDefaults.interest)}</strong>
                    {mortgageDefaults.principal !== null ? <> · 원금 <strong className="tabular-nums">{formatKrw(mortgageDefaults.principal)}</strong></> : null}
                  </p>
                  {mortgageInterest !== mortgageDefaults.interest || (mortgageDefaults.principal !== null && mortgagePrincipal !== mortgageDefaults.principal) ? (
                    <button type="button" onClick={() => { setMortgageInterest(mortgageDefaults.interest); if (mortgageDefaults.principal !== null) setMortgagePrincipal(mortgageDefaults.principal) }} className="mt-1 min-h-8 font-semibold underline">
                      계산값으로 채우기
                    </button>
                  ) : <p className="text-[12px] opacity-80">아래 칸에 채워져 있어요. 실제 납부액이 다르면 고쳐서 저장하세요.</p>}
                </div>
              ) : null}
              <MoneyInput label="이번 달 이자" value={mortgageInterest} onChange={setMortgageInterest} placeholder="2,500,000" />
              <MoneyInput label="이번 달 정기 원금" value={mortgagePrincipal} onChange={setMortgagePrincipal} placeholder="450,000" />
              <MoneyInput label="추가 원금 상환" value={mortgageExtraPrincipal} onChange={setMortgageExtraPrincipal} placeholder="0" />
              <div className="space-y-1 rounded-xl bg-[var(--color-section)] px-3 py-2.5 text-xs text-[var(--color-muted)]">
                <p className="flex justify-between gap-2"><span>납부액(이자+정기 원금)</span><strong className="tabular-nums text-[var(--color-ink)]">{formatKrw(mortgageInterest + mortgagePrincipal)}</strong></p>
                <p className="flex justify-between gap-2"><span>대출 잔액 감소</span><strong className="tabular-nums text-[var(--color-ink)]">{formatKrw(mortgagePrincipal + mortgageExtraPrincipal)}</strong></p>
                {mortgageBalance ? (
                  <p className="flex justify-between gap-2 border-t border-[var(--color-border)] pt-1"><span>납부 후 잔액</span><strong className="tabular-nums text-[var(--color-ink)]">{formatKrw(Math.max(mortgageBalance.previous - mortgagePrincipal - mortgageExtraPrincipal, 0))}</strong></p>
                ) : null}
              </div>
              {mortgageExtraPrincipal > 0 && !mortgageBalance?.manualThisMonth ? (
                <p className="text-[12px] leading-5 text-[var(--color-positive-strong)]">저장하면 추가 원금 {formatKrw(mortgageExtraPrincipal)}이 대출 잔액에서 바로 빠지고, 다음 달부터 줄어든 잔액으로 이자를 계산해요.</p>
              ) : null}
              {mortgageBalance?.manualThisMonth ? (
                <p className="text-[12px] leading-5 text-[var(--color-accent)]">이 달 대출 잔액을 잔액 이력에 직접 입력해 두어서, 여기 적은 원금은 잔액에 반영되지 않아요. 은행 잔액을 그대로 쓰려면 그대로 두고, 원금으로 깎으려면 밸런스 시트 잔액 이력에서 이 달 기록을 지우세요.</p>
              ) : null}
            </div>
          </section>
        </div>

        <section className="app-card mt-4 overflow-hidden">
          <div className="flex flex-col justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-section)] px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-[var(--color-ink)]">계좌별 배분과 월말 잔액</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">실제 보낸 금액은 배분액에, 월말 앱 잔액은 평가금액에 입력합니다. 평가금액만 총자산에 반영됩니다.</p>
            </div>
            <div className="text-right text-[12.5px]">
              <p className="text-[var(--color-muted)]">배분 {formatKrw(allocatedTotal)} / 가능 {formatKrw(totalAllocatable)}</p>
              <p className={unallocated < 0 ? 'font-semibold text-red-600' : 'font-semibold text-[var(--color-primary)]'}>{unallocated < 0 ? `초과 ${formatKrw(-unallocated)}` : `미배분 ${formatKrw(unallocated)}`}</p>
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[var(--color-subtle)]">
              <Link href="/net-worth" className="font-semibold text-[var(--color-primary)] hover:underline">밸런스 시트에서 금융계좌를 먼저 추가하세요.</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-px bg-[var(--color-border)] sm:grid-cols-2">
              {accounts.map(account => {
                const values = accountValues[account.id] ?? { evaluationAmount: 0, monthlyAllocation: 0, ytdContribution: 0 }
                const isPension = account.type === 'pension' || account.type === 'irp'
                return (
                  <div key={account.id} className="bg-white p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{account.name}</p>
                        <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{account.owner === 'spouse' ? '아내' : '나'} · {accountTypeLabel(account.type)}{account.broker ? ` · ${account.broker}` : ''}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {account.is_emergency_fund ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11.5px] font-semibold text-amber-700">비상금</span> : null}
                        {isPension ? <span className="rounded-full bg-[var(--color-spouse-soft)] px-2 py-1 text-[11.5px] font-semibold text-[var(--color-spouse)]">연금</span> : null}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      <MoneyInput idSuffix={account.id} label="이번 달 배분액" value={values.monthlyAllocation} onChange={value => updateAccount(account.id, 'monthlyAllocation', value)} placeholder="0" />
                      <div>
                        <MoneyInput idSuffix={account.id} label="월말 평가금액" value={values.evaluationAmount} onChange={value => updateAccount(account.id, 'evaluationAmount', value)} placeholder="0" />
                        {stockValues[account.id] ? (
                          <StockImport
                            stock={stockValues[account.id]}
                            onImport={() => updateAccount(account.id, 'evaluationAmount', stockValues[account.id].value)}
                          />
                        ) : null}
                      </div>
                      {isPension ? <MoneyInput idSuffix={account.id} label={`${month.slice(0, 4)}년 누적 납입액`} value={values.ytdContribution} onChange={value => updateAccount(account.id, 'ytdContribution', value)} placeholder="0" /> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="app-card mt-4 p-5">
          <label htmlFor="budget-memo" className="mb-1 block text-xs text-[var(--color-muted)]">월별 메모</label>
          <textarea id="budget-memo" value={memo} onChange={event => setMemo(event.target.value)} placeholder="이번 달 특이사항" rows={2} className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)]" />
        </section>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--color-ink)]">이달 정보를 한 번에 저장합니다</p>
            <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">자금 흐름, 계좌 월말 금액, 연금 누적액, 주담대 원금 감소가 함께 반영됩니다.</p>
            {error ? <p className="mt-2 text-xs text-[var(--color-negative)]" role="alert">{error}</p> : null}
          </div>
          <button type="submit" disabled={pending} className="min-h-11 shrink-0 rounded-xl bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-strong)] disabled:opacity-40">
            {pending ? '저장 중…' : saved ? '저장됨 ✓' : '이달 기록 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

function GoalBadge({ label, achieved }: { label: string; achieved: boolean }) {
  return <span className={`rounded-full px-2 py-1 text-[11.5px] font-semibold ${achieved ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'bg-[var(--color-section)] text-[var(--color-subtle)]'}`}>{achieved ? '✓ ' : ''}{label}</span>
}

function accountTypeLabel(type: Account['type']) {
  const labels: Partial<Record<Account['type'], string>> = {
    cash: '입출금·공동계좌', mmf: 'CMA·MMF', general: '주식·증권계좌', pension: '연금저축', irp: 'IRP', isa: 'ISA', crypto: '코인',
  }
  return labels[type] ?? type
}

function StockImport({ stock, onImport }: { stock: { value: number; holdings: number; missing: number; priceDate: string | null }; onImport: () => void }) {
  const date = stock.priceDate
    ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(stock.priceDate))
    : null
  return (
    <div className="mt-1.5 rounded-lg bg-[var(--color-primary-soft)] px-3 py-2 text-[12.5px] leading-5">
      <button type="button" onClick={onImport} disabled={stock.value <= 0} className="inline-flex min-h-8 items-center font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-50">
        보유종목 평가액 불러오기 · {formatKrw(stock.value)}
      </button>
      <p className="text-[var(--color-muted)]">
        {date ? `${date} 현재가 기준` : '현재가 미입력'} · {stock.holdings}종목{stock.missing > 0 ? ` (현재가 없는 ${stock.missing}종목 제외)` : ''}. 예수금(현금)은 따로 더해 주세요.
      </p>
    </div>
  )
}

function MoneyInput({ label, value, onChange, placeholder, idSuffix }: { label: string; value: number; onChange: (value: number) => void; placeholder: string; idSuffix?: string }) {
  // 계좌마다 같은 이름표가 반복되므로 계좌 id를 붙여 입력칸 id가 겹치지 않게 한다.
  const id = `money-${label.replace(/[^가-힣a-zA-Z0-9]/g, '-')}${idSuffix ? `-${idSuffix}` : ''}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-[var(--color-muted)]">{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="text" inputMode="numeric" value={formatInput(value)} onChange={event => onChange(parseNumber(event.target.value))} placeholder={placeholder} className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-right text-sm font-medium tabular-nums shadow-inner outline-none focus:border-[var(--color-primary)]" />
        <span className="shrink-0 text-xs text-[var(--color-muted)]">원</span>
      </div>
    </div>
  )
}
