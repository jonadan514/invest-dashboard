import { NextResponse } from 'next/server'
import { getHouseholdContext } from '@/lib/supabase/server'

interface BackupPayload {
  format: string
  version: number
  tables: Record<string, unknown>
}

const CONFIG = [
  { table: 'accounts', conflict: 'id', columns: ['id','name','broker','owner','type','base_currency','tax_benefit','is_emergency_fund','sort_order','is_active','interest_rate','monthly_payment','maturity_date','created_at'] },
  { table: 'assets', conflict: 'id', columns: ['id','symbol','name','asset_class','currency','market','price_source','is_active'] },
  { table: 'transactions', conflict: 'id', columns: ['id','date','account_id','asset_id','type','quantity','price','amount','fee','tax','fx_rate','currency','created_at'] },
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

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 10_000_000) return NextResponse.json({ error: '백업 파일은 10MB 이하여야 합니다.' }, { status: 413 })
  const text = await request.text()
  if (text.length > 10_000_000) return NextResponse.json({ error: '백업 파일은 10MB 이하여야 합니다.' }, { status: 413 })

  let payload: BackupPayload
  try {
    payload = JSON.parse(text) as BackupPayload
  } catch {
    return NextResponse.json({ error: '올바른 JSON 백업 파일이 아닙니다.' }, { status: 400 })
  }
  if (payload.format !== 'invest-dashboard-backup' || payload.version !== 1 || !payload.tables || Array.isArray(payload.tables)) {
    return NextResponse.json({ error: '지원하지 않는 백업 파일 형식입니다.' }, { status: 400 })
  }

  const { supabase, userId } = await getHouseholdContext()
  const operations: Array<{ table: string; rows: Record<string, unknown>[] }> = []
  let totalRows = 0
  for (const config of CONFIG) {
    const source = payload.tables[config.table]
    if (!Array.isArray(source) || source.length === 0) continue
    if (source.length > 10_000) return NextResponse.json({ error: `${config.table} 기록이 너무 많습니다.` }, { status: 400 })

    if (source.some(value => !value || typeof value !== 'object' || Array.isArray(value))) {
      return NextResponse.json({ error: `${config.table} 기록 형식이 올바르지 않습니다.` }, { status: 400 })
    }
    const rows = source.map(value => {
      const input = value as Record<string, unknown>
      const row: Record<string, unknown> = { user_id: userId }
      for (const column of config.columns) {
        if (column in input) row[column] = input[column]
      }
      if (config.table === 'net_worth_snapshots' && !row.source) row.source = 'manual'
      return row
    })
    totalRows += rows.length
    if (totalRows > 50_000) return NextResponse.json({ error: '전체 백업 기록이 너무 많습니다.' }, { status: 400 })
    operations.push({ table: config.table, rows })
  }

  const { data: imported, error } = await supabase.rpc('restore_household_backup', {
    p_user_id: userId,
    p_operations: operations,
  })
  if (error) return NextResponse.json({ error: `복원 실패: ${error.message}` }, { status: 400 })
  return NextResponse.json({ imported: Number(imported ?? 0) })
}
