/**
 * 서버 액션 결과. 운영 빌드의 Next.js는 서버 액션에서 던진 오류 문구를 감추므로,
 * 사용자에게 보여 줄 안내문은 결과에 담아 돌려준다. 이 파일은 브라우저에서도 쓴다.
 */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

/** 실패 결과를 브라우저 쪽 Error로 바꾼다. 기존 try/catch가 같은 안내문을 그대로 보여 줄 수 있다. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}
