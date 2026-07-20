import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: txs } = await supabase
    .from('transactions')
    .select('*, accounts(name, owner, type), assets(name, symbol, asset_class)')
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  const rows = (txs ?? []) as any[]

  const headers = [
    'date', 'account_name', 'account_owner', 'account_type',
    'asset_name', 'symbol', 'asset_class',
    'type', 'quantity', 'price', 'amount', 'fee', 'tax', 'currency', 'fx_rate', 'memo',
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
      esc(r.memo),
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
