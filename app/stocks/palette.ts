/** 비중 그래프 색. 홈 자산 구성과 같은 계열. */
export const PALETTE = ['#284b7a', '#4ea57f', '#c4a46b', '#78a8d6', '#a3587a', '#8aa59a', '#becbda'] as const
export const colorAt = (index: number) => PALETTE[index % PALETTE.length]
