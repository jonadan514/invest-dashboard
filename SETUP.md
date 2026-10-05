# Asset Management Dashboard — Setup

## 1. 운영 백엔드

이 앱은 **Asset Management Dashboard 전용 Supabase 프로젝트만 사용**합니다.

- Project ref: `hibkysovkhcehfalzdag`
- Project URL: `https://hibkysovkhcehfalzdag.supabase.co`

공용 `personal-backend (njigeztkkeuvfltqtrad)`는 이 앱과 분리합니다.

## 2. 환경변수

프로젝트 루트의 `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hibkysovkhcehfalzdag.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=Supabase_Dashboard에서_복사한_publishable_key

FINNHUB_API_KEY=
KIS_APP_KEY=
KIS_APP_SECRET=
EXIM_API_KEY=
```

Publishable key 위치:

`Supabase Dashboard → Asset Management Dashboard → Settings → API Keys`

> `.env.local`은 Git에 커밋하지 않습니다.

## 3. 로그인

로그인은 Asset Management Dashboard 프로젝트의 Supabase Auth 사용자를 사용합니다.

다른 Supabase 프로젝트의 Auth 사용자는 별개입니다.

## 4. 로컬 실행

```bash
npm install
npm run dev
```

브라우저:

```text
http://localhost:3000
```

## 5. DB 구조

초기 핵심 원장:

```text
accounts
assets
transactions
prices
fx_rates
balances
```

Asset Management 확장:

```text
monthly_budgets
financial_plan_settings
net_worth_items
net_worth_snapshots
household_settings
household_goals
portfolio_snapshots
account_monthly_snapshots
children
child_accounts
child_gift_deposits
child_account_monthly_snapshots
```

## 6. Migration

- `001_init.sql`: 투자 원장 초기 구조
- `002_asset_management_sync.sql`: Asset Management 운영 구조 동기화

운영 DB에 이미 존재하는 객체를 임의로 삭제하거나 재생성하지 않습니다.

## 7. 보안

- public 데이터 테이블은 RLS 사용
- 사용자 데이터는 `auth.uid()` 기준 분리
- 프론트에는 publishable key만 사용
- service role / secret key는 브라우저에 노출하지 않음
