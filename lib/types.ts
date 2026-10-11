export type OwnerType = 'me' | 'spouse'

export type ChildGiftDonor = 'parents' | 'me' | 'spouse' | 'grandparents' | 'other_relative' | 'non_relative'
export type ChildGiftRelationship = 'direct_ascendant' | 'other_relative' | 'non_relative'
export type ChildGiftTransferType = 'gift' | 'living_education' | 'customary'
export type ChildAccountAssetType = 'cash' | 'investment'

export interface ChildProfile {
  id: string
  user_id: string
  name: string
  birth_date: string
  account_name: string | null
  memo: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChildGiftDeposit {
  id: string
  user_id: string
  child_id: string
  gift_date: string
  amount: number
  donor: ChildGiftDonor
  donor_name: string | null
  relationship_category: ChildGiftRelationship
  transfer_type: ChildGiftTransferType
  child_account_id: string | null
  account_name: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface ChildAccount {
  id: string
  user_id: string
  child_id: string
  name: string
  asset_type: ChildAccountAssetType
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChildAccountMonthlySnapshot {
  id: string
  user_id: string
  account_id: string
  month: string
  evaluation_amount: number
  memo: string | null
  created_at: string
  updated_at: string
}
export type AccountType = 'cash' | 'mmf' | 'general' | 'pension' | 'irp' | 'isa' | 'crypto' | 'savings' | 'debt'
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
  is_emergency_fund: boolean
  sort_order: number
  is_active: boolean
  interest_rate: number | null
  monthly_payment: number | null
  maturity_date: string | null
  created_at: string
}

export interface PortfolioSnapshot {
  id: string
  user_id: string
  month: string
  amount: number
  created_at: string
  updated_at: string
}

export interface AccountMonthlySnapshot {
  id: string
  user_id: string
  account_id: string
  month: string
  evaluation_amount: number
  monthly_allocation: number
  ytd_contribution: number
  memo: string | null
  created_at: string
  updated_at: string
}

export interface HouseholdSettings {
  user_id: string
  monthly_income: number
  target_allocation: Record<string, number>
  created_at: string
  updated_at: string
}

export interface HouseholdGoal {
  id: string
  user_id: string
  name: string
  statement: string
  sub: string
  type: 'cash' | 'investment' | 'net_worth' | 'other'
  target: number
  next_hint: string
  sort_order: number
  achieved_at: string | null
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  symbol: string | null
  name: string
  asset_class: AssetClass
  currency: string
  market: string | null
  price_source: 'kis' | 'finnhub' | 'upbit' | 'manual'
  is_active: boolean
}

export interface Balance {
  id: string
  account_id: string
  value: number
  as_of: string
  memo: string | null
  created_at: string
}

export interface MonthlyBudget {
  id: string
  user_id: string
  month: string
  joint_savings: number
  bonus_total: number
  bonus_to_plan: number
  cash_balance: number
  mortgage_interest: number
  mortgage_principal: number
  mortgage_extra_principal: number
  memo: string
  created_at: string
  updated_at: string
}

export interface FinancialPlanSettingsRow {
  user_id: string
  monthly_fixed_cost: number
  mortgage_interest: number
  mortgage_principal: number
  monthly_joint_contribution: number
  current_emergency_fund: number
  stage1_target: number
  stage2_target: number
  stage1_emergency_ratio: number
  stage2_emergency_ratio: number
  stage2_investment_ratio: number
  completed_investment_ratio: number
  completed_property_ratio: number
  created_at: string
  updated_at: string
}

export type NetWorthKind = 'asset' | 'liability'
export type NetWorthOwner = 'household' | OwnerType

export interface NetWorthItem {
  id: string
  user_id: string
  name: string
  kind: NetWorthKind
  category: string
  owner: NetWorthOwner
  interest_rate: number | null
  start_date: string | null
  maturity_date: string | null
  monthly_payment: number | null
  inactive_from_month: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NetWorthSnapshot {
  id: string
  user_id: string
  item_id: string
  month: string
  amount: number
  source: 'manual' | 'mortgage_auto'
  created_at: string
  updated_at: string
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
  created_at: string
  accounts?: { name: string; owner: OwnerType; type?: AccountType }
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
  avg_cost_krw: number       // 거래시점 환율을 반영한 원화 이동평균 원가
  total_cost: number         // 원화폐 기준 투자원금
  total_cost_krw: number     // KRW 환산 투자원금
  current_price: number | null
  prev_close: number | null
  market_value_krw: number | null  // KRW 환산 평가금액
  unrealized_pnl_krw: number | null
  unrealized_pnl_pct: number | null
  fx_rate: number            // 적용 환율 (KRW 자산=1)
}
