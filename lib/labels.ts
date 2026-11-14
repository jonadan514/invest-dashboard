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
