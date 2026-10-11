'use client'
import { useState, useTransition } from 'react'
import { updateAssetSymbol, deleteAsset } from './actions'

const CLASS_LABEL: Record<string, string> = {
  kr_stock: '국내주식', us_stock: '미국주식',
  etf_kr: '국내ETF', etf_us: '미국ETF',
  crypto: '코인', deposit: '예적금', other: '기타',
}

const SYMBOL_HINT: Record<string, string> = {
  kr_stock: '예) 005930', us_stock: '예) AAPL',
  etf_kr: '예) 396500', etf_us: '예) QQQ',
  crypto: '예) BTC', deposit: '', other: '',
}

export default function AssetRow({ asset }: {
  asset: { id: string; name: string; symbol: string | null; asset_class: string; currency: string }
}) {
  const [editing, setEditing] = useState(false)
  const [symbol, setSymbol] = useState(asset.symbol ?? '')
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      await updateAssetSymbol(asset.id, symbol)
      setEditing(false)
    })
  }

  function handleDelete() {
    if (!confirm(`"${asset.name}" 종목을 삭제할까요?\n관련 거래 내역도 모두 삭제됩니다.`)) return
    startTransition(() => deleteAsset(asset.id))
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">{asset.name}</p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {CLASS_LABEL[asset.asset_class] ?? asset.asset_class} · {asset.currency}
          </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
        {editing ? (
          <>
            <input
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
              placeholder={SYMBOL_HINT[asset.asset_class] ?? ''}
              autoFocus
              className="min-w-28 flex-1 rounded-lg border border-[var(--color-primary)] bg-white px-2 py-1.5 text-xs focus:outline-none sm:w-28 sm:flex-none"
            />
            <button
              onClick={save}
              disabled={pending}
              type="button"
              className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:bg-[var(--color-primary-strong)] disabled:opacity-50"
            >
              저장
            </button>
            <button
              onClick={() => { setSymbol(asset.symbol ?? ''); setEditing(false) }}
              type="button"
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              취소
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={`max-w-full truncate rounded px-2 py-1 text-xs ${
                asset.symbol
                  ? 'bg-[#eaf3fb] text-[#3f7fc3] font-mono font-medium'
                  : 'bg-[#edf3f8] text-[#93a2b5] italic'
              }`}
            >
              {asset.symbol ?? '심볼 없음'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] text-[#65758a] hover:text-[#3f7fc3]"
            >
              수정
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="text-[10px] text-[#93a2b5] hover:text-red-500 disabled:opacity-40"
            >
              삭제
            </button>
          </>
        )}
      </div>
    </div>
  )
}
