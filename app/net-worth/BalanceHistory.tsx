'use client'

import { useState, useTransition } from 'react'
import { formatMonth, krw } from '@/lib/labels'
import { deleteItemBalance, saveItemBalance } from './actions'

export interface BalanceRow { month: string; amount: number; source: string }

const INPUT = 'field-input text-right tabular-nums'
export const SOURCE_LABEL: Record<string, string> = { manual: '직접 입력', mortgage_auto: '자동', price_auto: '실거래가' }

function formatInput(value: string) {
  const digits = value.replace(/[^0-9]/g, '')
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

/** 한 항목의 달별 잔액. 지난 달 잔액을 추가하거나 고치고, 직접 입력한 기록은 지울 수 있다. */
export default function BalanceHistory({ itemId, rows, currentMonth, auto }: { itemId: string; rows: BalanceRow[]; currentMonth: string; auto: boolean }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newMonth, setNewMonth] = useState(currentMonth)
  const [newAmount, setNewAmount] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const shown = showAll ? rows : rows.slice(0, 6)

  function run(task: () => Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await task()
        if (!result.ok) { setMessage(result.error ?? '저장하지 못했어요.'); return }
        setMessage(done)
        after?.()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '저장하지 못했어요.')
      }
    })
  }

  return (
    <div>
      <p className="text-[12.5px] font-bold">잔액 이력</p>
      {rows.some(row => row.source === 'price_auto') ? <p className="mt-1 text-[12.5px] leading-5 text-[var(--color-muted)]">‘실거래가’는 최근 3개월 같은 단지·면적 거래의 중간값이에요. 그달 금액을 고치면 직접 입력이 되어 자동으로 바뀌지 않아요.</p> : null}
      {auto ? <p className="mt-1 text-[12.5px] leading-5 text-[var(--color-muted)]">‘자동’은 직접 입력한 잔액을 기준으로 계산한 값이에요. 은행 잔액과 다르면 그달 잔액을 입력해 바로잡으세요.</p> : null}
      {rows.length === 0 ? <p className="mt-2 text-[12.5px] text-[var(--color-subtle)]">잔액 기록이 없어요.</p> : (
        <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-white">
          {shown.map(row => (
            <li key={row.month} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
              <span className="w-24 shrink-0 font-semibold">{formatMonth(row.month)}</span>
              <span className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${row.source === 'manual' ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'bg-[var(--color-section)] text-[var(--color-muted)]'}`}>{SOURCE_LABEL[row.source] ?? '자동'}</span>
              {editing === row.month ? (
                <span className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                  <input value={draft} onChange={event => setDraft(formatInput(event.target.value))} inputMode="numeric" aria-label={`${formatMonth(row.month)} 잔액`} className={`${INPUT} sm:w-44`} />
                  <button type="button" disabled={pending} onClick={() => run(() => saveItemBalance(itemId, row.month, draft), '저장했어요.', () => setEditing(null))} className="min-h-8 shrink-0 rounded-lg bg-[var(--color-primary)] px-3 text-[12.5px] font-semibold text-white disabled:opacity-50">저장</button>
                  <button type="button" onClick={() => setEditing(null)} className="min-h-8 shrink-0 px-1 text-[12.5px] text-[var(--color-muted)]">취소</button>
                </span>
              ) : (
                <>
                  <span className="ml-auto font-semibold tabular-nums">{krw(row.amount)}</span>
                  <button type="button" onClick={() => { setEditing(row.month); setDraft(Math.round(row.amount).toLocaleString('ko-KR')) }} className="min-h-8 px-1.5 text-[12.5px] font-semibold text-[var(--color-primary)]">고치기</button>
                  {row.source === 'manual' ? (
                    <button type="button" disabled={pending} onClick={() => { if (confirm(`${formatMonth(row.month)} 잔액 기록을 지울까요?`)) run(() => deleteItemBalance(itemId, row.month), '지웠어요.') }} className="min-h-8 px-1.5 text-[12.5px] text-[var(--color-subtle)] hover:text-[var(--color-negative)] disabled:opacity-50">지우기</button>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {rows.length > 6 ? <button type="button" onClick={() => setShowAll(value => !value)} className="mt-1 min-h-8 text-[12.5px] font-semibold text-[var(--color-primary)]">{showAll ? '접기' : `전체 ${rows.length}개월 보기`}</button> : null}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-[12.5px] font-semibold text-[var(--color-muted)]">달
          <input type="month" value={newMonth} max={currentMonth} onChange={event => setNewMonth(event.target.value)} className="field-input mt-1 block w-auto" />
        </label>
        <label className="min-w-40 flex-1 text-[12.5px] font-semibold text-[var(--color-muted)]">잔액(원)
          <input value={newAmount} onChange={event => setNewAmount(formatInput(event.target.value))} inputMode="numeric" placeholder="0" className={`mt-1 ${INPUT}`} />
        </label>
        <button type="button" disabled={pending || !newAmount || !newMonth} onClick={() => run(() => saveItemBalance(itemId, newMonth, newAmount), `${formatMonth(newMonth)} 잔액을 저장했어요.`, () => setNewAmount(''))} className="min-h-9 rounded-lg bg-[var(--color-ink)] px-4 text-[12.5px] font-semibold text-white disabled:opacity-50">잔액 추가·수정</button>
      </div>
      {message ? <p className="mt-2 text-[12.5px] text-[var(--color-primary)]" role="status">{message}</p> : null}
    </div>
  )
}
