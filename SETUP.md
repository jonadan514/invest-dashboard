# 🌿 우리집 투자 대시보드 — 셋업 가이드

## 현재 백엔드 구조

이 앱은 별도 Supabase 프로젝트를 만들지 않고 기존 공용 프로젝트를 사용한다.

- Supabase 역할: `personal-backend`
- Project ref: `njigeztkkeuvfltqtrad`
- Project URL: `https://njigeztkkeuvfltqtrad.supabase.co`
- 투자용 테이블: `accounts`, `assets`, `transactions`, `prices`, `fx_rates`, `balances`
- 투자용 6개 테이블은 RLS가 활성화되어 있으며 사용자별 정책이 적용되어 있다.
- `apartment-radar`는 별도 Supabase 프로젝트로 유지한다.

기존 `supabase/migrations/001_init.sql`은 최초 단독 프로젝트 구축 당시의 스키마 참고용이다.
공용 프로젝트에는 투자용 스키마가 이미 생성되어 있으므로 다시 실행할 필요가 없다.

## 1. 환경변수 연결

프로젝트 루트의 `.env.local`에 다음 값을 넣는다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://njigeztkkeuvfltqtrad.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=Supabase_Dashboard에서_복사한_publishable_key
```

Publishable key 위치:

`Supabase Dashboard → personal-backend 프로젝트 → Settings → API Keys → Publishable key`

최신 Supabase 권장 방식에 맞춰 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 사용한다.
기존 로컬 환경에 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 남아 있어도 현재 코드는 임시 호환한다.

> `.env.local`은 Git에 커밋하지 않는다.

## 2. 로그인 계정

이 앱의 로그인은 공용 Supabase 프로젝트의 Authentication 사용자를 사용한다.

예전에 별도 `Asset Management Dashboard` 프로젝트에서만 사용하던 로그인 계정은
공용 프로젝트와 별개의 Auth 사용자다. 공용 프로젝트에 존재하는 계정으로 로그인해야 한다.

투자 데이터는 각 로그인 사용자의 `auth.uid()` 기준으로 분리된다.

## 3. 실행

```bash
cd C:\Users\JYH\projects\invest-dashboard
npm install
npm run dev
```

브라우저에서:

`http://localhost:3000`

접속 후 로그인한다.

## 4. 현재 구성

```text
GitHub: invest-dashboard
        │
        ▼
Supabase: personal-backend
        │
        ├── family / schedule tables
        │
        └── investment
            ├── accounts
            ├── assets
            ├── transactions
            ├── prices
            ├── fx_rates
            └── balances

Supabase: apartment-radar
        └── 부동산 전용 데이터
```

## 5. 배포

현재 연결된 Vercel 계정에는 `invest-dashboard` 프로젝트가 아직 없다.
추후 Vercel에 배포할 때도 동일한 두 환경변수를 Production / Preview에 등록한다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://njigeztkkeuvfltqtrad.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## 보안 메모

투자용 테이블은 RLS가 활성화되어 있다.

공용 프로젝트의 기존 family/schedule 테이블 중 일부는 앱 동작을 위해 현재 RLS가 비활성화된 상태다.
따라서 publishable key를 공개 저장소에 하드코딩하지 않고 환경변수로 관리한다.
