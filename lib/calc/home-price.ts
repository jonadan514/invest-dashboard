export interface HomePriceTerms {
  category: string
  price_lawd_cd?: string | null
  price_apt_name?: string | null
  price_area?: number | null
}

export interface AptTrade {
  name: string
  area: number
  /** 원 단위 거래금액 */
  amount: number
  date: string
  canceled: boolean
}

/** 실거래가로 매달 금액을 채우는 항목: 시군구 코드·단지명·전용면적이 모두 있는 부동산. */
export function isAutoHomePrice(item: HomePriceTerms) {
  return item.category === 'real_estate'
    && /^\d{5}$/.test(item.price_lawd_cd ?? '')
    && Boolean(item.price_apt_name?.trim())
    && Number(item.price_area) > 0
}

/** 조회할 계약 월(YYYYMM): 기준 월부터 거슬러 count개월. 실거래 신고가 최대 30일 늦어 최근 3개월을 본다. */
export function tradeMonths(throughMonth: string, count = 3) {
  const [year, month] = throughMonth.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1))
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

function decode(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim()
}

function tag(xml: string, ...names: string[]) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
    if (match) return decode(match[1])
  }
  return ''
}

/**
 * 실거래가 API 응답(XML)을 거래 목록으로 바꾼다. 새 영문 태그와 예전 한글 태그를 모두 읽는다.
 * 인증 오류 등 실패 응답이면 메시지와 함께 예외를 던진다.
 */
export function parseAptTrades(xml: string) {
  const authError = tag(xml, 'returnAuthMsg')
  if (authError) throw new Error(`실거래가 API 오류: ${authError}`)
  const code = tag(xml, 'resultCode')
  if (code && !/^0+$/.test(code)) throw new Error(`실거래가 API 오류: ${tag(xml, 'resultMsg') || code}`)

  const trades: AptTrade[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1]
    const amount = Number(tag(item, 'dealAmount', '거래금액').replace(/[^0-9]/g, ''))
    const area = Number(tag(item, 'excluUseAr', '전용면적'))
    const year = tag(item, 'dealYear', '년')
    const month = tag(item, 'dealMonth', '월').padStart(2, '0')
    const day = tag(item, 'dealDay', '일').padStart(2, '0')
    if (!amount || !area) continue
    trades.push({
      name: tag(item, 'aptNm', '아파트'),
      area,
      amount: amount * 10_000,
      date: `${year}-${month}-${day}`,
      canceled: tag(item, 'cdealType', '해제여부').toUpperCase() === 'O',
    })
  }
  return { trades, totalCount: Number(tag(xml, 'totalCount')) || trades.length }
}

export function normalizeAptName(name: string) {
  return name.replace(/[\s()·.\-_]/g, '').toLowerCase()
}

const AREA_TOLERANCE = 1

/**
 * 같은 단지·같은 면적(±1㎡)의 해제되지 않은 거래 중간값을 금액으로 쓴다.
 * 맞는 거래가 없으면 null과 함께, 이름을 고칠 수 있게 비슷한 단지명을 돌려준다.
 */
export function pickHomePrice(trades: AptTrade[], aptName: string, area: number) {
  const target = normalizeAptName(aptName)
  const valid = trades.filter(trade => !trade.canceled)
  const sameApt = valid.filter(trade => normalizeAptName(trade.name) === target)
  const matched = sameApt.filter(trade => Math.abs(trade.area - area) <= AREA_TOLERANCE)
  if (matched.length === 0) {
    const names = sameApt.length > 0
      ? [...new Set(sameApt.map(trade => `${trade.area}㎡`))]
      : [...new Set(valid.map(trade => trade.name).filter(name => {
        const normalized = normalizeAptName(name)
        return target && (normalized.includes(target) || target.includes(normalized))
      }))]
    return { amount: null, count: 0, latestDate: null, suggestions: names.slice(0, 5), sameAptFound: sameApt.length > 0 }
  }
  const amounts = matched.map(trade => trade.amount).sort((a, b) => a - b)
  const middle = Math.floor(amounts.length / 2)
  const amount = amounts.length % 2 ? amounts[middle] : Math.round((amounts[middle - 1] + amounts[middle]) / 2)
  const latestDate = matched.map(trade => trade.date).sort().at(-1) ?? null
  return { amount, count: matched.length, latestDate, suggestions: [] as string[], sameAptFound: true }
}
