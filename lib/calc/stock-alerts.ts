import type { Holding } from '../types.ts'

export type AlertLevel = 'warn' | 'info'

export interface StockAlert {
  id: string
  level: AlertLevel
  title: string
  detail: string
  href: string
}

export interface AlertInput {
  holdings: Holding[]
  /** 종목별 현재가 갱신 시각(ISO). */
  priceAsOf: Map<string, string>
  usdKrw: number | null
  now: Date
  /** 계좌별 이번 달 월간 기록 평가액. */
  recorded?: Map<string, { name: string; amount: number }>
  staleDays?: number
  moveThresholdPct?: number
  gapThresholdPct?: number
}

const DAY = 24 * 60 * 60 * 1000

/** 주식 화면·홈에 띄울 알림. 급한 것(경고)이 앞에 온다. */
export function buildStockAlerts(input: AlertInput): StockAlert[] {
  const { holdings, priceAsOf, usdKrw, now, recorded, staleDays = 3, moveThresholdPct = 5, gapThresholdPct = 10 } = input
  const alerts: StockAlert[] = []
  if (holdings.length === 0) return alerts

  if (usdKrw === null && holdings.some(holding => holding.currency === 'USD')) {
    alerts.push({ id: 'fx-missing', level: 'warn', title: '원/달러 환율이 없어요', detail: '달러 종목 평가금액이 계산되지 않아요. 현재가 입력에서 환율을 넣어 주세요.', href: '/stocks?tab=prices' })
  }

  const missing = [...new Set(holdings.filter(holding => holding.current_price === null).map(holding => holding.name))]
  if (missing.length > 0) {
    alerts.push({ id: 'price-missing', level: 'warn', title: `현재가가 없는 종목 ${missing.length}개`, detail: `${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ' 외' : ''} — 평가금액에서 빠져 있어요.`, href: '/stocks?tab=prices' })
  }

  const stale = new Map<string, number>()
  for (const holding of holdings) {
    const asOf = priceAsOf.get(holding.asset_id)
    if (!asOf || holding.current_price === null) continue
    const age = Math.floor((now.getTime() - new Date(asOf).getTime()) / DAY)
    if (age >= staleDays) stale.set(holding.name, age)
  }
  if (stale.size > 0) {
    const oldest = Math.max(...stale.values())
    alerts.push({ id: 'price-stale', level: 'warn', title: `현재가가 ${oldest}일 넘게 갱신되지 않았어요`, detail: `${[...stale.keys()].slice(0, 3).join(', ')}${stale.size > 3 ? ' 외' : ''} — 자동 갱신이 실패했을 수 있어요.`, href: '/stocks?tab=prices' })
  }

  const movers = new Map<string, { name: string; pct: number }>()
  for (const holding of holdings) {
    if (holding.current_price === null || !holding.prev_close || holding.prev_close <= 0) continue
    const pct = (holding.current_price / holding.prev_close - 1) * 100
    if (Math.abs(pct) >= moveThresholdPct) movers.set(holding.asset_id, { name: holding.name, pct })
  }
  for (const [assetId, mover] of [...movers].sort((a, b) => Math.abs(b[1].pct) - Math.abs(a[1].pct)).slice(0, 3)) {
    alerts.push({ id: `move-${assetId}`, level: 'info', title: `${mover.name} 전일 대비 ${mover.pct > 0 ? '+' : ''}${mover.pct.toFixed(1)}%`, detail: `하루 변동이 ${moveThresholdPct}% 이상이에요.`, href: `/stocks/${assetId}` })
  }

  if (recorded) {
    const byAccount = new Map<string, { value: number; priced: boolean }>()
    for (const holding of holdings) {
      const entry = byAccount.get(holding.account_id) ?? { value: 0, priced: true }
      if (holding.market_value_krw === null) entry.priced = false
      else entry.value += holding.market_value_krw
      byAccount.set(holding.account_id, entry)
    }
    for (const [accountId, record] of recorded) {
      const entry = byAccount.get(accountId)
      if (!entry || !entry.priced || record.amount <= 0 || entry.value <= 0) continue
      const gap = (entry.value - record.amount) / record.amount * 100
      if (Math.abs(gap) >= gapThresholdPct) {
        alerts.push({ id: `gap-${accountId}`, level: 'info', title: `${record.name} 월간 기록과 ${Math.abs(gap).toFixed(0)}% 차이`, detail: '보유종목 평가액과 이번 달 기록 평가액이 달라요. 예수금이거나 기록이 오래됐을 수 있어요.', href: '/budget' })
      }
    }
  }
  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1))
}
