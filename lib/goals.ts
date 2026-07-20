export interface Goal {
  id: string
  order: number
  name: string
  statement: string
  sub: string
  type: 'cash' | 'investment' | 'net_worth' | 'other'
  target: number
  next_hint: string
  achieved_at: string | null
}

export function getActiveGoal(goals: Goal[]): Goal | null {
  return (
    goals
      .filter(g => !g.achieved_at)
      .sort((a, b) => a.order - b.order)[0] ?? null
  )
}

export function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem('goals')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveGoals(goals: Goal[]): void {
  localStorage.setItem('goals', JSON.stringify(goals))
}
