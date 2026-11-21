'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'

/** 설명 문장 대신 쓰는 ⓘ 버튼. 누르면 아래에 설명이 펼쳐진다(휴대폰에서도 동작). */
export default function Hint({ text, label = '설명 보기' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex align-middle">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={label} className="inline-grid size-6 place-items-center rounded-full text-[var(--color-subtle)] hover:bg-[var(--color-section)] hover:text-[var(--color-primary)]">
        <Info size={14} aria-hidden="true" />
      </button>
      {open ? (
        <span role="note" className="absolute left-0 top-7 z-20 w-64 max-w-[80vw] rounded-lg border border-[var(--color-border)] bg-white p-3 text-[12.5px] font-normal leading-5 text-[var(--color-muted)] shadow-[var(--shadow-card)]">
          {text}
        </span>
      ) : null}
    </span>
  )
}
