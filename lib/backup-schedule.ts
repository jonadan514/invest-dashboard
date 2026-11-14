import { createHash, timingSafeEqual } from 'node:crypto'

/** 저장소에 남기는 자동·수동 백업 개수. 주 1회 기준 약 3개월. */
export const BACKUP_KEEP_COUNT = 12

const NAME_PATTERN = /^backup-(\d{4}-\d{2}-\d{2})-(\d{6})\.json$/

/** 한국 시간 기준 backup-YYYY-MM-DD-HHmmss.json. 이름순 정렬이 곧 시간순이다. */
export function backupFileName(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]))
  return `backup-${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}${parts.second}.json`
}

export function isBackupFileName(name: string) {
  return NAME_PATTERN.test(name)
}

/** 파일 이름에서 한국 시간 표시용 문자열을 만든다. */
export function backupLabel(name: string) {
  const match = NAME_PATTERN.exec(name)
  if (!match) return name
  const [, date, time] = match
  return `${date} ${time.slice(0, 2)}:${time.slice(2, 4)}`
}

/** 최신 keep개를 남기고 지울 백업 이름. 형식이 다른 파일은 건드리지 않는다. */
export function backupsToDelete(names: string[], keep = BACKUP_KEEP_COUNT) {
  return names.filter(isBackupFileName).sort().reverse().slice(Math.max(keep, 1))
}

/** Vercel Cron이 보내는 Authorization: Bearer <CRON_SECRET>을 확인한다. 비밀값이 없으면 항상 거부한다. */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !authorization) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))
}
