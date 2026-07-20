'use client'
import { useState, useTransition } from 'react'
import { updateMemo } from './actions'

export default function MemoEditor({ txId, initialMemo }: { txId: string; initialMemo: string | null }) {
  const [editing, setEditing] = useState(false)
  const [memo, setMemo] = useState(initialMemo ?? '')
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      await updateMemo(txId, memo)
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full text-left group"
      >
        <div className="flex items-start gap-2">
          <span className="text-[10px] text-[#b5aa98] mt-0.5 shrink-0">📝</span>
          <p className={`text-xs flex-1 leading-relaxed ${
            memo ? 'text-[#34322b]' : 'text-[#c4b89e] italic'
          }`}>
            {memo || '메모 추가...'}
          </p>
          <span className="text-[10px] text-[#c4b89e] group-hover:text-[#1c6b4a] transition-colors shrink-0 opacity-0 group-hover:opacity-100">
            편집
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] text-[#b5aa98]">📝</span>
        <span className="text-[10px] text-[#9c9484] font-medium">메모</span>
      </div>
      <textarea
        value={memo}
        onChange={e => setMemo(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') { setMemo(initialMemo ?? ''); setEditing(false) }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
        }}
        rows={3}
        autoFocus
        placeholder="매매 이유, 느낀 점, 향후 계획..."
        className="w-full text-xs bg-[#faf6ec] border border-[#1c6b4a] rounded-lg px-3 py-2 focus:outline-none resize-none text-[#34322b] placeholder:text-[#c4b89e]"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="text-[10px] bg-[#1c6b4a] text-white rounded-md px-3 py-1.5 hover:bg-[#165638] disabled:opacity-50 font-medium"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        <button
          onClick={() => { setMemo(initialMemo ?? ''); setEditing(false) }}
          className="text-[10px] text-[#9c9484] hover:text-[#34322b] transition-colors"
        >
          취소
        </button>
        <span className="text-[9px] text-[#c4b89e] ml-auto">Ctrl+Enter로 저장</span>
      </div>
    </div>
  )
}
