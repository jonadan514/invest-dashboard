/** 비중 그래프 색. 홈 자산 구성과 같은 계열. */
export const PALETTE = ['#284b7a', '#4ea57f', '#c4a46b', '#78a8d6', '#a3587a', '#8aa59a', '#becbda'] as const
export const colorAt = (index: number) => PALETTE[index % PALETTE.length]

/** 종목 구분별 고정 색: 표의 구분 막대·비중 막대와 '종목 구분별' 도넛이 같은 색을 쓴다. */
export const CLASS_COLOR: Record<string, string> = {
  kr_stock: '#284b7a',
  etf_kr: '#4ea57f',
  us_stock: '#c4a46b',
  etf_us: '#78a8d6',
  other: '#8aa59a',
}
export const classColor = (assetClass: string) => CLASS_COLOR[assetClass] ?? '#becbda'
