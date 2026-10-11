import Link from 'next/link'

const MONTHLY_STEPS = [
  ['1', '월간 기록', '공금·성과급·주담대와 모든 금융계좌의 월말 평가금액을 입력합니다.'],
  ['2', '밸런스 시트', '부동산·보증금·차량·대출처럼 계좌 밖 항목의 월말 잔액을 확인합니다.'],
  ['3', '연금 현황', '부부별 올해 누적 납입액과 세액공제 목표 달성률을 확인합니다.'],
  ['4', '대시보드', '총자산·총부채·순자산과 이번 달 기록 완료 여부를 최종 확인합니다.'],
] as const

const TERMS = [
  ['이번 달 배분액', '해당 계좌로 실제 이체하거나 투자한 금액입니다. 자금 흐름을 설명하지만 총자산에는 직접 더하지 않습니다.'],
  ['월말 평가금액', '월말 금융기관 앱에서 확인한 현재 잔액입니다. 이 금액이 총자산에 반영됩니다.'],
  ['올해 누적 납입액', '연금저축·IRP에 올해 1월부터 현재까지 납입한 원금의 합계입니다. 월 납입액이 아닙니다.'],
  ['순자산', '총자산에서 총부채를 뺀 금액입니다. 대출 원금을 갚으면 부채가 줄어 순자산에 긍정적으로 반영됩니다.'],
] as const

export default function GuidePage() {
  return (
    <div className="page-container max-w-[1100px]">
      <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="page-eyebrow">Household finance guide</p>
          <h1 className="page-title">대시보드 사용 가이드</h1>
          <p className="page-subtitle">매일 쓰는 가계부가 아니라, 가족 자산의 위치와 변화를 월 1회 확인하는 도구입니다.</p>
        </div>
        <Link href="/budget" className="inline-flex min-h-10 w-fit items-center rounded-sm bg-[var(--color-primary)] px-4 text-xs font-semibold text-white hover:bg-[var(--color-primary-strong)]">
          이번 달 기록하기 →
        </Link>
      </header>

      <section className="app-card overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-section)] px-5 py-4">
          <h2 className="text-base font-extrabold text-[var(--color-ink)]">월말 권장 순서</h2>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">월말 또는 다음 달 초에 아래 네 단계만 진행하면 됩니다.</p>
        </div>
        <ol className="grid grid-cols-1 divide-y divide-[var(--color-border)] md:grid-cols-2 md:divide-y-0">
          {MONTHLY_STEPS.map(([number, title, description], index) => (
            <li key={title} className={`flex gap-3 p-5 ${index % 2 === 0 ? 'md:border-r md:border-[var(--color-border)]' : ''} ${index > 1 ? 'md:border-t md:border-[var(--color-border)]' : ''}`}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-xs font-extrabold text-[var(--color-primary)]">{number}</span>
              <div>
                <h3 className="text-sm font-extrabold text-[var(--color-ink)]">{title}</h3>
                <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GuideCard title="처음 한 번만 설정" tone="blue">
          <GuideList items={[
            '월간 기록 기본값에서 고정비·공금·주담대·비상금 목표를 확인합니다.',
            '밸런스 시트의 항목 관리에서 현금·MMF·주식·연금·ISA·코인 계좌를 등록합니다.',
            '부동산·보증금·차량·대출은 계좌 외 자산·부채로 등록합니다.',
            '비상금으로 쓰는 금융계좌에는 비상금 합산 표시를 선택합니다.',
          ]} />
          <Notice>금융계좌를 계좌 외 자산으로 다시 등록하면 총자산이 중복 계산됩니다.</Notice>
        </GuideCard>

        <GuideCard title="월간 기록 입력" tone="blue">
          <GuideList items={[
            '배분 가능액은 공금 − 고정비 + 포함 성과급으로 계산됩니다.',
            '배분액에는 실제 보낸 돈, 평가금액에는 월말 현재 잔액을 입력합니다.',
            '연금저축·IRP에는 해당 연도의 누적 납입액도 입력합니다.',
            '같은 월을 다시 저장하면 그 달의 기록이 수정됩니다.',
          ]} />
          <Notice>총자산에는 배분액이 아니라 월말 평가금액만 반영됩니다.</Notice>
        </GuideCard>

        <GuideCard title="밸런스 시트" tone="green">
          <GuideList items={[
            '한눈에 보기에서 총자산·총부채·순자산과 전월 대비 변화를 봅니다.',
            '월말 기록에서는 부동산·보증금·차량·대출 잔액만 확인하고 저장합니다.',
            '선택한 월에 기록이 없으면 직전 금액을 불러오므로 확인 후 저장해야 합니다.',
            '더 이상 쓰지 않는 항목은 비활성화하면 과거 기록이 유지됩니다.',
          ]} />
          <Notice>활성 주담대 항목이 하나일 때만 월간 원금 상환액이 잔액에 자동 반영됩니다.</Notice>
        </GuideCard>

        <GuideCard title="연금 현황" tone="green">
          <GuideList items={[
            '연금 현황은 조회 화면이며 실제 입력은 월간 기록에서 합니다.',
            '1인 기준 연금저축 600만 원, IRP 포함 합산 900만 원을 관리 목표로 봅니다.',
            '계좌별 최근 평가금액과 부부별 납입 달성률을 함께 확인합니다.',
            '예상 절세액은 16.5% 단순 적용 참고치입니다.',
          ]} />
        </GuideCard>

        <GuideCard title="자녀 증여" tone="amber">
          <GuideList items={[
            '자녀 관리에서 이름·별칭과 생년월일을 처음 한 번 등록합니다.',
            '증여 기록에는 실제 입금자·관계·입금 성격·입금 계좌를 남깁니다.',
            '자금 운용에서 현금성 또는 투자 계좌를 등록하고 월말 평가금액을 기록합니다.',
            '추가 입금 후 평가를 갱신해야 운용손익이 정확하게 표시됩니다.',
          ]} />
          <Notice>화면의 공제 한도와 예상액은 관리용 참고치이며 세무 신고를 대신하지 않습니다.</Notice>
        </GuideCard>

        <GuideCard title="수정·보관 시 주의" tone="red">
          <GuideList items={[
            '잘못 입력한 월은 같은 월을 다시 선택하고 저장해 수정합니다.',
            '금융계좌 삭제 시 월별 평가 기록도 함께 삭제될 수 있습니다.',
            '자녀 증여·평가 기록은 삭제 전에 날짜와 금액을 다시 확인합니다.',
            '큰 변경 전에는 설정 화면에서 전체 JSON 백업을 내려받아 보관합니다.',
          ]} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/settings" className="rounded-sm border border-[var(--color-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--color-primary)]">백업·설정 열기 →</Link>
            <Link href="/" className="rounded-sm border border-[var(--color-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--color-ink)]">대시보드로 →</Link>
          </div>
        </GuideCard>
      </div>

      <section className="app-card mt-4 overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-section)] px-5 py-4">
          <h2 className="text-base font-extrabold text-[var(--color-ink)]">자주 헷갈리는 용어</h2>
        </div>
        <dl className="divide-y divide-[var(--color-border)]">
          {TERMS.map(([term, description]) => (
            <div key={term} className="grid gap-1 px-5 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
              <dt className="text-xs font-extrabold text-[var(--color-ink)]">{term}</dt>
              <dd className="text-[11px] leading-5 text-[var(--color-muted)]">{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-4 border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-5">
        <h2 className="text-sm font-extrabold text-[var(--color-ink)]">월말 체크리스트</h2>
        <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {['기록 월 확인', '공금·성과급 입력', '주담대 이자·원금 입력', '모든 금융계좌 평가금액 입력', '연금 누적 납입액 입력', '계좌 밖 자산·부채 저장', '자녀 입금·평가 확인', '대시보드 완료 상태 확인'].map(item => (
            <p key={item} className="text-xs text-[var(--color-muted)]">□ {item}</p>
          ))}
        </div>
      </section>
    </div>
  )
}

function GuideCard({ title, tone, children }: { title: string; tone: 'blue' | 'green' | 'amber' | 'red'; children: React.ReactNode }) {
  const border = tone === 'green' ? 'border-t-[var(--color-positive-bright)]' : tone === 'amber' ? 'border-t-amber-400' : tone === 'red' ? 'border-t-[var(--color-negative)]' : 'border-t-[var(--color-primary)]'
  return <section className={`app-card border-t-4 p-5 ${border}`}><h2 className="text-base font-extrabold text-[var(--color-ink)]">{title}</h2><div className="mt-3">{children}</div></section>
}

function GuideList({ items }: { items: string[] }) {
  return <ul className="space-y-2">{items.map(item => <li key={item} className="flex gap-2 text-[11px] leading-5 text-[var(--color-muted)]"><span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />{item}</li>)}</ul>
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 border-l-2 border-[var(--color-primary)] bg-[var(--color-section)] px-3 py-2 text-[10px] leading-5 text-[var(--color-muted)]">{children}</p>
}
