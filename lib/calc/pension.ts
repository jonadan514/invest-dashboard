export const PENSION_DEDUCT_LIMIT = 6_000_000
export const TOTAL_DEDUCT_LIMIT = 9_000_000

export function calcDeductible(pension: number, irp: number) {
  const pensionDeductible = Math.min(Math.max(pension, 0), PENSION_DEDUCT_LIMIT)
  const irpDeductible = Math.min(Math.max(irp, 0), TOTAL_DEDUCT_LIMIT - pensionDeductible)
  return { total: pensionDeductible + irpDeductible }
}

export function pensionProgress(pension: number, irp: number) {
  return calcDeductible(pension, irp).total / TOTAL_DEDUCT_LIMIT * 100
}
