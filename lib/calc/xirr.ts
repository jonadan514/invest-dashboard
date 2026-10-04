/**
 * XIRR — 포트폴리오 외부 현금흐름 기반 연간 내부수익률
 *
 * 계좌 내부의 매수/매도/배당/이자는 포트폴리오 안에서 일어나는 이동이므로
 * 전체 포트폴리오 XIRR 현금흐름에서 제외한다.
 * amount < 0 = 외부에서 투자계좌로 들어온 돈(deposit)
 * amount > 0 = 투자계좌에서 외부로 빠져나간 돈(withdraw) 또는 최종 평가액
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
 * 투자 거래 목록으로 포트폴리오 XIRR 현금흐름 배열 생성
 * - deposit  → 음수: 외부 자금이 투자 포트폴리오로 유입
 * - withdraw → 양수: 투자 포트폴리오에서 외부로 유출
 * - buy/sell/dividend/interest/fee → 제외: 포트폴리오 내부 거래
 * - finalValueKrw → 오늘 날짜 기준 포트폴리오 평가금액 (양수)
 *
 * 거래 당시 KRW 환산액을 보존할 수 있도록 fx_rate를 우선 사용한다.
 * 기존 데이터에 fx_rate가 없을 때만 fallbackUsdKrw를 사용한다.
 */
export function buildXirrCashflows(
  transactions: Array<{
    date: string
    type: string
    amount: number | null
    currency: string
    fx_rate?: number | null
  }>,
  finalValueKrw: number,
  fallbackUsdKrw = 1,
): CashFlow[] {
  const cfs: CashFlow[] = []

  for (const tx of transactions) {
    if (tx.type !== 'deposit' && tx.type !== 'withdraw') continue

    const raw = Number(tx.amount ?? 0)
    if (raw <= 0) continue

    const fx =
      tx.currency === 'USD'
        ? Number(tx.fx_rate && tx.fx_rate > 0 ? tx.fx_rate : fallbackUsdKrw)
        : 1
    const krw = raw * fx

    cfs.push({
      amount: tx.type === 'deposit' ? -krw : krw,
      date: new Date(tx.date),
    })
  }

  if (finalValueKrw > 0) {
    cfs.push({ amount: finalValueKrw, date: new Date() })
  }

  return cfs
}
