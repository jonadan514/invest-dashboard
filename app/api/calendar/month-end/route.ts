import { buildMonthEndCalendar } from '@/lib/calc/reminder'

// 접근 비밀번호 쿠키가 있어야 받을 수 있다(proxy.ts). 일정에는 개인 금액 정보가 들어가지 않는다.
export function GET(request: Request) {
  const url = new URL(request.url)
  const host = request.headers.get('host')
  if (host) url.host = host
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
  return new Response(buildMonthEndCalendar(url.origin, today), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="month-end-record.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
