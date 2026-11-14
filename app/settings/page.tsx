import { getHouseholdContext } from '@/lib/supabase/server'
import type { HouseholdGoal, HouseholdSettings } from '@/lib/types'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const { supabase, userId } = await getHouseholdContext()
  const [{ data: settingsRow }, { data: goalRows }] = await Promise.all([
    supabase.from('household_settings').select('*').eq('user_id', userId).maybeSingle().throwOnError(),
    supabase.from('household_goals').select('*').eq('user_id', userId).order('sort_order').order('created_at').throwOnError(),
  ])
  const settings = settingsRow as HouseholdSettings | null
  const goals = (goalRows ?? []) as HouseholdGoal[]
  const renderKey = `${settings?.updated_at ?? 'new'}-${goals.map(goal => goal.updated_at).join('-')}`

  return (
    <>
      <div className="page-container max-w-3xl">
        <h1 className="page-title">설정</h1>
        <p className="page-subtitle mb-6">가계 목표, 월 소득과 전체 데이터 백업을 관리합니다.</p>
        <SettingsClient
          key={renderKey}
          initialSettings={{
            monthlyIncome: Number(settings?.monthly_income ?? 0),
          }}
          initialGoals={goals}
          canImportLegacy={!settings && goals.length === 0}
        />
      </div>
    </>
  )
}
