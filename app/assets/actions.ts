'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateAssetSymbol(id: string, symbol: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('assets')
    .update({ symbol: symbol.trim() || null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/assets')
  revalidatePath('/holdings')
}

export async function deleteAsset(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('assets').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/assets')
  revalidatePath('/holdings')
}
