import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import EditForm from '../EditForm'

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tx } = await supabase
    .from('transactions')
    .select('*, accounts(name, owner), assets(name, symbol)')
    .eq('id', id)
    .single()

  if (!tx) notFound()

  return (
    <AppShell>
      <div className="p-6 max-w-lg">
        <h1 className="text-lg font-bold text-[#34322b] mb-6">거래 수정</h1>
        <div className="bg-[#faf6ec] border border-[#e3d9c4] rounded-2xl p-5">
          <EditForm tx={tx} />
        </div>
      </div>
    </AppShell>
  )
}
