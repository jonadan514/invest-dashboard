# Asset Management Dashboard

이 앱의 소스 저장소와 로컬 폴더 이름은 `invest-dashboard`입니다. 동기화 기준으로 확인한 배포는 `https://invest-dashboard-249znm7dr-jyh438190-2515s-projects.vercel.app/access`이며, 가족 공용 비밀번호와 자산 편집 기능을 유지합니다.

부부의 계좌, 거래, 자산배분, 연금, 배당과 월별 가계 재무계획을 한곳에서 관리하는 개인용 대시보드입니다.

실제 입력 순서와 항목별 의미는 [사용 가이드](./USER_GUIDE.md)를 참고하세요.

## 기술 구성

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL, 서버 전용 Secret API Key
- Upbit, Yahoo Finance, Finnhub, Frankfurter 시세/환율 연동

## 주요 기능

- 계좌 및 종목 관리
- 매수·매도·배당·입출금 거래 원장
- 거래 당시 환율·수수료·세금을 반영한 이동평균 원가와 실현/미실현 손익
- 자산배분과 리밸런싱 알림
- 월별 공금·성과급 배분 및 비상금 추적
- 월 1회 직접 입력하는 가족 자산·부채와 순자산 추이
- 부부별 연금저축·IRP 세액공제 현황
- 배당 현금흐름
- 예적금·대출 잔액 이력
- 거래 내역 CSV 내보내기
- 계좌·거래·월간 기록·순자산·설정을 포함한 전체 JSON 백업 및 복원

## 로컬 실행

1. [SETUP.md](./SETUP.md)에 따라 Supabase 스키마와 환경변수를 준비합니다.
2. 의존성을 설치하고 개발 서버를 실행합니다.

```powershell
npm.cmd ci
npm.cmd run dev
```

기본 주소는 `http://127.0.0.1:3000`입니다. 실행 스크립트가 루프백 주소에만 바인딩되므로 같은 네트워크의 다른 기기에서는 접속할 수 없습니다.

이 앱은 회원가입 없이 가족 공용 비밀번호로 보호됩니다. `DASHBOARD_ACCESS_PASSWORD`를 10자 이상으로 설정하면 인증 쿠키가 해당 기기에서 30일간 유지됩니다. Supabase Secret API Key와 공용 비밀번호는 서버에서만 사용되고 브라우저 번들에는 포함되지 않습니다.

## Vercel 배포

Vercel의 Production 환경에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DASHBOARD_ACCESS_PASSWORD`를 등록합니다. `FINNHUB_API_KEY`는 미국 주식 자동 시세를 사용할 때만 추가합니다. Preview 환경에는 운영 Supabase 비밀키를 등록하지 않는 것을 권장합니다.

## 검사

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

계산 회귀 테스트는 해외 거래 환율과 비용, 같은 날 거래 순서, 과거 환율 누락, 월말 계좌 기록과 자녀 자산 평가를 확인합니다. 과거 USD 거래의 `fx_rate=1`은 실제 환율이 없는 기록으로 처리하며 현재 환율을 대신 사용합니다. 정확한 원화 원가와 손익이 필요하면 거래 수정 화면에서 당시 환율을 입력하세요.

공용 Supabase 연결과 단독 프로젝트 연결을 모두 지원합니다. 추가 투자 테이블과 RPC의 `invest_` 접두사는 서버에서 변환하며, 상세 설정은 [SETUP.md](./SETUP.md)를 참고하세요. 소스 동기화만으로 DB 마이그레이션이 자동 적용되지는 않습니다.

목표 자산배분, 월 소득, 목표 마일스톤과 재무 기준은 Supabase에 저장됩니다. 이전 버전의 브라우저 설정은 설정 화면을 처음 열 때 자동으로 이전됩니다.
