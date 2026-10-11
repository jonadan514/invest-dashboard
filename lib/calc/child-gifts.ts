import type { ChildGiftDeposit, ChildGiftRelationship, ChildProfile } from '@/lib/types'

export const MINOR_GIFT_DEDUCTION = 20_000_000
export const ADULT_GIFT_DEDUCTION = 50_000_000
export const OTHER_RELATIVE_GIFT_DEDUCTION = 10_000_000

export interface GiftDeductionBucket {
  relationship: ChildGiftRelationship
  limit: number
  used: number
  remaining: number
  overage: number
  percent: number
  nextReleaseDate: string | null
}

export interface ChildGiftStatus {
  age: number
  isMinor: boolean
  directAscendant: GiftDeductionBucket
  otherRelative: GiftDeductionBucket
  nonRelativeAmount: number
  taxableInWindow: number
  nonTaxableInWindow: number
  totalDeposited: number
}

export function calculateChildGiftStatus(
  child: ChildProfile,
  gifts: ChildGiftDeposit[],
  asOf: string,
): ChildGiftStatus {
  const asOfDate = parseDate(asOf)
  const age = fullYearsBetween(parseDate(child.birth_date), asOfDate)
  const isMinor = age < 19
  const cutoff = addYears(asOfDate, -10)
  const childGifts = gifts
    .filter(gift => gift.child_id === child.id)
  const relevant = childGifts
    .filter(gift => {
      const date = parseDate(gift.gift_date)
      return date > cutoff && date <= asOfDate
    })
    .sort((a, b) => a.gift_date.localeCompare(b.gift_date))
  const taxable = relevant.filter(gift => gift.transfer_type === 'gift')
  const directAscendant = calculateBucket(
    taxable.filter(gift => gift.relationship_category === 'direct_ascendant'),
    'direct_ascendant',
    isMinor ? MINOR_GIFT_DEDUCTION : ADULT_GIFT_DEDUCTION,
  )
  const otherRelative = calculateBucket(
    taxable.filter(gift => gift.relationship_category === 'other_relative'),
    'other_relative',
    OTHER_RELATIVE_GIFT_DEDUCTION,
  )
  const nonRelativeAmount = taxable
    .filter(gift => gift.relationship_category === 'non_relative')
    .reduce((sum, gift) => sum + Number(gift.amount), 0)
  const taxableInWindow = taxable.reduce((sum, gift) => sum + Number(gift.amount), 0)
  const nonTaxableInWindow = relevant
    .filter(gift => gift.transfer_type !== 'gift')
    .reduce((sum, gift) => sum + Number(gift.amount), 0)
  const totalDeposited = childGifts.reduce((sum, gift) => sum + Number(gift.amount), 0)

  return {
    age,
    isMinor,
    directAscendant,
    otherRelative,
    nonRelativeAmount,
    taxableInWindow,
    nonTaxableInWindow,
    totalDeposited,
  }
}

function calculateBucket(
  gifts: ChildGiftDeposit[],
  relationship: ChildGiftRelationship,
  limit: number,
): GiftDeductionBucket {
  const used = gifts.reduce((sum, gift) => sum + Number(gift.amount), 0)
  return {
    relationship,
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    overage: Math.max(used - limit, 0),
    percent: limit > 0 ? Math.min(used / limit * 100, 100) : 0,
    nextReleaseDate: gifts.length > 0 ? formatDate(addYears(parseDate(gifts[0].gift_date), 10)) : null,
  }
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setUTCFullYear(next.getUTCFullYear() + years)
  return next
}

function fullYearsBetween(birth: Date, date: Date) {
  let years = date.getUTCFullYear() - birth.getUTCFullYear()
  const birthdayPassed = date.getUTCMonth() > birth.getUTCMonth()
    || (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() >= birth.getUTCDate())
  if (!birthdayPassed) years -= 1
  return Math.max(years, 0)
}
