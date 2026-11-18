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
  const value = typeof raw === 'string' ? Number(raw.replace(/,/g, '')) : NaN
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}은(는) 0 이상의 유효한 숫자여야 합니다.`)
  return value
}

function dateField(form: FormData) {
  const date = form.get('date')
  const timestamp = typeof date === 'string' ? Date.parse(`${date}T00:00:00Z`) : NaN
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) throw new Error('올바른 거래 날짜를 입력해 주세요.')
  return date
}

function fxField(form: FormData, currency: string) {
  const fx_rate = currency === 'KRW' ? 1 : numberField(form, 'fx_rate', '환율')
  if (fx_rate <= 0 || (currency === 'USD' && fx_rate < 100)) throw new Error('올바른 거래 당시 환율을 입력해 주세요.')
  return fx_rate
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
  // new_asset_id가 있으면 같은 통화의 다른 종목으로 옮긴다(잘못 고른 종목·중복 종목 정리용).
  const rawNewAsset = form.get('new_asset_id')
  const targetAssetId = needsAsset && typeof rawNewAsset === 'string' && rawNewAsset ? rawNewAsset : stored.asset_id
  if (needsAsset && (!stored.asset_id || !asset || asset.id !== targetAssetId || asset.user_id !== userId)) {
    throw new Error('연결된 종목을 확인할 수 없습니다. 종목을 선택하여 새 거래로 등록해 주세요.')
  }
  if (needsAsset && asset!.id !== stored.asset_id && asset!.currency !== stored.currency) {
    throw new Error('원화 종목과 달러 종목 사이로는 거래를 옮길 수 없어요. 같은 통화의 종목을 골라 주세요.')
  }
  if (!needsAsset && stored.asset_id) {
    throw new Error('현금 거래에 종목이 연결되어 있습니다. 금액과 통화를 확인하여 새 거래로 등록해 주세요.')
  }

  const date = dateField(form)

  const currency = needsAsset ? asset!.currency : stored.currency
  const isTrade = type === 'buy' || type === 'sell'
  const quantity = isTrade ? numberField(form, 'quantity', '수량') : null
  const price = isTrade ? numberField(form, 'price', '단가') : null
  if (isTrade && (quantity! <= 0 || price! <= 0)) throw new Error('매수·매도 수량과 단가는 0보다 커야 합니다.')
  // Dividends are cash proceeds, including imported rows without quantity/price.
  const amount = isTrade ? quantity! * price! : numberField(form, 'cash_amount', '금액')
  if (!Number.isFinite(amount)) throw new Error('거래 금액이 너무 큽니다.')
  const fx_rate = fxField(form, currency)

  return { date, type, asset_id: needsAsset ? asset!.id : null, currency, quantity, price, amount,
    fee: numberField(form, 'fee', '수수료', 0), tax: numberField(form, 'tax', '세금', 0), fx_rate }
}

export const CREATE_TRANSACTION_TYPES = ['buy', 'sell', 'dividend', 'deposit', 'withdraw', 'interest'] as const
export const SUPPORTED_CURRENCIES = ['KRW', 'USD'] as const
export const ASSET_CLASSES = ['kr_stock', 'us_stock', 'etf_kr', 'etf_us', 'crypto', 'deposit', 'other'] as const

type OwnedAccount = { id: string; user_id: string }
type InsertAsset = { id?: string; currency: string; user_id?: string }

/**
 * 새 거래 등록 입력을 서버에서 검증한다. 수정 경로(buildTransactionUpdate)와 같은 규칙을 쓰며,
 * 종목 거래의 통화는 폼 값이 아니라 종목에 저장된 통화를 따른다.
 * asset.id가 없으면 같은 요청에서 새로 만들 종목으로 보고 소유자 검증을 건너뛴다.
 */
export function buildTransactionInsert(
  account: OwnedAccount | null, asset: InsertAsset | null, userId: string, form: FormData,
) {
  const accountId = form.get('account_id')
  if (!account || account.user_id !== userId || account.id !== accountId) throw new Error('계좌를 확인할 수 없습니다.')

  const type = form.get('type')
  if (typeof type !== 'string' || !(CREATE_TRANSACTION_TYPES as readonly string[]).includes(type)) {
    throw new Error('올바른 거래 유형을 선택해 주세요.')
  }
  const needsAsset = isAssetTransaction(type)
  if (needsAsset) {
    if (!asset) throw new Error('종목을 선택해 주세요.')
    if (asset.id !== undefined && (asset.user_id !== userId || asset.id !== form.get('asset_id'))) {
      throw new Error('연결된 종목을 확인할 수 없습니다.')
    }
  }

  const date = dateField(form)
  const rawCurrency = needsAsset ? asset!.currency : (form.get('currency') || 'KRW')
  if (typeof rawCurrency !== 'string' || !(SUPPORTED_CURRENCIES as readonly string[]).includes(rawCurrency)) {
    throw new Error('지원하지 않는 통화입니다.')
  }
  const currency = rawCurrency
  // 매수·매도는 수량×단가, 배당과 현금 거래는 받은(보낸) 총액을 입력한다.
  const isTrade = type === 'buy' || type === 'sell'
  const quantity = isTrade ? numberField(form, 'quantity', '수량') : null
  const price = isTrade ? numberField(form, 'price', '단가') : null
  if (isTrade && (quantity! <= 0 || price! <= 0)) throw new Error('수량과 단가는 0보다 커야 합니다.')
  const amount = isTrade ? quantity! * price! : numberField(form, 'cash_amount', '금액')
  if (!Number.isFinite(amount)) throw new Error('거래 금액이 너무 큽니다.')
  if (!isTrade && amount <= 0) throw new Error('금액은 0보다 커야 합니다.')

  return { user_id: userId, date, account_id: account.id, asset_id: needsAsset ? (asset!.id ?? null) : null,
    type, quantity, price, amount, currency, fx_rate: fxField(form, currency),
    fee: numberField(form, 'fee', '수수료', 0), tax: numberField(form, 'tax', '세금', 0) }
}

/** 거래 등록 화면에서 새로 만드는 종목의 입력을 검증한다. */
export function buildNewAsset(userId: string, form: FormData) {
  const name = form.get('asset_name')
  if (typeof name !== 'string' || !name.trim() || name.length > 200) throw new Error('종목 이름을 확인해 주세요.')
  const rawSymbol = form.get('asset_symbol')
  const symbol = typeof rawSymbol === 'string' && rawSymbol.trim() ? rawSymbol.trim() : null
  if (symbol && symbol.length > 64) throw new Error('종목 코드를 확인해 주세요.')
  const asset_class = form.get('asset_class')
  if (typeof asset_class !== 'string' || !(ASSET_CLASSES as readonly string[]).includes(asset_class)) {
    throw new Error('자산군을 확인해 주세요.')
  }
  const currency = form.get('asset_currency') || 'KRW'
  if (typeof currency !== 'string' || !(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
    throw new Error('지원하지 않는 통화입니다.')
  }
  return { user_id: userId, name: name.trim(), symbol, asset_class, currency, price_source: 'manual' as const }
}
