# 셋업 가이드

## Asset Management Dashboard 전용 연결

연결 대상은 기존 전용 Supabase 프로젝트 `hibkysovkhcehfalzdag`입니다. 가족 공용 비밀번호 로그인과 기존 자산 편집 기능을 그대로 사용합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://hibkysovkhcehfalzdag.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your-dedicated-project-server-key
SUPABASE_HOUSEHOLD_USER_ID=your-dedicated-project-user-uuid
DASHBOARD_ACCESS_PASSWORD=your-family-password-at-least-10-characters
```

URL, 서버 키와 가구 사용자 ID는 모두 전용 프로젝트의 값이어야 합니다. 기존 기록의 `user_id`에 해당하는 Auth 사용자 ID를 사용하세요. 다른 프로젝트의 사용자 ID를 유지하면 기록이 비어 보이거나 저장이 실패할 수 있습니다. 이 앱은 서버에서만 DB에 접근하므로 publishable key는 필요하지 않습니다.

2026-10-14 점검에서 전용 DB의 기본 테이블 19개, 앱에서 사용하는 RPC 5개, 기존 계좌·순자산·자녀 기록과 해당 소유자 연결을 확인했습니다. 이 프로젝트에는 필요한 구조가 이미 있으므로 초기화 SQL이나 마이그레이션 전체를 다시 실행하지 않습니다. 이 점검은 실제 서버 키를 이용한 앱 조회·저장 검증과는 별개입니다.

`.env.local` 변경 후 로컬 서버를 재시작하세요. 서버 키가 바뀌면 기존 접근 쿠키가 무효화되므로 `/access`에서 공용 비밀번호를 다시 입력해야 합니다. Vercel에는 동일한 전용 연결값을 Production 환경변수로 등록한 뒤 새로 배포합니다. 로컬 설정 변경만으로 기존 배포 설정은 바뀌지 않습니다.

## 이전 공용 Supabase 연결 (호환용)

2026-10-19 보완 버전의 계좌 상태 이력·수동 대출 잔액 재계산은 전용 DB용 `20261019012423_atomic_net_worth_mortgage_replay.sql`, `20261019012632_preserve_account_activity_history.sql`을 순서대로 적용한 환경을 사용합니다. 두 파일에는 공용 DB 오적용 방지 검사가 있습니다. 현재 전용 운영 DB에는 적용·검증을 마쳤으며, 다른 DB에 마이그레이션 폴더 전체를 실행하지 마세요.

이전 공용 연결은 `https://njigeztkkeuvfltqtrad.supabase.co`입니다. 이 DB를 별도로 사용할 때만 아래 설정을 따릅니다. 가족 공용 비밀번호 로그인은 유지하고, 서버의 `SUPABASE_SECRET_KEY`와 `SUPABASE_HOUSEHOLD_USER_ID`로 투자 데이터를 조회합니다. `.env.local`은 Git에서 제외되어야 합니다.

기본 투자 테이블 6개(`accounts`, `assets`, `transactions`, `prices`, `fx_rates`, `balances`)는 그대로 사용합니다. 추가 재무·자녀 테이블 13개와 RPC 5개는 `invest_` 접두사를 사용하며, 서버 연결 코드가 기존 논리 이름을 변환합니다. 가족 앱의 `public.children`과 투자 앱의 `public.invest_children`은 별도 테이블입니다. 백업 파일의 논리 이름은 유지합니다.

공용 프로젝트에 적용한 SQL은 `supabase/shared-project/account-types.sql`, `supabase/shared-project/app-objects.sql`에 보관합니다. 두 SQL은 해당 순서로 원격 마이그레이션에 이미 적용되었습니다. 재실행하면 기존 투자 전용 객체를 보호하기 위해 중단합니다. **공용 프로젝트에 아래의 기존 단독 프로젝트 마이그레이션을 일괄 적용하지 마세요.**

공용 연결 환경변수:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://njigeztkkeuvfltqtrad.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-public-key
SUPABASE_SECRET_KEY=sb_secret_your-server-key
SUPABASE_HOUSEHOLD_USER_ID=your-user-uuid
DASHBOARD_ACCESS_PASSWORD=your-family-password-at-least-10-characters
```

브라우저 접속 주소는 `http://127.0.0.1:3000/access`입니다. 같은 PC의 다른 앱이 `localhost:3000`을 사용하고 있으므로 IP 주소를 사용하세요. 기존 프로젝트의 투자 기록은 자동으로 복사되지 않습니다.

## 기존 단독 프로젝트 설정

`supabase/migrations/002_shared_backend_sync.sql`은 GitHub의 공용 DB 이전 버전에서 추가된 SQL입니다. 같은 번호의 `002_complete_finance_features.sql`과 용도가 다르므로 전체 폴더를 자동 적용하지 말고, 사용 중인 DB에 맞는 위의 공용 연결 또는 아래의 단독 연결 절차를 따르세요.

GitHub의 전용 DB 대안 SQL은 `supabase/reference/002_asset_management_sync.sql`에 참고용으로 보관합니다. 소스 동기화 과정에서 이 SQL을 운영 DB에 적용하지 않습니다. 실제 연결은 배포 환경변수 또는 로컬 `.env.local`의 값을 따릅니다.

## 1. Supabase 프로젝트 준비

1. Supabase에서 프로젝트를 생성합니다.
2. 기존 데이터의 소유자를 나타낼 Supabase Auth 사용자를 하나 생성합니다. 앱에서 로그인할 때 쓰는 계정은 아니며 데이터의 `user_id` 연결을 유지하는 용도입니다.
3. SQL Editor에서 아래 마이그레이션을 번호 순서대로 실행합니다.

   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_complete_finance_features.sql`
   - `supabase/migrations/003_financial_plan_settings.sql`
   - `supabase/migrations/004_optimize_financial_plan_rls.sql`
   - `supabase/migrations/005_document_financial_plan_semantics.sql`
   - `supabase/migrations/006_household_net_worth.sql`
   - `supabase/migrations/007_net_worth_item_terms.sql`
   - `supabase/migrations/008_data_stability.sql`

위 목록은 초기 기능 단계의 SQL이며, 이후의 자녀·접근 보호·백업 복원 관련 변경 전체를 포함하지 않습니다. 기존 프로젝트는 적용 이력과 실제 구조를 비교해 필요한 변경만 적용하세요. `001_init.sql`이 있다는 이유만으로 `002_complete_finance_features.sql`만 실행하면 최신 앱과 맞는다고 가정하지 마세요. 이 저장소에는 공용 DB용 SQL도 섞여 있으므로 마이그레이션 폴더 전체를 일괄 실행하지 않습니다.

생성되는 주요 테이블은 다음과 같습니다.

- `accounts`: 투자·연금·예적금·대출 계좌
- `assets`: 종목 마스터
- `transactions`: 거래 원장
- `prices`, `fx_rates`: 시세와 환율 캐시
- `balances`: 예적금·대출 잔액 이력
- `monthly_budgets`: 월별 가계 재무계획
- `financial_plan_settings`: 가계 재무계획 기준값과 단계별 배분 비율
- `net_worth_items`, `net_worth_snapshots`: 가족 자산·부채 항목과 월별 순자산 기록

기존 RLS 정책은 유지됩니다. 로컬 Next.js 서버는 Secret API Key로 연결하고 모든 쿼리를 가계 사용자 ID로 제한합니다.

## 2. 환경변수 설정

프로젝트 루트에 `.env.local`을 만들고 다음 값을 입력합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your-secret-key
DASHBOARD_ACCESS_PASSWORD=10자-이상의-가족-공용-비밀번호
FINNHUB_API_KEY=your-finnhub-key
```

Secret API Key는 Supabase Dashboard의 **Settings → API Keys → Secret keys**에서 생성하거나 복사할 수 있습니다. 기존 프로젝트의 legacy `service_role` 키도 `SUPABASE_SERVICE_ROLE_KEY` 이름으로 사용할 수 있지만 새 Secret API Key가 권장됩니다.

Secret API Key에는 `NEXT_PUBLIC_` 접두사를 붙이지 말고 Git에 커밋하지 마세요. 이 키는 RLS를 우회할 수 있으므로 서버 전용입니다.

Supabase Auth 사용자가 정확히 한 명이면 앱이 해당 ID를 자동으로 사용합니다. 사용자가 여러 명이면 아래 값을 추가합니다.

```dotenv
SUPABASE_HOUSEHOLD_USER_ID=사용할-사용자-UUID
```

`FINNHUB_API_KEY`가 없으면 미국 주식 자동 시세 조회만 생략됩니다. 국내 주식, 코인과 환율 조회에는 필요하지 않습니다.

## 3. 설치 및 실행

Windows PowerShell에서는 실행 정책 충돌을 피하기 위해 `npm.cmd`를 사용할 수 있습니다.

```powershell
cd C:\Users\JYH\projects\invest-dashboard
npm.cmd install
npm.cmd run dev
```

브라우저에서 `http://127.0.0.1:3000`으로 접속합니다. 공용 비밀번호를 한 번 입력하면 해당 기기에서 30일간 유지됩니다. 개발·운영 스크립트 모두 `127.0.0.1`에만 바인딩됩니다.

## 4. 운영 전 확인

```powershell
npm.cmd run lint
npm.cmd run build
```

Supabase 마이그레이션은 저장소에 추가될 뿐 자동으로 원격 DB에 반영되지는 않습니다. Supabase CLI를 연결하지 않은 환경에서는 SQL Editor에서 직접 적용해야 합니다.
