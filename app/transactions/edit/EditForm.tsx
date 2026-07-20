'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTransaction } from '../actions'

const TX_TYPES = [
  { value: 'buy', label: '매수' },
  { value: 'sell', label: '매도' },
  { value: 'dividend', label: '배당' },
  { value: 'deposit', label: '입금' },
  { value: 'withdraw', label: '출금' },
  { value: 'interest', label: '이자' },
]

interface Props {
  tx: {
    id: string
    date: string
    type: string
    quantity: number | null
    price: number | null
    amount: number | null
    fee: number
    memo: string | null
    currency: string
    accounts: { name: string; owner: string } | null
    assets: { name: string; symbol: string | null } | null
  }
}

export default function EditForm({ tx }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [txType, setTxType] = useState(tx.type)
  const [qty, setQty] = useState(tx.quantity?.toString() ?? '')
  const [price, setPrice] = useState(tx.price?.toString() ?? '')
  const [error, setError] = useState('')

  const needsAsset = ['buy', 'sell', 'dividend'].includes(txType)
  const currency = tx.currency ?? 'KRW'
  const total = parseFloat(qty || '0') * parseFloat(price || '0')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await updateTransaction(tx.id, fd)
        router.push('/transactions')
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 계좌 + 종목 (읽기 전용 표시) */}
      <div className="bg-[#f4eee0] rounded-xl px-4 py-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-[#9c9484]">계좌</span>
          <span className="text-[#34322b] font-medium">
            {tx.accounts?.owner === 'spouse' ? '[아내] ' : '[나] '}{tx.accounts?.name ?? '-'}
          </span>
        </div>
        {tx.assets && (
          <div className="flex justify-between">
            <span className="text-[#9c9484]">종목</span>
            <span className="text-[#34322b] font-medium">
              {tx.assets.symbol ? `${tx.assets.symbol} — ` : ''}{tx.assets.name}
            </span>
          </div>
        )}
      </div>

      {/* 날짜 */}
      <div>
        <label className="block text-xs text-[#9c9484] mb-1">날짜 *</label>
        <input
          name="date"
          type="date"
          defaultValue={tx.date}
          required
          className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
        />
      </div>

      {/* 거래 유형 */}
      <div>
        <label className="block text-xs text-[#9c9484] mb-1.5">거래 유형 *</label>
        <div className="flex flex-wrap gap-1.5">
          {TX_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTxType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                txType === t.value
                  ? 'bg-[#1c6b4a] text-white'
                  : 'bg-white border border-[#e3d9c4] text-[#34322b] hover:border-[#1c6b4a]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={txType} />
      </div>

      {/* 수량 + 단가 */}
      {needsAsset && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9c9484] mb-1">수량 *</label>
            <input
              name="quantity"
              type="number"
              step="any"
              min="0"
              required
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9c9484] mb-1">
              단가 * {currency !== 'KRW' && <span className="text-[#1c6b4a]">({currency})</span>}
            </label>
            <input
              name="price"
              type="number"
              step="any"
              min="0"
              required
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
            />
          </div>
        </div>
      )}

      {/* 총액 미리보기 */}
      {needsAsset && total > 0 && (
        <div className="bg-[#e8f4ee] border border-[#c5dece] rounded-lg px-3 py-2 text-xs text-[#1c6b4a] font-medium">
          총액: {currency === 'KRW' ? '₩' : '$'}{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <span className="text-[#3d9970] ml-1">({qty}주 × {Number(price).toLocaleString()})</span>
        </div>
      )}

      {/* 현금 금액 (비자산 거래) */}
      {!needsAsset && (
        <div>
          <label className="block text-xs text-[#9c9484] mb-1">금액 (원) *</label>
          <input
            name="cash_amount"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={tx.amount ?? ''}
            className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
          />
        </div>
      )}

      {/* 수수료 */}
      <div>
        <label className="block text-xs text-[#9c9484] mb-1">수수료</label>
        <input
          name="fee"
          type="number"
          step="any"
          min="0"
          defaultValue={tx.fee ?? 0}
          className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
        />
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-xs text-[#9c9484] mb-1">메모</label>
        <textarea
          name="memo"
          defaultValue={tx.memo ?? ''}
          rows={2}
          className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a] resize-none"
        />
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-[#1c6b4a] hover:bg-[#165638] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
        >
          {pending ? '저장 중…' : '수정 저장'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-[#9c9484] hover:text-[#34322b] border border-[#e3d9c4] rounded-lg transition-colors"
        >
          취소
        </button>
      </div>
    </form>
  )
}
