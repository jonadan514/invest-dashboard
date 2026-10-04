'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTransaction, createAssetAndTransaction } from '../actions'
import AssetSearch, { type SelectedAsset } from './AssetSearch'

type Account = { id: string; name: string; owner: string; type: string }
type Asset = { id: string; name: string; symbol: string | null; asset_class: string; currency: string }

const TX_TYPES = [
  { value: 'buy', label: '매수' },
  { value: 'sell', label: '매도' },
  { value: 'dividend', label: '배당' },
  { value: 'deposit', label: '입금' },
  { value: 'withdraw', label: '출금' },
  { value: 'interest', label: '이자' },
]

export default function TransactionForm({
  accounts,
  assets,
}: {
  accounts: Account[]
  assets: Asset[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [txType, setTxType] = useState('buy')
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')

  const needsAsset = ['buy', 'sell', 'dividend'].includes(txType)
  const currency = selectedAsset?.currency ?? 'KRW'
  const total = parseFloat(qty || '0') * parseFloat(price || '0')
  const showTotal = needsAsset && selectedAsset && total > 0

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (needsAsset && !selectedAsset) {
      setError('종목을 선택해 주세요')
      return
    }

    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        if (needsAsset && selectedAsset?.mode === 'new') {
          await createAssetAndTransaction(fd)
        } else {
          await createTransaction(fd)
        }
        router.push('/')
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date */}
      <div>
        <label className="block text-xs text-[#9c9484] mb-1">날짜 *</label>
        <input
          name="date"
          type="date"
          defaultValue={new Date().toISOString().split('T')[0]}
          required
          className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
        />
      </div>

      {/* Account */}
      <div>
        <label className="block text-xs text-[#9c9484] mb-1">계좌 *</label>
        <select
          name="account_id"
          required
          className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
        >
          <option value="">계좌 선택</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.owner === 'spouse' ? '[아내] ' : '[나] '}{a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Transaction type */}
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

      {/* Asset search */}
      {needsAsset && (
        <div>
          <label className="block text-xs text-[#9c9484] mb-1">종목 *</label>
          <AssetSearch existing={assets} onSelect={setSelectedAsset} />

          {/* Hidden fields for form submission */}
          {selectedAsset?.mode === 'existing' && (
            <>
              <input type="hidden" name="asset_id" value={selectedAsset.id} />
              <input type="hidden" name="currency" value={selectedAsset.currency} />
            </>
          )}
          {selectedAsset?.mode === 'new' && (
            <>
              <input type="hidden" name="asset_name" value={selectedAsset.name} />
              <input type="hidden" name="asset_symbol" value={selectedAsset.symbol} />
              <input type="hidden" name="asset_class" value={selectedAsset.assetClass} />
              <input type="hidden" name="asset_currency" value={selectedAsset.currency} />
              <input type="hidden" name="currency" value={selectedAsset.currency} />
            </>
          )}
        </div>
      )}

      {/* Quantity + Price */}
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
              placeholder="0"
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
              placeholder="0"
              className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
            />
          </div>
        </div>
      )}

      {/* Total preview */}
      {showTotal && (
        <div className="bg-[#e8f4ee] border border-[#c5dece] rounded-lg px-3 py-2 text-xs text-[#1c6b4a] font-medium">
          예상 총액: {currency === 'KRW' ? '₩' : '$'}{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <span className="text-[#3d9970] ml-1">({qty}주 × {Number(price).toLocaleString()})</span>
        </div>
      )}

      {/* Cash amount (for non-asset transactions) */}
      {!needsAsset && (
        <div>
          <label className="block text-xs text-[#9c9484] mb-1">금액 (원) *</label>
          <input
            name="cash_amount"
            type="number"
            step="any"
            min="0"
            required
            placeholder="0"
            className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
          />
        </div>
      )}

      {/* FX rate */}
      {needsAsset && currency === 'USD' && (
        <div>
          <label className="block text-xs text-[#9c9484] mb-1">거래 당시 USD/KRW 환율 *</label>
          <input
            name="fx_rate"
            type="number"
            step="any"
            min="1"
            required
            placeholder="예: 1350.50"
            className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
          />
          <p className="text-[10px] text-[#b5aa98] mt-1">원화 투자원가와 환차손익 계산에 고정 사용됩니다.</p>
        </div>
      )}
      {(!needsAsset || currency === 'KRW') && <input type="hidden" name="fx_rate" value="1" />}

      {/* Fee */}
      <div>
        <label className="block text-xs text-[#9c9484] mb-1">수수료</label>
        <input
          name="fee"
          type="number"
          step="any"
          min="0"
          defaultValue="0"
          className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a]"
        />
      </div>

      {/* Memo */}
      <div>
        <label className="block text-xs text-[#9c9484] mb-1">메모</label>
        <textarea
          name="memo"
          placeholder="매매 이유, 감상 등..."
          rows={2}
          className="w-full text-sm bg-white border border-[#e3d9c4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c6b4a] resize-none"
        />
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#1c6b4a] hover:bg-[#165638] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
      >
        {pending ? '저장 중…' : '거래 저장'}
      </button>
    </form>
  )
}
