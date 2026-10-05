import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_COOKIE_NAME, isAccessConfigured, verifyAccessToken } from '@/lib/access/session'

const PUBLIC_PATHS = new Set(['/access', '/api/access/unlock'])

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value
  const hasAccess = verifyAccessToken(token)

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === '/access' && hasAccess) {
      return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url))
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
  return NextResponse.redirect(accessUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
