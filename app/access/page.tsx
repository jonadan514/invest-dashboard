import BrandLockup from '@/components/BrandLockup'

export const metadata = {
  title: '접근 확인 | 샘훈호 FAMILY OFFICE',
  robots: { index: false, follow: false },
}

function safeNextPath(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/'
  return next
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string | string[]; retry?: string }>
}) {
  const params = await searchParams
  const nextPath = safeNextPath(params.next)
  const configError = params.error === 'config'
  const passwordError = params.error === 'password'
  const rateError = params.error === 'rate'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-sidebar)] px-5 py-10">
      <section className="w-full max-w-sm rounded-[1.5rem] border border-white/20 bg-white p-7 shadow-[0_24px_70px_rgba(7,28,65,0.35)] sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="-mx-7 -mt-7 flex w-[calc(100%+3.5rem)] justify-center border-b border-white/15 bg-[var(--color-sidebar)] px-3 py-5 sm:-mx-8 sm:-mt-8 sm:w-[calc(100%+4rem)]">
            <BrandLockup size="large" priority />
          </div>
          <p className="mt-5 text-[10px] font-bold tracking-[0.2em] text-[var(--color-accent)]">HOUSEHOLD FINANCE</p>
          <h1 className="mt-2 text-sm font-bold tracking-[-0.02em] text-[var(--color-ink)]">샘훈호 가족 자산관리</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">가족 자산을 안전하게 확인하려면<br />공용 비밀번호를 입력해 주세요.</p>
        </div>

        <form action="/api/access/unlock" method="post" className="mt-7">
          <input type="hidden" name="next" value={nextPath} />
          <label htmlFor="password" className="text-sm font-bold text-[var(--color-ink)]">공용 비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            maxLength={256}
            className="mt-2 h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-section)] px-4 text-base outline-none transition focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-blue-100"
            placeholder="비밀번호 입력"
          />

          {passwordError ? (
            <p role="alert" className="mt-3 rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-negative-strong)]">비밀번호가 올바르지 않습니다.</p>
          ) : null}
          {configError ? (
            <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold leading-5 text-amber-800">서버에 접근 비밀번호가 아직 설정되지 않았습니다.</p>
          ) : null}
          {rateError ? (
            <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold leading-5 text-amber-800">비밀번호 입력이 여러 번 실패했습니다. 약 15분 뒤 다시 시도해 주세요.</p>
          ) : null}

          <button type="submit" disabled={rateError} className="mt-5 h-12 w-full rounded-xl bg-[var(--color-primary)] text-sm font-extrabold text-white shadow-sm transition hover:bg-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50">
            자산현황 열기
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-5 text-[var(--color-subtle)]">인증은 이 기기에서 30일간 유지됩니다.</p>
      </section>
    </main>
  )
}
