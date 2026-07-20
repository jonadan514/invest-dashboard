'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateMemo(id: string, memo: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ memo: memo.trim() || null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/journal')
}
