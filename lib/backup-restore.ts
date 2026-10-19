const CONFIG = [
  { table: 'accounts', conflict: 'id', columns: ['id','name','broker','owner','type','base_currency','tax_benefit','is_emergency_fund','sort_order','is_active','interest_rate','monthly_payment','maturity_date','inactive_from_month','activity_history','created_at'] },
  { table: 'assets', conflict: 'id', columns: ['id','symbol','name','asset_class','currency','market','price_source','is_active'] },
  { table: 'transactions', conflict: 'id', columns: ['id','date','account_id','asset_id','type','quantity','price','amount','fee','tax','fx_rate','currency','memo','created_at'] },
  { table: 'balances', conflict: 'id', columns: ['id','account_id','value','as_of','memo','created_at'] },
  { table: 'monthly_budgets', conflict: 'user_id,month', columns: ['id','month','joint_savings','bonus_total','bonus_to_plan','cash_balance','mortgage_interest','mortgage_principal','mortgage_extra_principal','memo','created_at','updated_at'] },
  { table: 'account_monthly_snapshots', conflict: 'user_id,account_id,month', columns: ['id','account_id','month','evaluation_amount','monthly_allocation','ytd_contribution','memo','created_at','updated_at'] },
  { table: 'financial_plan_settings', conflict: 'user_id', columns: ['monthly_fixed_cost','mortgage_interest','mortgage_principal','monthly_joint_contribution','current_emergency_fund','stage1_target','stage2_target','stage1_emergency_ratio','stage2_emergency_ratio','stage2_investment_ratio','completed_investment_ratio','completed_property_ratio','created_at','updated_at'] },
  { table: 'net_worth_items', conflict: 'id', columns: ['id','name','kind','category','owner','interest_rate','start_date','maturity_date','monthly_payment','inactive_from_month','sort_order','is_active','created_at','updated_at'] },
  { table: 'net_worth_snapshots', conflict: 'user_id,item_id,month', columns: ['id','item_id','month','amount','source','created_at','updated_at'] },
  { table: 'portfolio_snapshots', conflict: 'user_id,month', columns: ['id','month','amount','created_at','updated_at'] },
  { table: 'household_settings', conflict: 'user_id', columns: ['monthly_income','target_allocation','created_at','updated_at'] },
  { table: 'household_goals', conflict: 'id', columns: ['id','name','statement','sub','type','target','next_hint','sort_order','achieved_at','created_at','updated_at'] },
  { table: 'children', conflict: 'id', columns: ['id','name','birth_date','account_name','memo','is_active','created_at','updated_at'] },
  { table: 'child_accounts', conflict: 'id', columns: ['id','child_id','name','asset_type','is_active','created_at','updated_at'] },
  { table: 'child_gift_deposits', conflict: 'id', columns: ['id','child_id','gift_date','amount','donor','donor_name','relationship_category','transfer_type','child_account_id','account_name','memo','created_at','updated_at'] },
  { table: 'child_account_monthly_snapshots', conflict: 'user_id,account_id,month', columns: ['id','account_id','month','evaluation_amount','memo','created_at','updated_at'] },
] as const

function normalizeAccountActivity(row: Record<string, unknown>, currentMonth: string) {
  const validMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
  if (row.inactive_from_month != null && !validMonth(row.inactive_from_month)) {
    throw new Error('accounts 비활성화 월 형식이 올바르지 않습니다.')
  }
  const history = row.activity_history
  if (history != null && (!Array.isArray(history) || history.some(event =>
    !event || typeof event !== 'object' || Array.isArray(event)
    || !validMonth(event.month) || typeof event.active !== 'boolean'))) {
    throw new Error('accounts 활성화 이력 형식이 올바르지 않습니다.')
  }
  if (row.inactive_from_month == null) {
    const lastEvent = Array.isArray(history) ? [...history].sort((a, b) => a.month.localeCompare(b.month)).at(-1) : null
    row.inactive_from_month = row.is_active === false
      ? lastEvent?.active === false ? lastEvent.month : currentMonth
      : null
  }
  // jsonb_populate_recordset supplies NULL for absent fields, bypassing SQL defaults.
  // Older backups need the same legacy closure boundary as the schema migration.
  if (history == null) {
    row.activity_history = row.inactive_from_month
      ? [{ month: row.inactive_from_month, active: false }]
      : []
  }
}

export function buildBackupOperations(tables: Record<string, unknown>, userId: string, now = new Date()) {
  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'Asia/Seoul',
  }).format(now)
  const operations: Array<{ table: string; rows: Record<string, unknown>[] }> = []
  let totalRows = 0
  for (const config of CONFIG) {
    const source = tables[config.table]
    if (!Array.isArray(source) || source.length === 0) continue
    if (source.length > 10_000) throw new Error(`${config.table} 기록이 너무 많습니다.`)

    if (source.some(value => !value || typeof value !== 'object' || Array.isArray(value))) {
      throw new Error(`${config.table} 기록 형식이 올바르지 않습니다.`)
    }
    const rows = source.map(value => {
      const input = value as Record<string, unknown>
      const row: Record<string, unknown> = { user_id: userId }
      for (const column of config.columns) {
        if (column in input) row[column] = input[column]
      }
      if (config.table === 'accounts') normalizeAccountActivity(row, currentMonth)
      if (config.table === 'net_worth_snapshots' && !row.source) row.source = 'manual'
      return row
    })
    totalRows += rows.length
    if (totalRows > 50_000) throw new Error('전체 백업 기록이 너무 많습니다.')
    operations.push({ table: config.table, rows })
  }

  return operations
}
