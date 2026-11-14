# Asset Management Dashboard

이 앱의 소스 저장소와 로컬 폴더 이름은 `invest-dashboard`입니다. 운영 주소는 `https://invest-dashboard-orpin.vercel.app`(Vercel 프로젝트 `asset-management-dashboard`의 Production 도메인)이며, 가족 공용 비밀번호와 자산 편집 기능을 유지합니다.

부부의 계좌, 자산·부채, 연금, 자녀 증여와 월별 가계 재무계획을 월 1회 기록으로 한곳에서 관리하는 개인용 대시보드입니다.

실제 입력 순서와 항목별 의미는 [사용 가이드](./USER_GUIDE.md)를 참고하세요.

## 기술 구성

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL, 서버 전용 Secret API Key

## 주요 기능

- 계좌 관리와 계좌별 월말 평가금액 기록
- 월별 공금·성과급 배분 및 비상금 추적
- 월 1회 직접 입력하는 가족 자산·부채와 순자산 추이
- 부부별 연금저축·IRP 세액공제 현황
- 자녀 계좌와 증여 한도 관리
- 가족 목표 진행률과 달성 예상 시점, 전월 대비 순자산 변화 요인
- 월 소득 대비 저축률과 최근 6개월 추이
- 연말 연금 세액공제 남은 한도·주당 필요 납입액 알림(10~12월)
- 주택담보대출 완납 예상 시점과 추가 상환 효과 시뮬레이션
- 연간 결산 리포트(인쇄·PDF 저장)
- 월말 기록 알림 배너와 휴대폰 캘린더용 매월 반복 알림(.ics)
- 계좌·월간 기록·순자산·설정을 포함한 전체 JSON 백업 및 복원
- 이전 거래 원장 데이터의 CSV 내보내기

종목별 매수·매도 거래 원장, 보유종목·배당 화면과 시세 연동은 월 1회 기록 방식으로 전환하면서 제거했습니다. DB의 `assets`, `transactions` 데이터는 삭제하지 않았으며 전체 백업과 거래 CSV로 계속 내보낼 수 있습니다.

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

Vercel의 Production 환경에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_HOUSEHOLD_USER_ID`, `DASHBOARD_ACCESS_PASSWORD`를 등록합니다. 배포 대상은 전용 Asset Management Dashboard DB(`hibkysovkhcehfalzdag`)이며, URL·서버 키·사용자 ID는 모두 이 프로젝트의 값을 사용합니다. Preview 환경에는 운영 Supabase 비밀키를 등록하지 않는 것을 권장합니다.

## 검사

계좌 비활성화·재활성화는 월별 이력으로 보존하며, 현재 실적에는 미래 월 기록을 포함하지 않습니다. 과거 주담대 잔액을 정정하면 이후 자동 잔액을 함께 재계산합니다. 전체 백업 복원은 거래 메모와 계좌 상태 이력을 보존합니다. 이 기능의 전용 DB 마이그레이션은 [SETUP.md](./SETUP.md)를 참고하세요.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

계산 회귀 테스트는 월말 계좌 기록, 연금 세액공제, 자녀 자산 평가, 백업 복원, 대시보드 목표·순자산 변화 요인, 저축률, 연금 연말 한도, 대출 상환, 연간 결산과 월말 알림 계산을 확인합니다.

전용 Asset Management Dashboard DB는 접두사 없는 테이블과 RPC를 사용합니다. 이전 공용 Supabase 연결도 호환되지만, 공용 DB의 키나 사용자 ID를 전용 DB에 섞어 쓰면 안 됩니다. 상세 설정은 [SETUP.md](./SETUP.md)를 참고하세요. 소스 동기화만으로 DB 마이그레이션이 자동 적용되지는 않습니다.

월 소득, 목표 마일스톤과 재무 기준은 Supabase에 저장됩니다. 이전 버전의 브라우저 설정은 설정 화면을 처음 열 때 자동으로 이전됩니다.
