import 'server-only'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { connection } from 'next/server'
import { requireHouseholdAccess } from '@/lib/access/server'
import { investmentTable, investmentFunction, isSharedInvestmentProject } from './shared-project'

type InvestmentClient = Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>

let cachedClient: InvestmentClient | null = null
let cachedHouseholdUserId: string | null = null

export function createClient(): InvestmentClient {
  if (cachedClient) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !secretKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SECRET_KEY를 .env.local에 설정해 주세요.',
    )
  }

  const client = createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  const shared = isSharedInvestmentProject(url)
  cachedClient = {
    auth: client.auth,
    from: ((name: string) => client.from(investmentTable(name, shared))) as SupabaseClient['from'],
    rpc: ((...args: Parameters<SupabaseClient['rpc']>) =>
      client.rpc(investmentFunction(args[0], shared), args[1], args[2])) as SupabaseClient['rpc'],
  }
  return cachedClient
}

async function resolveHouseholdUserId(supabase: InvestmentClient): Promise<string> {
  if (cachedHouseholdUserId) return cachedHouseholdUserId

  const configuredId = process.env.SUPABASE_HOUSEHOLD_USER_ID
  if (configuredId) {
    cachedHouseholdUserId = configuredId
    return configuredId
  }

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 2 })
  if (error) throw new Error(`가구 사용자 확인 실패: ${error.message}`)
  if (data.users.length !== 1) {
    throw new Error(
      'Supabase 사용자가 여러 명입니다. SUPABASE_HOUSEHOLD_USER_ID를 .env.local에 설정해 주세요.',
    )
  }

  cachedHouseholdUserId = data.users[0].id
  return cachedHouseholdUserId
}

export async function getHouseholdContext() {
  await requireHouseholdAccess()
  await connection()
  const supabase = createClient()
  const userId = await resolveHouseholdUserId(supabase)
  return { supabase, userId }
}
