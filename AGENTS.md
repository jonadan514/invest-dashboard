<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 작업 방식 (사용량 절약)

이 저장소는 개인용 가족 자산 대시보드다. 사용량 한도를 아끼도록 아래를 기본으로 따른다.

## 확인은 필요한 만큼만
- 기본 확인: `npm test`, `npm run lint`, `npm run build`. 한 번에 묶어 실행하고 결과는 통과/실패 요약만 본다.
- 브라우저·가짜 Supabase로 화면을 띄우는 확인은 화면이 크게 바뀔 때나 사용자가 요청할 때만 한다.
- 스크린샷은 꼭 필요할 때 1장까지. 문구·로직만 바뀌면 찍지 않는다.
- 문서만 바뀌면 빌드·테스트를 생략한다.

## 읽기는 좁게
- 파일 전체를 읽기 전에 `grep`으로 위치를 찾고 필요한 줄만 읽는다.
- 이미 대화에 있는 내용은 다시 읽지 않는다.

## 한 번에 끝까지
- "만들고 PR 머지까지", "머지까지 해줘"처럼 요청하면 중간 확인 질문 없이 구현 → 커밋·푸시 → PR → 검사 통과 확인 → 스쿼시 머지 → 배포 확인까지 진행한다.
- 검사·배포 대기는 15초 이상 간격으로 확인하고, 중간 상태는 출력하지 않는다.
- 결정이 꼭 필요한 경우가 아니면 질문 대신 합리적인 기본값을 고르고 보고에 적는다.

## 보고는 짧게
- 무엇을 했는지, 사용자가 확인할 것 1~3가지만 적는다.

## 사람 쪽 권장 (참고)
- 기능마다 새 세션을 시작한다. 긴 대화는 매 요청마다 앞 내용을 다시 처리해 사용량이 크게 늘어난다.
- 문구 수정·PR 머지 같은 단순 작업은 가벼운 모델(Sonnet)로 충분하다. `/model`로 바꿀 수 있다.
- 요청을 묶어서 한 번에 준다. 예: "종목 정렬 추가하고 머지까지 해줘, 스크린샷은 빼고".
