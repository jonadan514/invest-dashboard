'use client'
import { useEffect, useState } from 'react'

const CLASS_LABEL: Record<string, string> = {
  kr_stock: '국내주식', us_stock: '미국주식',
  etf_kr: '국내ETF', etf_us: '미국ETF',
  crypto: '코인', deposit: '예적금', other: '기타',
}

type ActualItem = { cls: string; pct: number }

export default function RebalancingAlert({ actual }: { actual: ActualItem[] }) {
  const [alerts, setAlerts] = useState<
    { cls: string; label: string; actual: number; target: number; diff: number }[]
  >([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('target_allocation')
      if (!raw) return
      const target = JSON.parse(raw) as Record<string, number>

      const out: typeof alerts = []
      for (const item of actual) {
        const t = target[item.cls] ?? 0
        const diff = item.pct - t
        if (Math.abs(diff) >= 5) {
          out.push({ cls: item.cls, label: CLASS_LABEL[item.cls] ?? item.cls, actual: item.pct, target: t, diff })
        }
      }
      setAlerts(out)
    } catch {}
  }, [actual])

  if (alerts.length === 0) return null

  return (
    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
      <div className="flex items-start gap-2">
        <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
        <div>
          <p className="text-xs font-semibold text-amber-800 mb-1.5">리밸런싱 필요</p>
          <div className="flex flex-wrap gap-1.5">
            {alerts.map(a => (
              <span
                key={a.cls}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  a.diff > 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {a.label} {a.actual.toFixed(1)}% / 목표 {a.target}%
                ({a.diff > 0 ? '+' : ''}{a.diff.toFixed(1)}%p)
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
