import { getHouseholdContext } from '@/lib/supabase/server'
import type { ChildAccount, ChildAccountMonthlySnapshot, ChildGiftDeposit, ChildProfile } from '@/lib/types'
import ChildGiftWorkspace from './ChildGiftWorkspace'

export default async function ChildrenPage() {
  const { supabase, userId } = await getHouseholdContext()
  const today = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date())
  const currentMonth = today.slice(0, 7)

  const [childrenResult, giftsResult, accountsResult, snapshotsResult] = await Promise.all([
    supabase.from('children').select('*').eq('user_id', userId).eq('is_active', true).order('birth_date'),
    supabase.from('child_gift_deposits').select('*').eq('user_id', userId).order('gift_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('child_accounts').select('*').eq('user_id', userId).eq('is_active', true).order('created_at'),
    supabase.from('child_account_monthly_snapshots').select('*').eq('user_id', userId).order('month', { ascending: false }).order('updated_at', { ascending: false }),
  ])

  const error = childrenResult.error ?? giftsResult.error ?? accountsResult.error ?? snapshotsResult.error
  const missingTables = error && (error.code === '42P01' || error.message.includes('child_') || error.message.includes('children'))
  const childProfiles = (childrenResult.data ?? []).map(row => ({ ...row })) as ChildProfile[]
  const gifts = (giftsResult.data ?? []).map(row => ({ ...row, amount: Number(row.amount) })) as ChildGiftDeposit[]
  const accounts = (accountsResult.data ?? []).map(row => ({ ...row })) as ChildAccount[]
  const snapshots = (snapshotsResult.data ?? []).map(row => ({ ...row, evaluation_amount: Number(row.evaluation_amount) })) as ChildAccountMonthlySnapshot[]

  return (
    <>
      <div className="page-container max-w-[1240px]">
        <header className="mb-5">
          <p className="page-eyebrow">Children gift tracker</p>
          <h1 className="page-title">자녀 증여 관리</h1>
          <p className="page-subtitle">자녀 계좌 납입액과 월말 평가금액을 기록하고 증여 한도와 자금 운용 현황을 함께 확인합니다.</p>
        </header>

        <details className="mb-4 overflow-hidden rounded-2xl border border-lime-300 bg-lime-50/70">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-lime-900 sm:px-5">
            <span>증여 공제·비과세 기준 안내</span>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[9px] font-semibold text-lime-800">필요할 때 열어보기</span>
          </summary>
          <div className="border-t border-lime-300/70 px-4 pb-4 pt-3 sm:px-5">
            <p className="text-[11px] leading-5 text-lime-900/75">
              직계존속 증여는 최근 10년간 미성년자 2천만 원·성년자 5천만 원, 고모·이모·삼촌 등 기타 친족 증여는 1천만 원까지 공제됩니다. 친족 외 증여에는 관계 공제가 없습니다.
            </p>
            <p className="mt-1 text-[10px] leading-4 text-lime-900/60">소액이라고 자동 비과세되는 기준은 없습니다. 생활비·교육비나 통상적 용돈·축하금은 실제 용도와 사회통념에 따라 판단되므로, 자녀 계좌에 적립·투자하는 금액은 ‘증여’로 기록하세요.</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold text-lime-900/70">
              <a href="https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7960&mi=6533" target="_blank" rel="noopener noreferrer" className="hover:underline">국세청 공제 기준 ↗</a>
              <a href="https://www.law.go.kr/lsLinkProc.do?chrClsCd=010202&joLnkStr=%EC%A0%9C53%EC%A1%B0%EC%99%80+%EC%A0%9C54%EC%A1%B0&joNo=005300000%5E005400000&lsId=001561&lsNm=%EC%83%81%EC%86%8D%EC%84%B8+%EB%B0%8F+%EC%A6%9D%EC%97%AC%EC%84%B8%EB%B2%95&mode=2" target="_blank" rel="noopener noreferrer" className="hover:underline">상증세법 제53조 ↗</a>
            </div>
          </div>
        </details>

        {error ? (
          <section className="app-card p-6">
            <p className="text-sm font-bold text-[var(--color-ink)]">{missingTables ? '자녀 증여 기록용 Supabase 테이블을 추가해야 합니다.' : '자녀 증여 데이터를 불러오지 못했습니다.'}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
              {missingTables ? 'supabase/migrations/20260902022903_child_gift_tracking.sql 파일의 내용을 Supabase SQL Editor에서 실행한 뒤 새로고침하세요.' : error.message}
            </p>
          </section>
        ) : <ChildGiftWorkspace childProfiles={childProfiles} gifts={gifts} accounts={accounts} snapshots={snapshots} today={today} currentMonth={currentMonth} />}
      </div>
    </>
  )
}
