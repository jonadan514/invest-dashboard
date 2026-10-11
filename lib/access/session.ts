import { createHmac, timingSafeEqual } from 'node:crypto'

export const ACCESS_COOKIE_NAME = 'saemhunho_access'
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

const TOKEN_VERSION = 'v1'
const SIGNING_CONTEXT = 'saemhunho-household-dashboard'

function getAccessPassword() {
  return process.env.DASHBOARD_ACCESS_PASSWORD ?? ''
}

function getSigningKey() {
  const serverSecret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serverSecret) return null

  return createHmac('sha256', serverSecret).update(SIGNING_CONTEXT).digest()
}

function digest(value: string, key: Buffer) {
  return createHmac('sha256', key).update(value).digest()
}

function encode(value: Buffer) {
  return value.toString('base64url')
}

export function isAccessConfigured() {
  return getAccessPassword().length >= 10 && getSigningKey() !== null
}

export function verifyAccessPassword(candidate: string) {
  const expected = getAccessPassword()
  const key = getSigningKey()
  if (expected.length < 10 || !key || candidate.length > 256) return false

  const candidateDigest = digest(candidate, key)
  const expectedDigest = digest(expected, key)
  return timingSafeEqual(candidateDigest, expectedDigest)
}

export function createAccessFingerprint(value: string) {
  const key = getSigningKey()
  if (!key) return null
  return encode(digest(`access-attempt:${value}`, key))
}

export function createAccessToken(now = Date.now()) {
  const password = getAccessPassword()
  const key = getSigningKey()
  if (password.length < 10 || !key) {
    throw new Error('DASHBOARD_ACCESS_PASSWORD 또는 Supabase 서버 키가 설정되지 않았습니다.')
  }

  const expiresAt = Math.floor(now / 1000) + ACCESS_COOKIE_MAX_AGE
  const payload = `${TOKEN_VERSION}.${expiresAt}`
  const signature = encode(digest(`${payload}.${password}`, key))
  return `${payload}.${signature}`
}

export function verifyAccessToken(token: string | undefined, now = Date.now()) {
  if (!token) return false

  const password = getAccessPassword()
  const key = getSigningKey()
  if (password.length < 10 || !key) return false

  const [version, expiresAtText, suppliedSignature, ...rest] = token.split('.')
  if (rest.length > 0 || version !== TOKEN_VERSION || !expiresAtText || !suppliedSignature) return false

  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false

  const payload = `${version}.${expiresAtText}`
  const expectedSignature = digest(`${payload}.${password}`, key)

  let supplied: Buffer
  try {
    supplied = Buffer.from(suppliedSignature, 'base64url')
  } catch {
    return false
  }

  return supplied.length === expectedSignature.length && timingSafeEqual(supplied, expectedSignature)
}
