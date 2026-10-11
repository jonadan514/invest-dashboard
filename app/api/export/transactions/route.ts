import { NextResponse } from 'next/server'
import { getHouseholdContext } from '@/lib/supabase/server'
import type { Transaction } from '@/lib/types'

export async function GET() {
  const { supabase, userId } = await getHouseholdContext()

  const { data: txs } = await supabase
    .from('transactions')
    .select('*, accounts(name, owner, type), assets(name, symbol, asset_class)')
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })
    .throwOnError()

  const rows = (txs ?? []) as Transaction[]

  const headers = [
    'date', 'account_name', 'account_owner', 'account_type',
    'asset_name', 'symbol', 'asset_class',
    'type', 'quantity', 'price', 'amount', 'fee', 'tax', 'currency', 'fx_rate',
  ]

  function esc(v: unknown) {
    if (v == null) return '""'
    return `"${String(v).replace(/"/g, '""').replace(/\n/g, ' ')}"`
  }

  const csv = [
    headers.join(','),
    ...rows.map(r => [
      esc(r.date),
      esc(r.accounts?.name),
      esc(r.accounts?.owner),
      esc(r.accounts?.type),
      esc(r.assets?.name),
      esc(r.assets?.symbol),
      esc(r.assets?.asset_class),
      esc(r.type),
      esc(r.quantity),
      esc(r.price),
      esc(r.amount),
      esc(r.fee),
      esc(r.tax),
      esc(r.currency),
      esc(r.fx_rate),
    ].join(',')),
  ].join('\r\n')

  const today = new Date().toISOString().slice(0, 10)
  // BOM for Excel Korean encoding
  const bom = '﻿'

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions_${today}.csv"`,
    },
  })
}
