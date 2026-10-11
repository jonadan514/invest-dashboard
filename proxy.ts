import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_COOKIE_NAME, isAccessConfigured, verifyAccessToken } from '@/lib/access/session'

const PUBLIC_PATHS = new Set(['/access', '/api/access/unlock'])

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) return '/'
  return value
}

function redirectWithinApp(request: NextRequest, path: string) {
  // Proxy redirects require an absolute URL. Keep the incoming host.
  const origin = new URL(request.url)
  const host = request.headers.get('host')
  if (host) origin.host = host
  return NextResponse.redirect(new URL(path, origin))
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value
  const hasAccess = verifyAccessToken(token)

  if (pathname === '/login') {
    return redirectWithinApp(request, hasAccess ? '/' : '/access')
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === '/access' && hasAccess) {
      return redirectWithinApp(request, safeNextPath(request.nextUrl.searchParams.get('next')))
    }
    return NextResponse.next()
  }

  if (hasAccess) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '접근 비밀번호가 필요합니다.' }, { status: 401 })
  }

  const accessUrl = new URL('/access', request.url)
  accessUrl.searchParams.set('next', `${pathname}${search}`)
  if (!isAccessConfigured()) accessUrl.searchParams.set('error', 'config')
  return redirectWithinApp(request, accessUrl.pathname + accessUrl.search)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
