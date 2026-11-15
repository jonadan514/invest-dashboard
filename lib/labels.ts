export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  cash: '입출금·공동계좌', mmf: 'CMA·MMF', general: '주식·증권계좌', pension: '연금저축', irp: 'IRP',
  isa: 'ISA', crypto: '코인', savings: '예적금',
  debt: '대출/부채',
}

export function krw(n: number): string {
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n))
}

export function compactKrw(value: number) {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute >= 100_000_000) {
    const eok = absolute / 100_000_000
    return `${sign}${Number.isInteger(eok) ? eok.toFixed(0) : eok.toFixed(1)}억`
  }
  if (absolute >= 10_000) return `${sign}${Math.round(absolute / 10_000).toLocaleString('ko-KR')}만`
  return `${sign}${Math.round(absolute).toLocaleString('ko-KR')}원`
}

export function signedCompactKrw(value: number) {
  return `${value > 0 ? '+' : ''}${compactKrw(value)}`
}

export function formatMonth(month: string) {
  const [year, value] = month.split('-')
  return `${year}년 ${Number(value)}월`
}

/** 큰 금액을 억·만 단위로 읽기 쉽게: 536,700,000 → "5억 3,670만", 31,000,000 → "3,100만". 만 원 미만은 반올림한다. */
export function wonShort(value: number) {
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  if (Math.round(absolute) === 0) return '0원'
  if (absolute < 10_000) return `${sign}${Math.round(absolute).toLocaleString('ko-KR')}원`
  const rounded = Math.round(absolute / 10_000) // 만 원 단위
  const eok = Math.floor(rounded / 10_000)
  const man = rounded % 10_000
  if (eok === 0) return `${sign}${man.toLocaleString('ko-KR')}만`
  return `${sign}${eok.toLocaleString('ko-KR')}억${man > 0 ? ` ${man.toLocaleString('ko-KR')}만` : ''}`
}

export function signedWonShort(value: number) {
  return `${value > 0 ? '+' : ''}${wonShort(value)}`
}
