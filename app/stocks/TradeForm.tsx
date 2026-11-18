'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTrade, updateTrade } from './actions'

export interface TradeAccount { id: string; name: string; owner: string }
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

const TYPES = [
  { value: 'buy', label: '매수' },
  { value: 'sell', label: '매도' },
  { value: 'dividend', label: '배당' },
] as const

const CLASSES = [
  { value: 'kr_stock', label: '국내주식', currency: 'KRW' },
  { value: 'etf_kr', label: '국내ETF', currency: 'KRW' },
  { value: 'us_stock', label: '미국주식', currency: 'USD' },
  { value: 'etf_us', label: '미국ETF', currency: 'USD' },
  { value: 'other', label: '기타', currency: 'KRW' },
] as const

const INPUT = 'min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-[14px] focus:border-[var(--color-primary)] focus:outline-none'

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

/** 거래 추가(initial 없음)와 수정(initial 있음)에 함께 쓴다. 수정에서는 계좌·종목을 바꾸지 않는다. */
export default function TradeForm({ accounts, assets, initial, onDone }: {
  accounts: TradeAccount[]
  assets: TradeAsset[]
  initial?: TradeInitial
  onDone?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<TradeInitial['type']>(initial?.type ?? 'buy')
  const [assetId, setAssetId] = useState(initial?.asset_id ?? assets[0]?.id ?? 'new')
  const [assetClass, setAssetClass] = useState<string>('kr_stock')
  const isNew = !initial && assetId === 'new'
  const currency = isNew
    ? CLASSES.find(item => item.value === assetClass)?.currency ?? 'KRW'
    : assets.find(asset => asset.id === assetId)?.currency ?? 'KRW'
  const isTrade = type === 'buy' || type === 'sell'

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
          setType('buy')
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="거래일">
          <input name="date" type="date" required defaultValue={initial?.date ?? today()} className={INPUT} />
        </Field>
        {initial ? (
          <input type="hidden" name="account_id" value={initial.account_id} />
        ) : (
          <Field label="계좌">
            <select name="account_id" required className={INPUT} defaultValue={accounts[0]?.id}>
              {accounts.map(account => <option key={account.id} value={account.id}>{account.name}{account.owner === 'spouse' ? ' (아내)' : ''}</option>)}
            </select>
          </Field>
        )}
        {initial ? null : (
          <Field label="종목">
            <select name="asset_id" value={assetId} onChange={event => setAssetId(event.target.value)} className={INPUT}>
              {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.symbol ? ` (${asset.symbol})` : ''}</option>)}
              <option value="new">+ 새 종목 추가</option>
            </select>
          </Field>
        )}
        {currency === 'USD' ? (
          <Field label="거래 당시 환율(원/달러)">
            <input name="fx_rate" inputMode="decimal" required defaultValue={initial?.fx_rate && initial.fx_rate >= 100 ? initial.fx_rate : ''} placeholder="예: 1,390" className={INPUT} />
          </Field>
        ) : null}
      </div>

      {isNew ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-[var(--color-section)] p-3 sm:grid-cols-3">
          <Field label="종목 이름"><input name="asset_name" required placeholder="예: 삼성전자" className={INPUT} /></Field>
          <Field label="종목 코드(선택)"><input name="asset_symbol" placeholder="예: 005930, AAPL" className={INPUT} /></Field>
          <Field label="구분">
            <select name="asset_class" value={assetClass} onChange={event => setAssetClass(event.target.value)} className={INPUT}>
              {CLASSES.map(item => <option key={item.value} value={item.value}>{item.label} ({item.currency})</option>)}
            </select>
          </Field>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isTrade ? (
          <>
            <Field label="수량"><input name="quantity" inputMode="decimal" required defaultValue={initial?.quantity ?? ''} placeholder="0" className={INPUT} /></Field>
            <Field label={`단가(${currency === 'USD' ? '달러' : '원'})`}><input name="price" inputMode="decimal" required defaultValue={initial?.price ?? ''} placeholder="0" className={INPUT} /></Field>
          </>
        ) : (
          <Field label={`받은 배당금(${currency === 'USD' ? '달러' : '원'}, 세전)`}>
            <input name="cash_amount" inputMode="decimal" required defaultValue={initial?.type === 'dividend' ? initial.amount ?? '' : ''} placeholder="0" className={INPUT} />
          </Field>
        )}
        <Field label="수수료"><input name="fee" inputMode="decimal" defaultValue={initial?.fee ?? 0} className={INPUT} /></Field>
        <Field label={type === 'dividend' ? '원천징수 세금' : '세금'}><input name="tax" inputMode="decimal" defaultValue={initial?.tax ?? 0} className={INPUT} /></Field>
      </div>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-semibold text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  )
}
