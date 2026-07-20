export interface BudgetRatios {
  stage1CashReserve: number    // default 0.85
  stage1FamilyExpense: number  // default 0.15
  stage2FamilyExpense: number  // default 0.15
  stage2GrowthCapital: number  // default 0.85
  growthMoveUp: number         // default 0.5
  growthInvestment: number     // default 0.5
}

export const DEFAULT_RATIOS: BudgetRatios = {
  stage1CashReserve: 0.85,
  stage1FamilyExpense: 0.15,
  stage2FamilyExpense: 0.15,
  stage2GrowthCapital: 0.85,
  growthMoveUp: 0.5,
  growthInvestment: 0.5,
}

export interface HouseholdSettings {
  monthlyLivingCost: number  // default 4_000_000
  cashTarget: number         // default 30_000_000
}

export const DEFAULT_HOUSEHOLD: HouseholdSettings = {
  monthlyLivingCost: 4_000_000,
  cashTarget: 30_000_000,
}

export interface AllocationInput {
  jointSavings: number
  bonusToPlan: number
  cashBalance: number
}

export interface AllocationResult {
  stage: 1 | 2
  totalAllocatable: number
  cashReserve: number
  familyExpense: number
  growthCapital: number
  moveUpCapital: number
  financialInvestment: number
  expectedCashBalance: number
  cashShortfall: number
}

export function calcAllocation(
  input: AllocationInput,
  household: HouseholdSettings,
  ratios: BudgetRatios,
): AllocationResult {
  const total = input.jointSavings + input.bonusToPlan
  const cashShortfall = Math.max(household.cashTarget - input.cashBalance, 0)

  if (input.cashBalance < household.cashTarget) {
    const calcReserve = total * ratios.stage1CashReserve
    const cashReserve = Math.min(calcReserve, cashShortfall)
    const overflow = calcReserve - cashReserve
    const familyExpense = total * ratios.stage1FamilyExpense
    const growthCapital = overflow
    return {
      stage: 1,
      totalAllocatable: total,
      cashReserve,
      familyExpense,
      growthCapital,
      moveUpCapital: growthCapital * ratios.growthMoveUp,
      financialInvestment: growthCapital * ratios.growthInvestment,
      expectedCashBalance: input.cashBalance + cashReserve,
      cashShortfall,
    }
  }

  const familyExpense = total * ratios.stage2FamilyExpense
  const growthCapital = total * ratios.stage2GrowthCapital
  return {
    stage: 2,
    totalAllocatable: total,
    cashReserve: 0,
    familyExpense,
    growthCapital,
    moveUpCapital: growthCapital * ratios.growthMoveUp,
    financialInvestment: growthCapital * ratios.growthInvestment,
    expectedCashBalance: input.cashBalance,
    cashShortfall: 0,
  }
}
