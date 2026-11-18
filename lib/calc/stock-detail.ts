export interface LedgerTx {
  id: string
  date: string
  created_at?: string | null
  account_id: string
  type: string
  quantity: number | null
  amount: number | null
}

export type LedgerRow<T extends LedgerTx> = T & { runningQuantity: number | null }

/** 한 종목의 거래를 날짜 순으로 훑어 거래 뒤 보유 수량(계좌 합계)을 붙이고, 최신순으로 돌려준다. 배당은 수량이 없다. */
export function tradeLedger<T extends LedgerTx>(rows: T[]): LedgerRow<T>[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  let held = 0
  const result = sorted.map(row => {
    if (row.type === 'buy') held += Number(row.quantity ?? 0)
    else if (row.type === 'sell') held = Math.max(0, held - Number(row.quantity ?? 0))
    return { ...row, runningQuantity: row.type === 'buy' || row.type === 'sell' ? held : null }
  })
  return result.reverse()
}
