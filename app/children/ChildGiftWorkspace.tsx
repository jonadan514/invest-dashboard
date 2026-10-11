'use client'

import { useState } from 'react'
import { ChartNoAxesCombined, CircleGauge, ReceiptText, UserRoundCog, type LucideIcon } from 'lucide-react'
import type { ChildAccount, ChildAccountMonthlySnapshot, ChildGiftDeposit, ChildProfile } from '@/lib/types'
import ChildAssetManager from './ChildAssetManager'
import ChildGiftManager from './ChildGiftManager'

type WorkspaceView = 'overview' | 'deposits' | 'assets' | 'settings'

const VIEWS: Array<{ id: WorkspaceView; label: string; description: string; icon: LucideIcon }> = [
  { id: 'overview', label: '한눈에 보기', description: '공제 한도와 자녀별 현황', icon: CircleGauge },
  { id: 'deposits', label: '증여 기록', description: '납입 등록과 전체 내역', icon: ReceiptText },
  { id: 'assets', label: '자금 운용', description: '계좌 평가와 운용손익', icon: ChartNoAxesCombined },
  { id: 'settings', label: '자녀 관리', description: '자녀 기본정보 추가', icon: UserRoundCog },
]

export default function ChildGiftWorkspace({
  childProfiles,
  gifts,
  accounts,
  snapshots,
  today,
  currentMonth,
}: {
  childProfiles: ChildProfile[]
  gifts: ChildGiftDeposit[]
  accounts: ChildAccount[]
  snapshots: ChildAccountMonthlySnapshot[]
  today: string
  currentMonth: string
}) {
  const [view, setView] = useState<WorkspaceView>('overview')

  return (
    <div className="space-y-4">
      <nav aria-label="자녀 증여 관리 메뉴" className="grid grid-cols-2 overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-strong)] lg:grid-cols-4">
        {VIEWS.map(item => {
          const active = view === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-14 items-center gap-2.5 border-b border-r px-3 py-2.5 text-left transition-colors even:border-r-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0 ${active ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-primary)]' : 'bg-[var(--color-surface-strong)] hover:bg-[var(--color-section)]'}`}
            >
              <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]'}`}><Icon size={17} strokeWidth={active ? 2.2 : 1.7} /></span>
              <span className="min-w-0">
                <span className={`block text-xs font-extrabold ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink)]'}`}>{item.label}</span>
                <span className="mt-0.5 hidden truncate text-[9px] text-[var(--color-muted)] sm:block">{item.description}</span>
              </span>
            </button>
          )
        })}
      </nav>

      {view === 'assets' ? (
        <ChildAssetManager childProfiles={childProfiles} gifts={gifts} accounts={accounts} snapshots={snapshots} currentMonth={currentMonth} />
      ) : (
        <ChildGiftManager childProfiles={childProfiles} gifts={gifts} childAccounts={accounts} today={today} view={view} />
      )}
    </div>
  )
}
