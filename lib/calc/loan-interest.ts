/** 'YYYY-MM' 달의 일수(윤달 포함). */
export function daysInMonth(month: string) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value, 0)).getUTCDate()
}

/** 일수 기준 이자: 잔액 × 연금리 × 그달 일수 ÷ 365 (원 단위 반올림). 은행 일반 관행대로 1년을 365일로 본다. */
export function dailyInterest(balance: number, annualRatePercent: number, month: string) {
  return Math.round(Math.max(balance, 0) * Math.max(annualRatePercent, 0) / 100 * daysInMonth(month) / 365)
}

/** 일수와 상관없는 기준 이자(잔액 × 연금리 ÷ 12). 월 상환액에서 정기 원금을 정할 때 쓴다. */
export function standardMonthlyInterest(balance: number, annualRatePercent: number) {
  return Math.round(Math.max(balance, 0) * Math.max(annualRatePercent, 0) / 100 / 12)
}
