import { getHouseholdContext } from '@/lib/supabase/server'
import TransactionForm from './TransactionForm'

export default async function NewTransactionPage() {
  const { supabase, userId } = await getHouseholdContext()

  const [{ data: accounts = [] }, { data: assets = [] }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, owner, type')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('sort_order').throwOnError(),
    supabase
      .from('assets')
      .select('id, name, symbol, asset_class, currency')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name').throwOnError(),
  ])

  return (
    <>
      <div className="page-container max-w-lg">
        <h1 className="page-title mb-6">거래 입력</h1>
        <div className="bg-[#ffffff] border border-[#d7e1eb] rounded-2xl p-5">
          <TransactionForm accounts={accounts ?? []} assets={assets ?? []} />
        </div>
      </div>
    </>
  )
}
