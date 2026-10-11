import { NextResponse } from 'next/server'
import {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_COOKIE_NAME,
  createAccessFingerprint,
  createAccessToken,
  isAccessConfigured,
  verifyAccessPassword,
} from '@/lib/access/session'
import { createClient } from '@/lib/supabase/server'

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) return '/'
  return value
}

function accessRedirect(request: Request, error: 'config' | 'password' | 'rate', nextPath: string, retryAfter = 0) {
  const url = new URL('/access', request.url)
  url.searchParams.set('error', error)
  url.searchParams.set('next', nextPath)
  if (retryAfter > 0) url.searchParams.set('retry', String(retryAfter))
  const response = new NextResponse(null, { status: 303, headers: { Location: url.pathname + url.search } })
  if (retryAfter > 0) response.headers.set('Retry-After', String(retryAfter))
  return response
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const password = formData.get('password')
  const nextPath = safeNextPath(formData.get('next'))

  if (!isAccessConfigured()) return accessRedirect(request, 'config', nextPath)
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const fingerprint = createAccessFingerprint(`${address}|${request.headers.get('user-agent') ?? 'unknown'}`)
  const supabase = createClient()
  if (fingerprint) {
    const { data: retryAfter, error } = await supabase.rpc('dashboard_access_retry_after', {
      p_fingerprint: fingerprint,
    })
    if (!error && Number(retryAfter) > 0) {
      return accessRedirect(request, 'rate', nextPath, Number(retryAfter))
    }
  }
  if (typeof password !== 'string' || !verifyAccessPassword(password)) {
    await new Promise(resolve => setTimeout(resolve, 450))
    if (fingerprint) {
      const { data: retryAfter } = await supabase.rpc('record_dashboard_access_failure', {
        p_fingerprint: fingerprint,
      })
      if (Number(retryAfter) > 0) return accessRedirect(request, 'rate', nextPath, Number(retryAfter))
    }
    return accessRedirect(request, 'password', nextPath)
  }

  if (fingerprint) {
    await supabase.rpc('clear_dashboard_access_failures', { p_fingerprint: fingerprint })
  }

  const response = new NextResponse(null, { status: 303, headers: { Location: nextPath } })
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: createAccessToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
    priority: 'high',
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
