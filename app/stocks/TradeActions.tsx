'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTrade } from './actions'
import TradeForm, { type TradeAccount, type TradeAsset, type TradeInitial } from './TradeForm'

/** 거래 한 줄의 수정·삭제. 수정을 누르면 그 자리에 수정 폼이 열린다. */
export default function TradeActions({ trade, accounts, assets }: { trade: TradeInitial; accounts: TradeAccount[]; assets: TradeAsset[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  function remove() {
    if (!confirm('이 거래를 삭제할까요? 보유 수량과 평균 단가가 다시 계산됩니다.')) return
    startTransition(async () => {
      try {
        const result = await deleteTrade(trade.id)
        if (!result.ok) {
          alert(result.error)
          return
        }
        router.refresh()
      } catch (cause) {
        alert(cause instanceof Error ? cause.message : '삭제하지 못했습니다.')
      }
    })
  }

  return (
    <>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={() => setEditing(value => !value)} className="min-h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[12.5px] font-semibold">{editing ? '닫기' : '수정'}</button>
        <button type="button" onClick={remove} disabled={pending} className="min-h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[12.5px] font-semibold text-[var(--color-negative)] disabled:opacity-50">삭제</button>
      </div>
      {editing ? (
        <div className="col-span-full mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-section)] p-3">
          <TradeForm accounts={accounts} assets={assets} initial={trade} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </>
  )
}
