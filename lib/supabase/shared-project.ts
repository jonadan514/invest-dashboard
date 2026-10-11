// Extra investment objects use their own names in the shared database.
const CORE_TABLES = new Set(['accounts', 'assets', 'transactions', 'prices', 'fx_rates', 'balances'])
const APP_TABLES = new Set([
  'monthly_budgets', 'financial_plan_settings', 'net_worth_items', 'net_worth_snapshots',
  'portfolio_snapshots', 'household_settings', 'household_goals', 'account_monthly_snapshots',
  'children', 'child_accounts', 'child_gift_deposits', 'child_account_monthly_snapshots',
])
const APP_FUNCTIONS = new Set([
  'dashboard_access_retry_after', 'record_dashboard_access_failure', 'clear_dashboard_access_failures',
  'save_household_monthly_record', 'restore_household_backup',
])

export function isSharedInvestmentProject(url: string) {
  return new URL(url).hostname === 'njigeztkkeuvfltqtrad.supabase.co'
}

export function investmentTable(name: string, shared: boolean) {
  if (CORE_TABLES.has(name)) return name
  if (APP_TABLES.has(name)) return shared ? `invest_${name}` : name
  throw new Error(`투자 앱에서 허용하지 않는 테이블입니다: ${name}`)
}

export function investmentFunction(name: string, shared: boolean) {
  if (APP_FUNCTIONS.has(name)) return shared ? `invest_${name}` : name
  throw new Error(`투자 앱에서 허용하지 않는 함수입니다: ${name}`)
}
