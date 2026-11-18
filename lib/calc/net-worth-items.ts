export interface AutoCheckItem {
  category: string
  interest_rate: number | null
  monthly_payment: number | null
  maturity_date: string | null
}

/** 잔액이 매달 자동으로 줄어드는 항목: 금리와 월 상환액(또는 만기)이 있는 주택담보대출. */
export function isAutoMortgage(item: AutoCheckItem) {
  return item.category === 'mortgage' && item.interest_rate != null && (item.monthly_payment != null || Boolean(item.maturity_date))
}

/**
 * 월말 기록 폼에서 저장할 잔액만 골라낸다. 폼에 있는 항목(amount_<id>)만 저장하고 없는 항목은 건드리지 않는다.
 * 자동 상환 항목은 '바로잡기'로 입력칸을 연 경우에만 폼에 들어온다.
 */
export function pickBalances(itemIds: string[], read: (name: string) => string | null) {
  const rows: { item_id: string; amount: number }[] = []
  for (const id of itemIds) {
    const value = read(`amount_${id}`)
    if (value === null) continue
    const raw = value.replace(/,/g, '').trim()
    if (!raw) throw new Error('금액을 입력해 주세요. 비워 둘 항목은 입력칸을 닫아 주세요.')
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('금액은 0 이상의 숫자로 입력해 주세요.')
    rows.push({ item_id: id, amount })
  }
  return rows
}
