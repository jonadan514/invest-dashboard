'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAsset, updateAsset } from './actions'
import { STOCK_CLASSES, classLabel } from './asset-classes'
import { currencyForClass } from '@/lib/asset-edit'

export interface ManagedAsset {
  id: string
  name: string
  symbol: string | null
  asset_class: string
  currency: string
  /** 이 종목을 쓰는 거래 수 */
  trades: number
  /** 모든 계좌 합계 보유 수량 */
  held: number
}

const INPUT = 'field-input'

/** 주식 계좌 > 종목 관리: 종목 이름·코드·구분 수정, 거래 없는 종목 삭제. */
export default function AssetManager({ assets }: { assets: ManagedAsset[] }) {
  if (assets.length === 0) {
    return <p className="px-5 py-10 text-center text-[13px] text-[var(--color-muted)]">아직 등록된 종목이 없어요. 거래 기록에서 거래를 입력할 때 새 종목을 추가할 수 있어요.</p>
  }
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {assets.map(asset => <AssetRow key={asset.id} asset={asset} />)}
    </ul>
  )
}

function AssetRow({ asset }: { asset: ManagedAsset }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [assetClass, setAssetClass] = useState(asset.asset_class)
  const nextCurrency = currencyForClass(assetClass, asset.currency)
  const currencyLocked = asset.trades > 0
  const classOptions = STOCK_CLASSES.some(item => item.value === asset.asset_class)
    ? STOCK_CLASSES
    : [...STOCK_CLASSES, { value: asset.asset_class, label: classLabel(asset.asset_class), currency: asset.currency }]

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await task()
        if (!result.ok) {
          setError(result.error)
          return
        }
        after?.()
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      }
    })
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    run(() => updateAsset(asset.id, data), () => setEditing(false))
  }

  function remove() {
    if (!confirm(`‘${asset.name}’ 종목을 삭제할까요? 저장된 현재가도 함께 지워집니다.`)) return
    run(() => deleteAsset(asset.id))
  }

  return (
    <li className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-semibold">{asset.name}</span>
            {asset.symbol ? <span className="text-[12.5px] tabular-nums text-[var(--color-muted)]">{asset.symbol}</span> : null}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] text-[var(--color-muted)]">
            <span>{classLabel(asset.asset_class)} · {asset.currency === 'USD' ? '달러' : '원화'}</span>
            <span>거래 {asset.trades}건</span>
            {asset.held > 0 ? <span className="tabular-nums">보유 {asset.held.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}주</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" onClick={() => { setEditing(value => !value); setError(null); setAssetClass(asset.asset_class) }} className="min-h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[12.5px] font-semibold">{editing ? '닫기' : '수정'}</button>
          <button
            type="button"
            onClick={remove}
            disabled={pending || asset.trades > 0}
            title={asset.trades > 0 ? '거래가 있는 종목은 지울 수 없어요' : undefined}
            className="min-h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[12.5px] font-semibold text-[var(--color-negative)] disabled:cursor-not-allowed disabled:opacity-40"
          >삭제</button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-section)] p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[var(--color-muted)]">종목 이름</span>
              <input name="name" required maxLength={200} defaultValue={asset.name} className={INPUT} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[var(--color-muted)]">종목 코드(선택)</span>
              <input name="symbol" maxLength={64} defaultValue={asset.symbol ?? ''} placeholder="예: 005930, AAPL" className={INPUT} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[var(--color-muted)]">구분</span>
              <select name="asset_class" value={assetClass} onChange={event => setAssetClass(event.target.value)} className={INPUT}>
                {classOptions.map(item => (
                  <option key={item.value} value={item.value} disabled={currencyLocked && currencyForClass(item.value, asset.currency) !== asset.currency}>
                    {item.label} ({currencyForClass(item.value, asset.currency)})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[12.5px] leading-5 text-[var(--color-muted)]">
            {currencyLocked
              ? `거래가 있어서 ${asset.currency === 'USD' ? '달러' : '원화'} 구분끼리만 바꿀 수 있어요. 통화가 잘못됐다면 새 종목으로 거래를 다시 입력하고, 이 종목의 거래를 지운 뒤 삭제해 주세요.`
              : nextCurrency !== asset.currency
                ? `통화가 ${nextCurrency === 'USD' ? '달러' : '원화'}로 바뀌어요. 저장된 현재가는 지워지니 다시 입력해 주세요.`
                : '거래가 없어 구분과 통화를 자유롭게 바꿀 수 있어요.'}
          </p>
          {error ? <p role="alert" className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[13px] font-semibold">취소</button>
            <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-[var(--color-primary)] px-5 text-[13px] font-bold text-white disabled:opacity-50">{pending ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      ) : error ? (
        <p role="alert" className="mt-2 rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">{error}</p>
      ) : null}
    </li>
  )
}
