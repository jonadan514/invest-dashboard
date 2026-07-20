import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import TransactionForm from './TransactionForm'

export default async function NewTransactionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: accounts = [] }, { data: assets = [] }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, owner, type')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('assets')
      .select('id, name, symbol, asset_class, currency')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <AppShell>
      <div className="p-6 max-w-lg">
        <h1 className="text-lg font-bold text-[#34322b] mb-6">거래 입력</h1>
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5">
          <TransactionForm accounts={accounts ?? []} assets={assets ?? []} />
        </div>
      </div>
    </AppShell>
  )
}
