'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center rounded-lg bg-[var(--color-primary)] px-4 text-[12.5px] font-semibold text-white hover:bg-[var(--color-primary-strong)] print:hidden"
    >
      인쇄 · PDF로 저장
    </button>
  )
}
