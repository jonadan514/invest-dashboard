'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTrade, updateTrade } from './actions'
import { STOCK_CLASSES } from './asset-classes'
import { DEFAULT_FEE_RATE, estimateFee, estimateTax, feeRateKey, formatRate, taxRule } from '@/lib/calc/trade-costs'

export interface TradeAccount { id: string; name: string; owner: string; type: string }
export interface TradeAsset { id: string; name: string; symbol: string | null; currency: string; asset_class: string }
export interface TradeInitial {
  id: string
  date: string
  account_id: string
  asset_id: string
  type: 'buy' | 'sell' | 'dividend'
  quantity: number | null
  price: number | null
  amount: number | null
  fee: number
  tax: number
  fx_rate: number | null
}
/** 수수료 자동 계산에 쓰는 값. feeRates 키는 `${계좌}:${통화}`. */
export interface TradeCostContext {
  feeRates: Record<string, number>
  usdKrw: number | null
}

const TYPES = [
  { value: 'buy', label: '매수' },
  { value: 'sell', label: '매도' },
  { value: 'dividend', label: '배당' },
] as const

const CLASSES = STOCK_CLASSES

const INPUT = 'min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-[14px] focus:border-[var(--color-primary)] focus:outline-none'

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

function parse(text: string) {
  const value = Number(text.replace(/,/g, '').trim())
  return Number.isFinite(value) ? value : 0
}

function text(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value)
}

/** 거래 추가(initial 없음)와 수정(initial 있음)에 함께 쓴다. 수정에서는 계좌·종목을 바꾸지 않는다. */
export default function TradeForm({ accounts, assets, costs, initial, onDone }: {
  accounts: TradeAccount[]
  assets: TradeAsset[]
  costs: TradeCostContext
  initial?: TradeInitial
  onDone?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<TradeInitial['type']>(initial?.type ?? 'buy')
  const [date, setDate] = useState(initial?.date ?? today())
  const [accountId, setAccountId] = useState(initial?.account_id ?? accounts[0]?.id ?? '')
  const [assetId, setAssetId] = useState(initial?.asset_id ?? assets[0]?.id ?? 'new')
  const [assetClass, setAssetClass] = useState<string>('kr_stock')
  const [quantity, setQuantity] = useState(text(initial?.quantity))
  const [price, setPrice] = useState(text(initial?.price))
  const [cashAmount, setCashAmount] = useState(initial?.type === 'dividend' ? text(initial.amount) : '')
  const [fxRate, setFxRate] = useState(initial?.fx_rate && initial.fx_rate >= 100 ? String(initial.fx_rate) : '')
  const [rateOverride, setRateOverride] = useState<string | null>(null)
  // 수정할 때는 저장된 수수료·세금을 그대로 두고, 새 거래는 자동 계산으로 시작한다.
  const [feeAuto, setFeeAuto] = useState(!initial)
  const [taxAuto, setTaxAuto] = useState(!initial)
  const [feeText, setFeeText] = useState(text(initial?.fee ?? 0))
  const [taxText, setTaxText] = useState(text(initial?.tax ?? 0))

  const isNew = !initial && assetId === 'new'
  const selectedAsset = assets.find(asset => asset.id === assetId)
  const currency = isNew
    ? CLASSES.find(item => item.value === assetClass)?.currency ?? 'KRW'
    : selectedAsset?.currency ?? 'KRW'
  const effectiveClass = isNew ? assetClass : selectedAsset?.asset_class ?? 'other'
  const accountType = accounts.find(account => account.id === accountId)?.type ?? null
  const isTrade = type === 'buy' || type === 'sell'
  const isUsd = currency === 'USD'
  const unit = isUsd ? '달러' : '원'
  const typeLabel = TYPES.find(item => item.value === type)?.label ?? '거래'

  const learnedRate = costs.feeRates[feeRateKey(accountId, currency)]
  const defaultRate = learnedRate ?? DEFAULT_FEE_RATE[currency] ?? 0
  const feeRate = rateOverride === null ? defaultRate : parse(rateOverride) / 100
  const gross = isTrade ? parse(quantity) * parse(price) : parse(cashAmount)
  const rule = taxRule({ type, currency, assetClass: effectiveClass, accountType, date })
  const fee = feeAuto ? (isTrade ? estimateFee(gross, feeRate, currency) : 0) : parse(feeText)
  const tax = taxAuto ? estimateTax(gross, rule, type, currency) : parse(taxText)
  const feeValue = feeAuto ? String(fee) : feeText
  const taxValue = taxAuto ? String(tax) : taxText

  const fx = parse(fxRate)
  const settled = type === 'buy' ? gross + fee + tax : gross - fee - tax
  const money = (value: number) => isUsd
    ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${Math.round(value).toLocaleString('ko-KR')}원`

  function resetRate() {
    setRateOverride(null)
  }

  function clearAfterSave() {
    setType('buy')
    setDate(today())
    setQuantity('')
    setPrice('')
    setCashAmount('')
    setFxRate('')
    setFeeAuto(true)
    setTaxAuto(true)
    setFeeText('0')
    setTaxText('0')
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const data = new FormData(form)
    if (isNew) data.set('asset_currency', currency)
    startTransition(async () => {
      try {
        const result = initial ? await updateTrade(initial.id, data) : await createTrade(data)
        if (!result.ok) {
          setError(result.error)
          return
        }
        if (!initial) {
          form.reset()
          clearAfterSave()
        }
        onDone?.()
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="거래 유형">
        {TYPES.map(item => (
          <label key={item.value} className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border px-4 text-[13px] font-semibold ${type === item.value ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] bg-white text-[var(--color-muted)]'}`}>
            <input type="radio" name="type" value={item.value} checked={type === item.value} onChange={() => setType(item.value)} className="sr-only" />
            {item.label}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="거래일">
          <input name="date" type="date" required value={date} onChange={event => setDate(event.target.value)} className={INPUT} />
        </Field>
        {initial ? (
          <input type="hidden" name="account_id" value={initial.account_id} />
        ) : (
          <Field label="계좌">
            <select name="account_id" required className={INPUT} value={accountId} onChange={event => { setAccountId(event.target.value); resetRate() }}>
              {accounts.map(account => <option key={account.id} value={account.id}>{account.name}{account.owner === 'spouse' ? ' (아내)' : ''}</option>)}
            </select>
          </Field>
        )}
        {initial ? (
          <Field label="종목" hint="같은 통화 종목으로만 옮길 수 있어요.">
            <select name="new_asset_id" value={assetId} onChange={event => { setAssetId(event.target.value); resetRate() }} className={INPUT}>
              {assets.filter(asset => asset.id === initial.asset_id || asset.currency === currency).map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.symbol ? ` (${asset.symbol})` : ''}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="종목">
            <select name="asset_id" value={assetId} onChange={event => { setAssetId(event.target.value); resetRate() }} className={INPUT}>
              {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.symbol ? ` (${asset.symbol})` : ''}</option>)}
              <option value="new">+ 새 종목 추가</option>
            </select>
          </Field>
        )}
      </div>

      {isNew ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-[var(--color-section)] p-3 sm:grid-cols-3">
          <Field label="종목 이름"><input name="asset_name" required placeholder="예: 삼성전자" className={INPUT} /></Field>
          <Field label="종목 코드(선택)"><input name="asset_symbol" placeholder="예: 005930, AAPL" className={INPUT} /></Field>
          <Field label="구분">
            <select name="asset_class" value={assetClass} onChange={event => { setAssetClass(event.target.value); resetRate() }} className={INPUT}>
              {CLASSES.map(item => <option key={item.value} value={item.value}>{item.label} ({item.currency})</option>)}
            </select>
          </Field>
        </div>
      ) : null}

      {isUsd ? (
        <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] p-3">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
            <Field label={`${typeLabel} 환율(원/달러)`}>
              <input name="fx_rate" inputMode="decimal" required value={fxRate} onChange={event => setFxRate(event.target.value)} placeholder={costs.usdKrw ? `예: ${costs.usdKrw.toLocaleString('ko-KR')}` : '예: 1,390'} className={INPUT} />
            </Field>
            <div className="text-[12.5px] leading-5 text-[var(--color-muted)]">
              <p>증권사 체결 내역의 <b>적용 환율</b>을 적어 주세요. 원화 평균 단가와 실현손익을 이 환율로 계산해요.</p>
              {costs.usdKrw ? (
                <button type="button" onClick={() => setFxRate(String(costs.usdKrw))} className="mt-1 text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">
                  저장된 환율 {costs.usdKrw.toLocaleString('ko-KR')}원 넣기
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`grid grid-cols-2 gap-3 ${isTrade ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-3'}`}>
        {isTrade ? (
          <>
            <Field label="수량"><input name="quantity" inputMode="decimal" required value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="0" className={INPUT} /></Field>
            <Field label={`단가(${unit})`}><input name="price" inputMode="decimal" required value={price} onChange={event => setPrice(event.target.value)} placeholder="0" className={INPUT} /></Field>
            <Field label="수수료율(%)" hint={rateOverride !== null ? <button type="button" onClick={resetRate} className="font-semibold text-[var(--color-primary)] hover:underline">{learnedRate !== undefined ? '지난 거래 비율로' : '기본값으로'}</button> : learnedRate !== undefined ? '이 계좌 지난 거래 기준' : '기본값 · 내 요율로 고쳐도 돼요'}>
              <input inputMode="decimal" aria-label="수수료율(%)" value={rateOverride ?? Number((defaultRate * 100).toFixed(5)).toString()} onChange={event => { setRateOverride(event.target.value); setFeeAuto(true) }} className={INPUT} />
            </Field>
          </>
        ) : (
          <Field label={`받은 배당금(${unit}, 세전)`}>
            <input name="cash_amount" inputMode="decimal" required value={cashAmount} onChange={event => setCashAmount(event.target.value)} placeholder="0" className={INPUT} />
          </Field>
        )}
        <Field label={`수수료(${unit})`} hint={<AutoHint auto={feeAuto} onReset={() => setFeeAuto(true)} text={isTrade ? `${formatRate(feeRate)} 자동 계산` : '배당은 수수료 0'} />}>
          <input name="fee" inputMode="decimal" value={feeValue} onChange={event => { setFeeAuto(false); setFeeText(event.target.value) }} className={INPUT} />
        </Field>
        <Field label={`${type === 'dividend' ? '원천징수 세금' : '세금'}(${unit})`} hint={<AutoHint auto={taxAuto} onReset={() => setTaxAuto(true)} text={rule.note} />}>
          <input name="tax" inputMode="decimal" value={taxValue} onChange={event => { setTaxAuto(false); setTaxText(event.target.value) }} className={INPUT} />
        </Field>
      </div>

      {gross > 0 ? (
        <p className="rounded-lg bg-[var(--color-section)] px-3 py-2 text-[12.5px] tabular-nums text-[var(--color-muted)]">
          {type === 'buy' ? '결제 금액' : '받는 금액'} <b className="text-[var(--color-ink)]">{money(settled)}</b>
          {isTrade ? ` = ${money(gross)} ${type === 'buy' ? '+' : '−'} 수수료 ${money(fee)}${tax > 0 ? ` ${type === 'buy' ? '+' : '−'} 세금 ${money(tax)}` : ''}` : ` = 세전 ${money(gross)} − 세금 ${money(tax)}`}
          {isUsd && fx >= 100 ? ` · 원화 약 ${Math.round(settled * fx).toLocaleString('ko-KR')}원` : ''}
        </p>
      ) : null}

      {error ? <p role="alert" className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {onDone && initial ? <button type="button" onClick={onDone} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[13px] font-semibold">취소</button> : null}
        <button type="submit" disabled={pending || accounts.length === 0} className="min-h-10 rounded-lg bg-[var(--color-primary)] px-5 text-[13px] font-bold text-white disabled:opacity-50">
          {pending ? '저장 중…' : initial ? '수정 저장' : '거래 저장'}
        </button>
      </div>
    </form>
  )
}

function AutoHint({ auto, text, onReset }: { auto: boolean; text: string; onReset: () => void }) {
  if (auto) return <>{text}</>
  return <>직접 입력 · <button type="button" onClick={onReset} className="font-semibold text-[var(--color-primary)] hover:underline">자동 계산</button></>
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-[var(--color-muted)]">{label}</span>
        {children}
      </label>
      {hint ? <p className="mt-1 text-[11.5px] leading-4 text-[var(--color-subtle)]">{hint}</p> : null}
    </div>
  )
}
