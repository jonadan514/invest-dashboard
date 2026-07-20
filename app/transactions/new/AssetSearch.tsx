'use client'
import { useState, useEffect, useRef } from 'react'
import type { SearchResult } from '@/app/api/search/route'

type Asset = { id: string; name: string; symbol: string | null; asset_class: string; currency: string }

export type SelectedAsset =
  | { mode: 'existing'; id: string; name: string; currency: string }
  | { mode: 'new'; symbol: string; name: string; assetClass: string; currency: string }

const CLASS_LABEL: Record<string, string> = {
  kr_stock: '국내주식', us_stock: '미국주식',
  etf_kr: '국내ETF', etf_us: '미국ETF',
  crypto: '코인', deposit: '예적금', other: '기타',
}

const ASSET_CLASSES = [
  { value: 'kr_stock', label: '국내주식' },
  { value: 'us_stock', label: '미국주식' },
  { value: 'etf_kr', label: '국내ETF' },
  { value: 'etf_us', label: '미국ETF' },
  { value: 'crypto', label: '코인' },
  { value: 'deposit', label: '예적금' },
]

function ManualForm({ onSelect, onCancel }: {
  onSelect: (a: SelectedAsset) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [assetClass, setAssetClass] = useState('kr_stock')
  const [currency, setCurrency] = useState('KRW')

  return (
    <div className="space-y-2 bg-[#f4eee0] rounded-xl p-3 mt-2">
      <p className="text-[10px] font-semibold text-[#9c9484] mb-2">직접 입력</p>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="종목명 * (예: 삼성전자)"
        autoFocus
        className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase())}
          placeholder="티커 (예: 005930, AAPL)"
          className="text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
        />
        <select
          value={assetClass}
          onChange={e => {
            setAssetClass(e.target.value)
            setCurrency(['us_stock', 'etf_us'].includes(e.target.value) ? 'USD' : 'KRW')
          }}
          className="text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
        >
          {ASSET_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <select
        value={currency}
        onChange={e => setCurrency(e.target.value)}
        className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
      >
        <option value="KRW">KRW (원화)</option>
        <option value="USD">USD (달러)</option>
      </select>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return
            onSelect({ mode: 'new', symbol, name: name.trim(), assetClass, currency })
          }}
          className="flex-1 bg-[#1c6b4a] text-white text-xs font-semibold rounded-lg py-2 hover:bg-[#165638]"
        >
          선택
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[#9c9484] hover:text-[#34322b] px-3"
        >
          취소
        </button>
      </div>
    </div>
  )
}

export default function AssetSearch({
  existing,
  onSelect,
}: {
  existing: Asset[]
  onSelect: (asset: SelectedAsset | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<SelectedAsset | null>(null)
  const [showManual, setShowManual] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredExisting = query.length > 0
    ? existing.filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        (a.symbol?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : existing.slice(0, 5)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        // 현재 검색어에 매칭되어 실제로 보이는 기존 종목의 심볼만 제외
        // (보이지 않는 기존 종목까지 제거하면 결과가 사라지는 버그 방지)
        const visibleSymbols = new Set(
          existing
            .filter(a =>
              a.name.toLowerCase().includes(query.toLowerCase()) ||
              (a.symbol?.toLowerCase().includes(query.toLowerCase()) ?? false)
            )
            .map(a => a.symbol)
            .filter(Boolean)
        )
        setResults((data.results ?? []).filter((r: SearchResult) => !visibleSymbols.has(r.symbol)))
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [query, existing])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function pick(sel: SelectedAsset) {
    setSelected(sel)
    setQuery('')
    setOpen(false)
    setShowManual(false)
    onSelect(sel)
  }

  function clear() {
    setSelected(null)
    setQuery('')
    setResults([])
    setShowManual(false)
    onSelect(null)
  }

  const showDropdown = open && !showManual && (
    filteredExisting.length > 0 || results.length > 0 || loading || query.length >= 2
  )

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-[#e8f4ee] border border-[#c5dece] rounded-xl px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-[#1c6b4a]">{selected.name}</p>
          <p className="text-[10px] text-[#3d9970]">
            {selected.mode === 'existing'
              ? `기존 종목 · ${selected.currency}`
              : `신규 · ${selected.symbol || '심볼 없음'} · ${CLASS_LABEL[selected.assetClass] ?? ''} · ${selected.currency}`
            }
          </p>
        </div>
        <button type="button" onClick={clear} className="text-xs text-[#1c6b4a] hover:text-[#0d4a33] ml-3 shrink-0">
          변경
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setShowManual(false) }}
          onFocus={() => setOpen(true)}
          placeholder="종목명 또는 티커 검색 (예: 삼성전자, AAPL, BTC)"
          autoComplete="off"
          className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#9c9484] animate-pulse">검색 중</span>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e3d9c4] rounded-xl shadow-lg z-20 overflow-hidden max-h-72 overflow-y-auto">
          {filteredExisting.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-[#9c9484] px-3 pt-2.5 pb-1 uppercase tracking-wide">보유 종목</p>
              {filteredExisting.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pick({ mode: 'existing', id: a.id, name: a.name, currency: a.currency })}
                  className="w-full text-left flex items-center justify-between px-3 py-2 hover:bg-[#f4eee0] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-[#34322b]">{a.name}</p>
                    <p className="text-[10px] text-[#9c9484]">{CLASS_LABEL[a.asset_class] ?? a.asset_class} · {a.currency}</p>
                  </div>
                  {a.symbol && (
                    <span className="text-[10px] font-mono text-[#1c6b4a] bg-[#e8f4ee] px-1.5 py-0.5 rounded ml-2 shrink-0">
                      {a.symbol}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}

          {results.length > 0 && (
            <>
              {filteredExisting.length > 0 && <div className="border-t border-[#f0ead8] my-1" />}
              <p className="text-[10px] font-semibold text-[#9c9484] px-3 pt-1 pb-1 uppercase tracking-wide">Yahoo Finance</p>
              {results.map(r => (
                <button
                  key={r.yahooSymbol}
                  type="button"
                  onClick={() => pick({ mode: 'new', symbol: r.symbol, name: r.name, assetClass: r.assetClass, currency: r.currency })}
                  className="w-full text-left flex items-center justify-between px-3 py-2 hover:bg-[#f4eee0] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-[#34322b]">{r.name}</p>
                    <p className="text-[10px] text-[#9c9484]">{CLASS_LABEL[r.assetClass] ?? r.assetClass} · {r.exchange} · {r.currency}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#9c9484] bg-[#f0ead8] px-1.5 py-0.5 rounded ml-2 shrink-0">
                    {r.symbol}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* 검색 결과 없음 + 직접 입력 버튼 */}
          {!loading && query.length >= 2 && results.length === 0 && filteredExisting.length === 0 && (
            <div className="text-center py-3">
              <p className="text-xs text-[#9c9484]">검색 결과가 없습니다</p>
            </div>
          )}

          <div className="border-t border-[#f0ead8] mt-1 px-3 py-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setShowManual(true) }}
              className="text-xs text-[#9c9484] hover:text-[#1c6b4a] transition-colors"
            >
              + 직접 입력하기
            </button>
          </div>
        </div>
      )}

      {showManual && (
        <ManualForm
          onSelect={pick}
          onCancel={() => setShowManual(false)}
        />
      )}
    </div>
  )
}
