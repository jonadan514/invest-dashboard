import { NextResponse } from 'next/server'
import { getHouseholdContext } from '@/lib/supabase/server'

const TABLES = [
  'accounts',
  'assets',
  'transactions',
  'balances',
  'monthly_budgets',
  'account_monthly_snapshots',
  'financial_plan_settings',
  'net_worth_items',
  'net_worth_snapshots',
  'portfolio_snapshots',
  'household_settings',
  'household_goals',
  'children',
  'child_accounts',
  'child_gift_deposits',
  'child_account_monthly_snapshots',
] as const

export async function GET() {
  const { supabase, userId } = await getHouseholdContext()
  const results = await Promise.all(TABLES.map(table => supabase.from(table).select('*').eq('user_id', userId).throwOnError()))
  const tables: Record<string, unknown[]> = {}

  for (let index = 0; index < TABLES.length; index += 1) {
    const result = results[index]
    tables[TABLES[index]] = result.data ?? []
  }

  const payload = {
    format: 'invest-dashboard-backup',
    version: 1,
    generated_at: new Date().toISOString(),
    tables,
  }
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="invest-dashboard-backup-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
