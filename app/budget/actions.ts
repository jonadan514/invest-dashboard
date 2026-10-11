'use server'

import { revalidatePath } from 'next/cache'
import { getHouseholdContext } from '@/lib/supabase/server'
import { DEFAULT_FINANCIAL_PLAN } from '@/lib/calc/budget'

function numberField(formData: FormData, name: string) {
  const value = Number(formData.get(name) ?? 0)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} 값이 올바르지 않습니다.`)
  return value
}

export async function saveBudgetEntry(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const month = String(formData.get('month') ?? '')
  const jointSavings = numberField(formData, 'joint_savings')
  const bonusTotal = numberField(formData, 'bonus_total')
  const bonusToPlan = numberField(formData, 'bonus_to_plan')
  let cashBalance = numberField(formData, 'cash_balance')
  const mortgageInterest = numberField(formData, 'mortgage_interest')
  const mortgagePrincipal = numberField(formData, 'mortgage_principal')
  const mortgageExtraPrincipal = numberField(formData, 'mortgage_extra_principal')

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('월 형식이 올바르지 않습니다.')
  if (bonusToPlan > bonusTotal) throw new Error('배분할 성과급은 전체 성과급보다 클 수 없습니다.')

  const [{ data: accounts, error: accountError }, { data: plan, error: planError }] = await Promise.all([
    supabase
    .from('accounts')
    .select('id, type, is_emergency_fund')
    .eq('user_id', userId)
    .eq('is_active', true),
    supabase.from('financial_plan_settings').select('monthly_fixed_cost').eq('user_id', userId).maybeSingle(),
  ])
  if (accountError) throw new Error(accountError.message)
  if (planError) throw new Error(planError.message)

  const monthlyFixedCost = Number(plan?.monthly_fixed_cost ?? DEFAULT_FINANCIAL_PLAN.monthlyFixedCost)
  const totalAllocatable = Math.max(jointSavings - monthlyFixedCost, 0) + bonusToPlan
  const allocationTotal = (accounts ?? []).reduce(
    (sum, account) => sum + numberField(formData, `account_${account.id}_allocation`),
    0,
  )
  if (allocationTotal > totalAllocatable) {
    throw new Error('계좌 배분액 합계가 이달 배분 가능액을 초과합니다.')
  }

  const accountRows = (accounts ?? []).map(account => ({
    account_id: account.id,
    evaluation_amount: numberField(formData, `account_${account.id}_evaluation`),
    monthly_allocation: numberField(formData, `account_${account.id}_allocation`),
    ytd_contribution: account.type === 'pension' || account.type === 'irp'
      ? numberField(formData, `account_${account.id}_ytd`)
      : 0,
    memo: null,
  }))

  const emergencyRows = accountRows.filter(row => accounts?.find(account => account.id === row.account_id)?.is_emergency_fund)
  if (emergencyRows.length > 0) {
    cashBalance = emergencyRows.reduce((sum, row) => sum + row.evaluation_amount, 0)
  }

  const { error } = await supabase.rpc('save_household_monthly_record', {
    p_user_id: userId,
    p_month: month,
    p_budget: {
      joint_savings: jointSavings,
      bonus_total: bonusTotal,
      bonus_to_plan: bonusToPlan,
      cash_balance: cashBalance,
      mortgage_interest: mortgageInterest,
      mortgage_principal: mortgagePrincipal,
      mortgage_extra_principal: mortgageExtraPrincipal,
      memo: String(formData.get('memo') ?? '').trim(),
    },
    p_accounts: accountRows,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/budget')
  revalidatePath('/net-worth')
  revalidatePath('/pension')
  revalidatePath('/')
}

export async function saveFinancialPlanSettings(formData: FormData) {
  const { supabase, userId } = await getHouseholdContext()
  const stage1Target = numberField(formData, 'stage1_target')
  const stage2Target = numberField(formData, 'stage2_target')
  const stage2EmergencyRatio = numberField(formData, 'stage2_emergency_ratio') / 100
  const stage2InvestmentRatio = numberField(formData, 'stage2_investment_ratio') / 100
  const completedInvestmentRatio = numberField(formData, 'completed_investment_ratio') / 100
  const completedPropertyRatio = numberField(formData, 'completed_property_ratio') / 100

  if (stage1Target <= 0 || stage2Target <= stage1Target) {
    throw new Error('2단계 목표는 1단계 목표보다 커야 합니다.')
  }
  if (Math.abs(stage2EmergencyRatio + stage2InvestmentRatio - 1) > 0.0001) {
    throw new Error('2단계 배분 비율의 합은 100%여야 합니다.')
  }
  if (Math.abs(completedInvestmentRatio + completedPropertyRatio - 1) > 0.0001) {
    throw new Error('비상금 완료 후 배분 비율의 합은 100%여야 합니다.')
  }

  const { error } = await supabase.from('financial_plan_settings').upsert({
    user_id: userId,
    monthly_fixed_cost: numberField(formData, 'monthly_fixed_cost'),
    mortgage_interest: numberField(formData, 'mortgage_interest'),
    mortgage_principal: numberField(formData, 'mortgage_principal'),
    monthly_joint_contribution: numberField(formData, 'monthly_joint_contribution'),
    current_emergency_fund: numberField(formData, 'current_emergency_fund'),
    stage1_target: stage1Target,
    stage2_target: stage2Target,
    stage1_emergency_ratio: 1,
    stage2_emergency_ratio: stage2EmergencyRatio,
    stage2_investment_ratio: stage2InvestmentRatio,
    completed_investment_ratio: completedInvestmentRatio,
    completed_property_ratio: completedPropertyRatio,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/budget')
}
