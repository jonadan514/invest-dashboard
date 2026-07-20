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
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0ead8] last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <p className="text-sm font-medium text-[#34322b]">{asset.name}</p>
          <p className="text-[10px] text-[#9c9484]">
            {CLASS_LABEL[asset.asset_class] ?? asset.asset_class} · {asset.currency}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <input
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
              placeholder={SYMBOL_HINT[asset.asset_class] ?? ''}
              autoFocus
              className="w-28 text-xs bg-white border border-[#1c6b4a] rounded-lg px-2 py-1.5 focus:outline-none"
            />
            <button
              onClick={save}
              disabled={pending}
              className="text-xs bg-[#1c6b4a] text-white rounded-lg px-3 py-1.5 hover:bg-[#165638] disabled:opacity-50"
            >
              저장
            </button>
            <button
              onClick={() => { setSymbol(asset.symbol ?? ''); setEditing(false) }}
              className="text-xs text-[#9c9484] hover:text-[#34322b]"
            >
              취소
            </button>
          </>
        ) : (
          <>
            <span
              onClick={() => setEditing(true)}
              className={`text-xs px-2 py-1 rounded cursor-pointer ${
                asset.symbol
                  ? 'bg-[#e8f4ee] text-[#1c6b4a] font-mono font-medium'
                  : 'bg-[#f0ead8] text-[#b5aa98] italic'
              }`}
            >
              {asset.symbol ?? '심볼 없음'}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] text-[#9c9484] hover:text-[#1c6b4a]"
            >
              수정
            </button>
            <button
              onClick={handleDelete}
              disabled={pending}
              className="text-[10px] text-[#b5aa98] hover:text-red-500 disabled:opacity-40"
            >
              삭제
            </button>
          </>
        )}
      </div>
    </div>
  )
}
