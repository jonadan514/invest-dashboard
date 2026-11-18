import { wonShort } from '../labels.ts'

export interface SnapshotLike {
  account_id: string
  month: string
  evaluation_amount: number
  monthly_allocation: number
  ytd_contribution: number
}

export interface AccountRecordState {
  evaluationAmount: number
  monthlyAllocation: number
  ytdContribution: number
  /** 이번 달 기록이 없어 직전 기록 값을 불러왔다. */
  carried: boolean
  /** 비교용 직전 기록(이번 달 이전 가장 최근). */
  previous: { month: string; evaluation: number } | null
  /** 정기 납입액으로 올해 누적 납입액을 자동으로 채웠다. */
  autoContribution?: boolean
}

/**
 * 월간 기록 화면의 계좌 한 줄 초기값.
 * - 이번 달 기록이 있으면 그 값을 쓴다.
 * - 없으면 평가금액은 직전 기록에서 불러오고(carried), 배분액은 0, 연금 누적액은 같은 해 기록일 때만 불러온다.
 * - monthlyContribution(매달 정기 납입액)이 있으면 누적 납입액에 직전 기록 이후 달 수만큼 더한다.
 *   올해 기록이 없으면 이번 달 한 번만 더한다.
 */
export function accountRecordState(snapshots: SnapshotLike[], accountId: string, month: string, monthlyContribution: number | null = null): AccountRecordState {
  const rows = snapshots.filter(row => row.account_id === accountId && row.month <= month).sort((a, b) => a.month.localeCompare(b.month))
  const exact = rows.find(row => row.month === month) ?? null
  const before = rows.filter(row => row.month < month).at(-1) ?? null
  const previous = before ? { month: before.month, evaluation: Number(before.evaluation_amount) } : null
  if (exact) {
    return { evaluationAmount: Number(exact.evaluation_amount), monthlyAllocation: Number(exact.monthly_allocation), ytdContribution: Number(exact.ytd_contribution), carried: false, previous }
  }
  const sameYear = before && before.month.slice(0, 4) === month.slice(0, 4) ? before : null
  const baseYtd = sameYear ? Number(sameYear.ytd_contribution) : 0
  const monthly = monthlyContribution != null && monthlyContribution > 0 ? monthlyContribution : 0
  const gap = sameYear ? Number(month.slice(5, 7)) - Number(sameYear.month.slice(5, 7)) : 1
  return {
    evaluationAmount: before ? Number(before.evaluation_amount) : 0,
    monthlyAllocation: 0,
    ytdContribution: baseYtd + monthly * gap,
    carried: before !== null,
    previous,
    ...(monthly > 0 ? { autoContribution: true } : {}),
  }
}

/** 목록(최신순이든 오래된순이든)에서 바로 이전 달·다음 달. 목록 밖이면 null. */
export function neighborMonths(months: string[], month: string) {
  const sorted = [...new Set(months)].sort()
  const index = sorted.indexOf(month)
  return {
    previous: index > 0 ? sorted[index - 1] : null,
    next: index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null,
  }
}

/** 비상금 목표 배지 문구: 설정한 목표 금액을 그대로 쓴다(예: 3,000만 달성). */
export function stageLabel(target: number) {
  return `${wonShort(target)} 달성`
}

export function ownerLabel(owner: string) {
  return owner === 'spouse' ? '아내' : owner === 'household' ? '공동' : '나'
}
