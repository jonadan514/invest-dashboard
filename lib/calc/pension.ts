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

/** 세액공제율(지방소득세 포함). 이 앱은 총급여 5,500만 원 초과 기준 13.2%로 계산한다. */
export const PENSION_CREDIT_RATE = 0.132

export interface PensionRoom {
  /** 올해 세액공제 한도까지 더 넣을 수 있는 금액(연금저축+IRP). */
  remaining: number
  /** remaining 가운데 연금저축으로 채워도 인정되는 최대 금액. 나머지는 IRP로 넣어야 한다. */
  pensionSavingsRoom: number
  /** remaining을 모두 채웠을 때 추가로 받는 세액공제 예상액(13.2%). */
  extraCredit: number
}

export function pensionRoom(pension: number, irp: number): PensionRoom {
  const deductible = calcDeductible(pension, irp).total
  const remaining = Math.max(TOTAL_DEDUCT_LIMIT - deductible, 0)
  const pensionSavingsRoom = Math.min(Math.max(PENSION_DEDUCT_LIMIT - Math.max(pension, 0), 0), remaining)
  return {
    remaining,
    pensionSavingsRoom,
    extraCredit: Math.round(remaining * PENSION_CREDIT_RATE),
  }
}

export interface YearEndSchedule {
  /** 오늘을 포함해 12월 31일까지 남은 날 수. */
  daysLeft: number
  /** 남은 납입 기회를 주 단위로 센 값(최소 1). */
  weeksLeft: number
  /** 10월~12월이면 연말 마감 알림을 앞에 보여 준다. */
  isYearEndSeason: boolean
}

/** today는 한국 날짜 YYYY-MM-DD. */
export function yearEndSchedule(today: string): YearEndSchedule {
  const [year, month, day] = today.split('-').map(Number)
  const start = Date.UTC(year, month - 1, day)
  const end = Date.UTC(year, 11, 31)
  const daysLeft = Math.round((end - start) / 86_400_000) + 1
  return { daysLeft, weeksLeft: Math.max(1, Math.ceil(daysLeft / 7)), isYearEndSeason: month >= 10 }
}
