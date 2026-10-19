'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTransaction } from '../actions'
import { EDIT_TRANSACTION_TYPES, isAssetTransaction } from '@/lib/transaction-edit'

interface Props {
  tx: {
    id: string
    date: string
    type: string
    quantity: number | null
    price: number | null
    amount: number | null
    fee: number
    tax: number | null
    fx_rate: number | null
    currency: string
    accounts: { name: string; owner: string } | null
    assets: { name: string; symbol: string | null; currency: string } | null
  }
}

export default function EditForm({ tx }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [txType, setTxType] = useState(tx.type)
  const [qty, setQty] = useState(tx.quantity?.toString() ?? '')
  const [price, setPrice] = useState(tx.price?.toString() ?? '')
  const [error, setError] = useState('')

  const isTrade = txType === 'buy' || txType === 'sell'
  const currency = isAssetTransaction(tx.type) ? tx.assets?.currency ?? tx.currency : tx.currency
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
      <div className="bg-[#f3f7fb] rounded-xl px-4 py-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-[#65758a]">계좌</span>
          <span className="text-[#172233] font-medium">
            {tx.accounts?.owner === 'spouse' ? '[아내] ' : '[나] '}{tx.accounts?.name ?? '-'}
          </span>
        </div>
        {tx.assets && (
          <div className="flex justify-between">
            <span className="text-[#65758a]">종목</span>
            <span className="text-[#172233] font-medium">
              {tx.assets.symbol ? `${tx.assets.symbol} — ` : ''}{tx.assets.name}
            </span>
          </div>
        )}
      </div>

      {/* 날짜 */}
      <div>
        <label className="block text-xs text-[#65758a] mb-1">날짜 *</label>
        <input
          name="date"
          type="date"
          defaultValue={tx.date}
          required
          className="w-full text-sm bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]"
        />
      </div>

      {/* 거래 유형 */}
      <div>
        <label className="block text-xs text-[#65758a] mb-1.5">거래 유형 *</label>
        <div className="flex flex-wrap gap-1.5">
          {EDIT_TRANSACTION_TYPES.filter(t => isAssetTransaction(t.value) === isAssetTransaction(tx.type)).map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTxType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                txType === t.value
                  ? 'bg-[#3f7fc3] text-white'
                  : 'bg-white border border-[#d7e1eb] text-[#172233] hover:border-[#3f7fc3]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={txType} />
        <p className="mt-2 text-xs text-[#65758a]">종목 거래와 현금 거래 간 변경은 새 거래로 등록해 주세요.</p>
      </div>

      {/* 수량 + 단가 */}
      {isTrade && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#65758a] mb-1">수량 *</label>
            <input
              name="quantity"
              type="number"
              step="any"
              min="0.000000001"
              required
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full text-sm bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#65758a] mb-1">
              단가 * {currency !== 'KRW' && <span className="text-[#3f7fc3]">({currency})</span>}
            </label>
            <input
              name="price"
              type="number"
              step="any"
              min="0.000000001"
              required
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full text-sm bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]"
            />
          </div>
        </div>
      )}

      {/* 총액 미리보기 */}
      {isTrade && total > 0 && (
        <div className="bg-[#eaf3fb] border border-[#cbddec] rounded-lg px-3 py-2 text-xs text-[#3f7fc3] font-medium">
          총액: {currency === 'KRW' ? '₩' : '$'}{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <span className="text-[#3d9970] ml-1">({qty}주 × {Number(price).toLocaleString()})</span>
        </div>
      )}

      {/* 현금 금액 및 배당 수령액 */}
      {!isTrade && (
        <div>
          <label className="block text-xs text-[#65758a] mb-1">{txType === 'dividend' ? '배당 금액' : '금액'} ({currency === 'KRW' ? '원' : currency}) *</label>
          <input
            name="cash_amount"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={tx.amount ?? ''}
            className="w-full text-sm bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]"
          />
        </div>
      )}

      {/* 수수료 */}
      {currency !== 'KRW' && (
        <div>
          <label className="block text-xs text-[#65758a] mb-1">거래 당시 환율 (원/{currency === 'USD' ? '달러' : currency})</label>
          <input name="fx_rate" type="number" step="any" min={currency === 'USD' ? 100 : 0.000001} required
            defaultValue={tx.fx_rate && tx.fx_rate >= (currency === 'USD' ? 100 : 0.000001) ? tx.fx_rate : ''} placeholder="예: 1400"
            className="w-full text-sm bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]" />
        </div>
      )}
      <div>
        <label className="block text-xs text-[#65758a] mb-1">세금 ({currency === 'KRW' ? '원' : currency})</label>
        <input name="tax" type="number" step="any" min="0" defaultValue={tx.tax ?? 0}
          className="w-full text-sm bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]" />
      </div>
      <div>
        <label className="block text-xs text-[#65758a] mb-1">수수료</label>
        <input
          name="fee"
          type="number"
          step="any"
          min="0"
          defaultValue={tx.fee ?? 0}
          className="w-full text-sm bg-white border border-[#d7e1eb] rounded-lg px-3 py-2 focus:outline-none focus:border-[#3f7fc3]"
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
          className="flex-1 bg-[#3f7fc3] hover:bg-[#326ba6] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
        >
          {pending ? '저장 중…' : '수정 저장'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-[#65758a] hover:text-[#172233] border border-[#d7e1eb] rounded-lg transition-colors"
        >
          취소
        </button>
      </div>
    </form>
  )
}
