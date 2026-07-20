/**
 * XIRR — 현금흐름 기반 연간 내부수익률
 * amount < 0 = 매수/입금(돈이 나감), amount > 0 = 매도/배당/출금(돈이 들어옴)
 */
export interface CashFlow {
  amount: number
  date: Date
}

function computeNpv(cfs: CashFlow[], rate: number): number {
  const t0 = cfs[0].date.getTime()
  return cfs.reduce((sum, cf) => {
    const t = (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000)
    return sum + cf.amount / Math.pow(1 + rate, t)
  }, 0)
}

function computeDerivative(cfs: CashFlow[], rate: number): number {
  const t0 = cfs[0].date.getTime()
  return cfs.reduce((sum, cf) => {
    const t = (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000)
    if (t === 0) return sum
    return sum - (t * cf.amount) / Math.pow(1 + rate, t + 1)
  }, 0)
}

export function calcXirr(cashflows: CashFlow[]): number | null {
  if (cashflows.length < 2) return null

  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime())

  // 양수 + 음수 CF가 모두 있어야 해법 존재
  if (!sorted.some(c => c.amount > 0) || !sorted.some(c => c.amount < 0)) return null

  // Newton-Raphson으로 수렴
  let rate = 0.1
  for (let i = 0; i < 300; i++) {
    const f = computeNpv(sorted, rate)
    const df = computeDerivative(sorted, rate)
    if (Math.abs(df) < 1e-12) break
    const next = rate - f / df
    if (!isFinite(next) || next <= -1) {
      rate = rate / 2  // 발산 시 step 줄이기
      continue
    }
    if (Math.abs(next - rate) < 1e-10) return next
    rate = next
  }
  return null
}

/**
 * 투자 거래 목록으로 XIRR 현금흐름 배열 생성
 * - buy/deposit → 음수 (돈 나감)
 * - sell/withdraw/dividend/interest → 양수 (돈 들어옴)
 * - finalValueKrw → 오늘 날짜 기준 포트폴리오 평가금액 (양수)
 */
export function buildXirrCashflows(
  transactions: Array<{
    date: string
    type: string
    amount: number | null
    currency: string
  }>,
  finalValueKrw: number,
  usdKrw = 1,
): CashFlow[] {
  const cfs: CashFlow[] = []

  for (const tx of transactions) {
    const raw = tx.amount ?? 0
    if (raw <= 0) continue
    const krw = tx.currency === 'USD' ? raw * usdKrw : raw

    let sign = 0
    if (tx.type === 'buy' || tx.type === 'deposit') sign = -1
    else if (tx.type === 'sell' || tx.type === 'withdraw' || tx.type === 'dividend' || tx.type === 'interest') sign = 1

    if (sign === 0) continue
    cfs.push({ amount: sign * krw, date: new Date(tx.date) })
  }

  if (finalValueKrw > 0) {
    cfs.push({ amount: finalValueKrw, date: new Date() })
  }

  return cfs
}
