import { unstable_rethrow } from 'next/navigation'

/**
 * 서버 액션 결과. 운영 빌드는 서버 액션에서 던진 오류 문구를 감추므로
 * 사용자에게 보여 줄 안내 문구는 던지지 않고 결과로 돌려준다.
 */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }

/**
 * 액션 본문을 실행하고, 던진 오류를 `{ ok: false, error }`로 바꾼다.
 * 본문이 객체를 돌려주면 성공 결과에 그 값을 합친다.
 */
export async function runAction<T extends object = object>(
  task: () => Promise<T | void>,
  fallback = '저장하지 못했습니다.',
): Promise<ActionResult<T>> {
  try {
    const value = await task()
    return { ok: true, ...(value ?? {}) } as ActionResult<T>
  } catch (error) {
    // 접근 확인의 redirect('/access') 같은 Next.js 내부 신호는 그대로 다시 던진다.
    unstable_rethrow(error)
    const message = error instanceof Error && error.message ? error.message : fallback
    return { ok: false, error: message }
  }
}
