import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import {
  addGoal,
  deleteGoal,
  markGoalAchieved,
  saveHouseholdSettings,
} from './actions'

function value(v: unknown, fallback: number) {
  return Number(v ?? fallback)
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: plan }, { data: household }, { data: goals }] = await Promise.all([
    supabase.from('financial_plan_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('household_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('household_goals').select('*').eq('user_id', user.id).order('sort_order'),
  ])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-5 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#819087]">Settings</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#27332e]">가계 설정</h1>
          <p className="mt-1 text-xs text-[#8b938e]">모든 기기에서 공통으로 사용하는 Asset Management 기준값입니다.</p>
        </div>

        <form action={saveHouseholdSettings} className="rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
          <div className="mb-5">
            <p className="text-sm font-semibold text-[#2f3a35]">기본 재무 기준</p>
            <p className="mt-1 text-xs text-[#929993]">비상금, 월 공금, 주담대 부담 계산에 사용합니다.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field name="monthly_income" label="월 가계 소득" defaultValue={value(household?.monthly_income, 0)} />
            <Field name="monthly_joint_contribution" label="월 공금 납입액" defaultValue={value(plan?.monthly_joint_contribution, 7_000_000)} />
            <Field name="monthly_fixed_cost" label="월 고정비" defaultValue={value(plan?.monthly_fixed_cost, 3_700_000)} />
            <Field name="current_emergency_fund" label="현재 비상금" defaultValue={value(plan?.current_emergency_fund, 13_000_000)} />
            <Field name="stage1_target" label="1차 비상금 목표" defaultValue={value(plan?.stage1_target, 30_000_000)} />
            <Field name="stage2_target" label="2차 현금 목표" defaultValue={value(plan?.stage2_target, 50_000_000)} />
            <Field name="mortgage_interest" label="월 주담대 이자" defaultValue={value(plan?.mortgage_interest, 2_500_000)} />
            <Field name="mortgage_principal" label="월 주담대 원금" defaultValue={value(plan?.mortgage_principal, 450_000)} />
          </div>

          <div className="mt-5 flex justify-end">
            <button className="rounded-xl bg-[#315c4c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#244c3e]">
              저장
            </button>
          </div>
        </form>

        <section id="goals" className="mt-5 rounded-2xl border border-[#ddd7cc] bg-[#fffdf8] p-5">
          <div>
            <p className="text-sm font-semibold text-[#2f3a35]">가계 목표</p>
            <p className="mt-1 text-xs text-[#929993]">홈 대시보드에 우선순위대로 표시됩니다.</p>
          </div>

          <div className="mt-4 space-y-2">
            {(goals ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#ddd7cc] px-4 py-6 text-center text-xs text-[#9aa09c]">
                등록된 목표가 없습니다.
              </div>
            ) : (
              (goals ?? []).map((goal, index) => (
                <div key={goal.id} className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
                  goal.achieved_at ? 'border-[#ece6dc] opacity-55' : 'border-[#e4ded4]'
                }`}>
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-[10px] font-semibold text-[#315c4c]">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-[#34423b]">{goal.name}</p>
                        {goal.achieved_at && <span className="text-[10px] text-[#5b806f]">달성</span>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#858e89]">{goal.statement}</p>
                      <p className="mt-1 text-[10px] text-[#a0a59f]">
                        목표 ₩{Number(goal.target).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!goal.achieved_at && (
                      <form action={markGoalAchieved}>
                        <input type="hidden" name="id" value={goal.id} />
                        <button className="rounded-lg px-2 py-1 text-[10px] text-[#315c4c] hover:bg-[#eef4f0]">달성</button>
                      </form>
                    )}
                    <form action={deleteGoal}>
                      <input type="hidden" name="id" value={goal.id} />
                      <button className="rounded-lg px-2 py-1 text-[10px] text-[#a06a62] hover:bg-rose-50">삭제</button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>

          <form action={addGoal} className="mt-5 rounded-xl bg-[#f6f2ea] p-4">
            <p className="mb-3 text-xs font-semibold text-[#46534d]">새 목표 추가</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField name="name" label="목표 이름" placeholder="예) 비상금 3,000만" required />
              <label>
                <span className="mb-1 block text-[11px] text-[#7f8782]">유형</span>
                <select name="type" className="w-full rounded-xl border border-[#ddd8ce] bg-white px-3 py-2.5 text-xs">
                  <option value="cash">현금</option>
                  <option value="net_worth">순자산</option>
                  <option value="investment">금융자산</option>
                  <option value="other">기타</option>
                </select>
              </label>
              <div className="md:col-span-2">
                <TextField name="statement" label="목표 문장" placeholder="현금 방어력 완성하기" required />
              </div>
              <TextField name="sub" label="설명" placeholder="선택 입력" />
              <Field name="target" label="목표 금액" defaultValue={0} />
              <div className="md:col-span-2">
                <TextField name="next_hint" label="다음 단계" placeholder="달성 후 갈아타기 자본 적립 시작" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="rounded-xl border border-[#b9cbbf] bg-white px-4 py-2 text-xs font-semibold text-[#315c4c] hover:bg-[#edf3ef]">
                목표 추가
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  )
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <label>
      <span className="mb-1 block text-[11px] text-[#7f8782]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          name={name}
          inputMode="numeric"
          defaultValue={Math.round(defaultValue)}
          className="w-full rounded-xl border border-[#ddd8ce] bg-white px-3 py-2.5 text-right text-sm text-[#2f3934] outline-none focus:border-[#577b6d]"
        />
        <span className="text-xs text-[#8c938f]">원</span>
      </div>
    </label>
  )
}

function TextField({
  name,
  label,
  placeholder,
  required = false,
}: {
  name: string
  label: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] text-[#7f8782]">{label}</span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#ddd8ce] bg-white px-3 py-2.5 text-xs text-[#2f3934] outline-none focus:border-[#577b6d]"
      />
    </label>
  )
}
