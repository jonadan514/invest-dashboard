export interface FinancialPlanSettings {
  monthlyFixedCost: number
  mortgageInterest: number
  mortgagePrincipal: number
  monthlyJointContribution: number
  currentEmergencyFund: number
  stage1Target: number
  stage2Target: number
  stage2EmergencyRatio: number
  stage2InvestmentRatio: number
  completedInvestmentRatio: number
  completedPropertyRatio: number
}

export const DEFAULT_FINANCIAL_PLAN: FinancialPlanSettings = {
  monthlyFixedCost: 3_700_000,
  mortgageInterest: 2_500_000,
  mortgagePrincipal: 450_000,
  monthlyJointContribution: 7_000_000,
  currentEmergencyFund: 13_000_000,
  stage1Target: 30_000_000,
  stage2Target: 50_000_000,
  stage2EmergencyRatio: 0.8,
  stage2InvestmentRatio: 0.2,
  completedInvestmentRatio: 0.5,
  completedPropertyRatio: 0.5,
}

export interface AllocationInput {
  jointContribution: number
  bonusToPlan: number
  emergencyFund: number
}

export interface AllocationResult {
  phase: 1 | 2 | 3
  regularSurplus: number
  totalAllocatable: number
  emergencyFund: number
  investmentAssets: number
  propertyFund: number
  expectedEmergencyFund: number
  remainingToStage1: number
  remainingToStage2: number
}

export function getPlanPhase(
  emergencyFund: number,
  settings: FinancialPlanSettings,
): 1 | 2 | 3 {
  if (emergencyFund < settings.stage1Target) return 1
  if (emergencyFund < settings.stage2Target) return 2
  return 3
}

export function calcAllocation(
  input: AllocationInput,
  settings: FinancialPlanSettings,
): AllocationResult {
  const regularSurplus = Math.max(
    input.jointContribution - settings.monthlyFixedCost,
    0,
  )
  const totalAllocatable = regularSurplus + Math.max(input.bonusToPlan, 0)
  const phase = getPlanPhase(input.emergencyFund, settings)
  let remaining = totalAllocatable
  let expectedEmergencyFund = Math.max(0, input.emergencyFund)
  let emergencyFund = 0
  let investmentAssets = 0
  let propertyFund = 0

  // 1단계: 3천만 원까지 배분 가능액 전부를 비상금으로 보낸다.
  if (remaining > 0 && expectedEmergencyFund < settings.stage1Target) {
    const stage1Amount = Math.min(
      remaining,
      settings.stage1Target - expectedEmergencyFund,
    )
    emergencyFund += stage1Amount
    expectedEmergencyFund += stage1Amount
    remaining -= stage1Amount
  }

  // 2단계: 5천만 원까지 비상금 80%, 투자자산 20%로 배분한다.
  if (remaining > 0 && expectedEmergencyFund < settings.stage2Target) {
    const emergencyRatio = settings.stage2EmergencyRatio
    const emergencyShortfall = settings.stage2Target - expectedEmergencyFund
    const amountToCompleteStage = emergencyRatio > 0
      ? emergencyShortfall / emergencyRatio
      : Number.POSITIVE_INFINITY
    const stage2Amount = Math.min(remaining, amountToCompleteStage)

    const stage2Emergency = stage2Amount * emergencyRatio
    emergencyFund += stage2Emergency
    investmentAssets += stage2Amount * settings.stage2InvestmentRatio
    expectedEmergencyFund += stage2Emergency
    remaining -= stage2Amount
  }

  // 비상금 5천만 원 완료 후: 투자자산과 부동산 비용을 절반씩 적립한다.
  if (remaining > 0) {
    investmentAssets += remaining * settings.completedInvestmentRatio
    propertyFund += remaining * settings.completedPropertyRatio
  }

  return {
    phase,
    regularSurplus,
    totalAllocatable,
    emergencyFund,
    investmentAssets,
    propertyFund,
    expectedEmergencyFund,
    remainingToStage1: Math.max(settings.stage1Target - expectedEmergencyFund, 0),
    remainingToStage2: Math.max(settings.stage2Target - expectedEmergencyFund, 0),
  }
}
