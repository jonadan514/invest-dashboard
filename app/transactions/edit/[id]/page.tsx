import { notFound } from 'next/navigation'
import { getHouseholdContext } from '@/lib/supabase/server'
import EditForm from '../EditForm'

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { supabase, userId } = await getHouseholdContext()

  const { data: tx } = await supabase
    .from('transactions')
    .select('*, accounts(name, owner), assets(name, symbol, currency)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
    .throwOnError()

  if (!tx) notFound()

  return (
    <>
      <div className="page-container max-w-lg">
        <h1 className="page-title mb-6">거래 수정</h1>
        <div className="bg-[#ffffff] border border-[#d7e1eb] rounded-2xl p-5">
          <EditForm tx={tx} />
        </div>
      </div>
    </>
  )
}
