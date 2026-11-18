import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_COOKIE_NAME, isAccessConfigured, verifyAccessToken } from '@/lib/access/session'

// /api/cron/backup은 쿠키 대신 CRON_SECRET Bearer 헤더로 직접 인증한다.
const PUBLIC_PATHS = new Set(['/access', '/api/access/unlock', '/api/cron/backup'])

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

  // 서버 액션 요청을 여기서 307로 돌리면 브라우저가 /access로 다시 POST하고 액션은 아무 결과 없이 끝난다.
  // 모든 서버 액션은 getHouseholdContext()에서 접근을 다시 확인하므로, 통과시켜 액션 안의
  // redirect('/access')가 화면을 접근 페이지로 옮기게 한다.
  if (request.method === 'POST' && request.headers.has('next-action')) return NextResponse.next()

  const accessUrl = new URL('/access', request.url)
  accessUrl.searchParams.set('next', `${pathname}${search}`)
  if (!isAccessConfigured()) accessUrl.searchParams.set('error', 'config')
  return redirectWithinApp(request, accessUrl.pathname + accessUrl.search)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
