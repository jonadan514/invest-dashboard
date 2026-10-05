'use client'

export default function PageError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <section className="page-container max-w-[1240px]" role="alert">
      <div className="app-card p-6">
        <h1 className="text-lg font-bold">기록을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">조회가 완료되지 않아 금액과 입력 화면을 표시하지 않았습니다. 기존 기록은 그대로 보관됩니다.</p>
        <button onClick={unstable_retry} className="mt-5 rounded-sm bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">다시 불러오기</button>
      </div>
    </section>
  )
}
