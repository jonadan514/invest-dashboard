import 'server-only'

import { unstable_rethrow } from 'next/navigation'
import type { ActionResult } from '@/lib/action-result'

/** 서버 액션 본문을 감싸 오류를 결과로 돌려준다. redirect 같은 Next.js 내부 신호는 그대로 다시 던진다. */
export async function runAction<T>(task: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await task() }
  } catch (error) {
    unstable_rethrow(error)
    console.error('[server-action]', error)
    return { ok: false, error: error instanceof Error ? error.message : '저장하지 못했습니다.' }
  }
}
