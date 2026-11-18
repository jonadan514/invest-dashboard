export const ASSET_CATEGORIES = [
  ['real_estate', '부동산'],
  ['deposit', '전월세 보증금'],
  ['vehicle', '차량'],
  ['other_asset', '기타 자산'],
] as const

export const LIABILITY_CATEGORIES = [
  ['mortgage', '주택담보대출'],
  ['credit_loan', '신용대출'],
  ['lease', '임대보증금·리스'],
  ['card', '카드 미결제금'],
  ['other_liability', '기타 부채'],
] as const

export const CATEGORY_LABEL = Object.fromEntries([
  ['cash', '현금·비상금'],
  ['savings', '예·적금'],
  ...ASSET_CATEGORIES,
  ...LIABILITY_CATEGORIES,
]) as Record<string, string>

export const OWNER_LABEL: Record<string, string> = { household: '공동', me: '나', spouse: '아내' }
