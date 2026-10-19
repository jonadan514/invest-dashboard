export const EDIT_TRANSACTION_TYPES = [
  { value: 'buy', label: '매수' },
  { value: 'sell', label: '매도' },
  { value: 'dividend', label: '배당' },
  { value: 'deposit', label: '입금' },
  { value: 'withdraw', label: '출금' },
  { value: 'interest', label: '이자' },
  { value: 'fee', label: '수수료' },
] as const

export function isAssetTransaction(type: string) {
  return ['buy', 'sell', 'dividend'].includes(type)
}

type StoredTransaction = { type: string; asset_id: string | null; currency: string; user_id: string }
type OwnedAsset = { id: string; currency: string; user_id: string }

function numberField(form: FormData, name: string, label: string, defaultValue?: number) {
  const raw = form.get(name)
  if (raw === null || (typeof raw === 'string' && !raw.trim())) {
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`${label}을(를) 입력해 주세요.`)
  }
  const value = typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}은(는) 0 이상의 유효한 숫자여야 합니다.`)
  return value
}

export function buildTransactionUpdate(
  stored: StoredTransaction | null, asset: OwnedAsset | null, userId: string, form: FormData,
) {
  if (!stored || stored.user_id !== userId) throw new Error('수정할 거래를 찾을 수 없습니다.')
  const type = form.get('type')
  if (typeof type !== 'string' || !EDIT_TRANSACTION_TYPES.some(t => t.value === type)
    || !EDIT_TRANSACTION_TYPES.some(t => t.value === stored.type)) {
    throw new Error('올바른 거래 유형을 선택해 주세요.')
  }
  const needsAsset = isAssetTransaction(type)
  if (needsAsset !== isAssetTransaction(stored.type)) {
    throw new Error('종목 거래와 현금 거래 간 변경은 새 거래로 등록해 주세요.')
  }
  if (needsAsset && (!stored.asset_id || !asset || asset.id !== stored.asset_id || asset.user_id !== userId)) {
    throw new Error('연결된 종목을 확인할 수 없습니다. 종목을 선택하여 새 거래로 등록해 주세요.')
  }
  if (!needsAsset && stored.asset_id) {
    throw new Error('현금 거래에 종목이 연결되어 있습니다. 금액과 통화를 확인하여 새 거래로 등록해 주세요.')
  }

  const date = form.get('date')
  const timestamp = typeof date === 'string' ? Date.parse(`${date}T00:00:00Z`) : NaN
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) throw new Error('올바른 거래 날짜를 입력해 주세요.')

  const currency = needsAsset ? asset!.currency : stored.currency
  const isTrade = type === 'buy' || type === 'sell'
  const quantity = isTrade ? numberField(form, 'quantity', '수량') : null
  const price = isTrade ? numberField(form, 'price', '단가') : null
  if (isTrade && (quantity! <= 0 || price! <= 0)) throw new Error('매수·매도 수량과 단가는 0보다 커야 합니다.')
  // Dividends are cash proceeds, including imported rows without quantity/price.
  const amount = isTrade ? quantity! * price! : numberField(form, 'cash_amount', '금액')
  if (!Number.isFinite(amount)) throw new Error('거래 금액이 너무 큽니다.')
  const fx_rate = currency === 'KRW' ? 1 : numberField(form, 'fx_rate', '환율')
  if (fx_rate <= 0 || (currency === 'USD' && fx_rate < 100)) throw new Error('올바른 거래 당시 환율을 입력해 주세요.')

  return { date, type, asset_id: needsAsset ? stored.asset_id : null, currency, quantity, price, amount,
    fee: numberField(form, 'fee', '수수료', 0), tax: numberField(form, 'tax', '세금', 0), fx_rate }
}
