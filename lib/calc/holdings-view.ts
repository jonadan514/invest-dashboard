import type { Holding } from '../types.ts'

export type HoldingSort = 'value' | 'return' | 'pnl' | 'name'
export type HoldingFilter = 'all' | 'gain' | 'loss'

export const HOLDING_SORTS: readonly HoldingSort[] = ['value', 'return', 'pnl', 'name']
export const HOLDING_FILTERS: readonly HoldingFilter[] = ['all', 'gain', 'loss']

export function parseSort(value: string | undefined): HoldingSort {
  return HOLDING_SORTS.find(item => item === value) ?? 'value'
}

export function parseFilter(value: string | undefined): HoldingFilter {
  return HOLDING_FILTERS.find(item => item === value) ?? 'all'
}

/** 구분(assetClass)·손익 필터를 적용하고 정렬한다. 현재가가 없는 종목은 숫자 정렬에서 맨 뒤로 보낸다. */
export function viewHoldings(
  holdings: Holding[],
  options: { sort?: HoldingSort; filter?: HoldingFilter; assetClass?: string | null },
): Holding[] {
  const { sort = 'value', filter = 'all', assetClass = null } = options
  const rows = holdings.filter(holding => {
    if (assetClass && holding.asset_class !== assetClass) return false
    if (filter === 'gain') return (holding.unrealized_pnl_krw ?? 0) > 0
    if (filter === 'loss') return (holding.unrealized_pnl_krw ?? 0) < 0
    return true
  })
  const metric = (holding: Holding): number | null => {
    if (sort === 'return') return holding.unrealized_pnl_pct
    if (sort === 'pnl') return holding.unrealized_pnl_krw
    return holding.market_value_krw
  }
  return rows.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ko')
    const av = metric(a)
    const bv = metric(b)
    if (av === null && bv === null) return a.name.localeCompare(b.name, 'ko')
    if (av === null) return 1
    if (bv === null) return -1
    return bv - av
  })
}

export interface ReturnGroup {
  key: string
  cost: number
  value: number
  pnl: number
  rate: number | null
  count: number
}

/** 현재가가 있는 종목만 모아 구분별·종목별 수익률 요약을 만든다. */
export function summarizeReturns(holdings: Holding[], groupOf: (holding: Holding) => string) {
  const priced = holdings.filter(holding => holding.market_value_krw !== null)
  const groups = new Map<string, ReturnGroup>()
  for (const holding of priced) {
    const key = groupOf(holding)
    const group = groups.get(key) ?? { key, cost: 0, value: 0, pnl: 0, rate: null, count: 0 }
    group.cost += holding.total_cost_krw
    group.value += holding.market_value_krw!
    group.count += 1
    groups.set(key, group)
  }
  const byGroup = [...groups.values()].map(group => {
    const pnl = group.value - group.cost
    return { ...group, pnl, rate: group.cost > 0 ? pnl / group.cost * 100 : null }
  }).sort((a, b) => b.value - a.value)
  const ranked = priced.filter(holding => holding.unrealized_pnl_pct !== null)
    .sort((a, b) => b.unrealized_pnl_pct! - a.unrealized_pnl_pct!)
  return {
    byGroup,
    best: ranked.length > 0 ? ranked[0] : null,
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
  }
}

export interface AllocationSlice {
  key: string
  label: string
  value: number
  /** 전체 대비 비중(0~100). */
  share: number
  cost: number
  pnl: number
  rate: number | null
  count: number
}

/** 현재가가 있는 종목의 평가금액을 묶음(계좌·구분 등)별 비중으로 나눈다. */
export function allocate(holdings: Holding[], keyOf: (holding: Holding) => string, labelOf: (holding: Holding) => string): AllocationSlice[] {
  const map = new Map<string, AllocationSlice>()
  for (const holding of holdings) {
    if (holding.market_value_krw === null) continue
    const key = keyOf(holding)
    const slice = map.get(key) ?? { key, label: labelOf(holding), value: 0, share: 0, cost: 0, pnl: 0, rate: null, count: 0 }
    slice.value += holding.market_value_krw
    slice.cost += holding.total_cost_krw
    slice.count += 1
    map.set(key, slice)
  }
  const total = [...map.values()].reduce((sum, slice) => sum + slice.value, 0)
  return [...map.values()].map(slice => {
    const pnl = slice.value - slice.cost
    return { ...slice, share: total > 0 ? slice.value / total * 100 : 0, pnl, rate: slice.cost > 0 ? pnl / slice.cost * 100 : null }
  }).sort((a, b) => b.value - a.value)
}
