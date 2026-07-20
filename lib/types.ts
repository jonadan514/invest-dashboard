export type OwnerType = 'me' | 'spouse'
export type AccountType = 'general' | 'pension' | 'irp' | 'isa' | 'crypto' | 'savings'
export type AssetClass = 'kr_stock' | 'us_stock' | 'etf_kr' | 'etf_us' | 'crypto' | 'deposit' | 'other'
export type TxType = 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdraw' | 'interest' | 'fee'

export interface Account {
  id: string
  name: string
  broker: string | null
  owner: OwnerType
  type: AccountType
  base_currency: string
  tax_benefit: boolean
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Asset {
  id: string
  symbol: string | null
  name: string
  asset_class: AssetClass
  currency: string
  market: string | null
  is_active: boolean
}

export interface Transaction {
  id: string
  date: string
  account_id: string
  asset_id: string | null
  type: TxType
  quantity: number | null
  price: number | null
  amount: number | null
  fee: number
  tax: number
  fx_rate: number
  currency: string
  memo: string | null
  created_at: string
  accounts?: { name: string; owner: OwnerType }
  assets?: { name: string; symbol: string | null; asset_class: AssetClass }
}

export interface Holding {
  asset_id: string
  symbol: string | null
  name: string
  asset_class: AssetClass
  currency: string           // 자산 원화폐 (KRW / USD)
  account_id: string
  account_name: string
  owner: OwnerType
  quantity: number
  avg_cost: number           // 이동평균 원가 (원화폐 기준)
  total_cost: number         // 원화폐 기준 투자원금
  total_cost_krw: number     // KRW 환산 투자원금
  current_price: number | null
  prev_close: number | null
  market_value_krw: number | null  // KRW 환산 평가금액
  unrealized_pnl_krw: number | null
  unrealized_pnl_pct: number | null
  fx_rate: number            // 적용 환율 (KRW 자산=1)
}
