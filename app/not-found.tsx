import Link from 'next/link'

export const metadata = { title: '페이지를 찾을 수 없어요' }

export default function NotFound() {
  return (
    <div className="page-container flex min-h-[70dvh] max-w-[1240px] items-center justify-center">
      <section className="app-card w-full max-w-md p-8 text-center">
        <p className="text-[13px] font-bold text-[var(--color-accent)]">404</p>
        <h1 className="mt-2 text-xl font-extrabold text-[var(--color-ink)]">페이지를 찾을 수 없어요</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-muted)]">주소가 바뀌었거나 없는 화면이에요. 메뉴에서 원하는 화면을 골라 주세요.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="inline-flex min-h-10 items-center rounded-lg bg-[var(--color-primary)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-strong)]">홈으로 가기</Link>
          <Link href="/guide" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--color-border)] bg-white px-4 text-[13px] font-semibold text-[var(--color-ink)]">사용 가이드</Link>
        </div>
      </section>
    </div>
  )
}
