/**
 * 원리금균등 대출의 은행 계산 방식(실제 납부 내역으로 검산함):
 * - 이자 = 납부 전 잔액 × 연금리 ÷ 12, 원 미만 버림. 달 일수와 상관없다.
 * - 월 상환액(원리금)은 고정이고, 원금 = 월 상환액 − 이자.
 */
export function monthlyInterest(balance: number, annualRatePercent: number) {
  // 1e-6은 부동소수 오차(예: 1,039,999.9999999)로 1원이 덜 잘리는 것을 막는다.
  return Math.floor(Math.max(balance, 0) * Math.max(annualRatePercent, 0) / 1200 + 1e-6)
}

/** from 달에서 to 달까지 개월 수('YYYY-MM'). to가 뒤면 양수. */
export function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/** 잔액·연금리·남은 회차로 원리금균등 월 상환액을 구한다(원 미만 버림). 회차가 없으면 null. */
export function levelPayment(balance: number, annualRatePercent: number, months: number) {
  if (!(balance > 0) || !(months > 0)) return null
  const rate = Math.max(annualRatePercent, 0) / 1200
  if (rate === 0) return Math.floor(balance / months)
  return Math.floor(balance * rate / (1 - Math.pow(1 + rate, -months)) + 1e-6)
}
