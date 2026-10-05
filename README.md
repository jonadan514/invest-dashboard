# Asset Management Dashboard

가계의 **순자산, 투자계좌, 거래, 저축, 부채, 연금**을 한곳에서 관리하는 개인용 자산관리 대시보드입니다.

이 저장소는 과거 `Invest Dashboard`라는 이름으로 사용됐지만, 현재 기준 제품은 **Asset Management Dashboard** 하나만 유지합니다.

## 역할

- **Asset Management Dashboard**: 실제 가계 자산·부채·현금흐름·투자성과 기록
- **AlphaDesk**: 시장/종목 분석과 투자 판단
- **AI Briefing Bot**: 외부 투자정보 수집·요약

## 백엔드

전용 Supabase 프로젝트만 사용합니다.

```text
Asset Management Dashboard
Project ref: hibkysovkhcehfalzdag
Project URL: https://hibkysovkhcehfalzdag.supabase.co
```

공용 `personal-backend` 프로젝트는 이 앱의 운영 백엔드로 사용하지 않습니다.

## 주요 기능

| 영역 | 기능 |
|---|---|
| 대시보드 | 자산 현황, 투자성과, 저축 현황 |
| 계좌 | 본인/배우자 계좌, 현금·예적금·투자·부채 |
| 거래 | 매수, 매도, 입금, 출금, 배당, 이자 |
| 보유종목 | 원가, 현재가, 평가액, 수익률, 자산배분 |
| 재무계획 | 공금, 성과급, 비상금, 주담대 상환 기록 |
| 연금 | 본인/배우자 연금계좌 현황 |
| 배당/일지 | 배당 현금흐름, 거래 메모와 복기 |

## 핵심 데이터

```text
accounts
assets
transactions
prices
fx_rates
balances
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

현재 프론트엔드가 직접 사용하는 핵심 원장은 `accounts`, `assets`, `transactions`, `prices`, `fx_rates`, `balances`, `monthly_budgets`입니다. 나머지 Asset Management 전용 테이블은 순자산·가계목표·자녀자산 기능 확장에 사용합니다.

## 계산 원칙

### 거래 원장이 단일 입력원

```text
transactions
  ↓
보유수량 / 이동평균 원가
  ↓
현재 평가액
  ↓
미실현손익 / 실현손익 / XIRR
```

### XIRR

포트폴리오 외부 현금흐름만 사용합니다.

- `deposit`: 외부 → 투자계좌
- `withdraw`: 투자계좌 → 외부
- 매수·매도·배당·이자·수수료: 포트폴리오 내부 흐름
- 현재 포트폴리오 평가액: 최종 현금흐름

### 해외자산

거래 당시 환율로 원가를 고정하고 현재 환율은 평가액 계산에 사용합니다.

## 기술 구조

```text
Next.js 16 / React 19
        │
        ▼
Supabase Auth + Data API
        │
        ▼
Asset Management Dashboard
hibkysovkhcehfalzdag
```

## 로컬 실행

```bash
npm install
npm run dev
```

필수 환경변수:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hibkysovkhcehfalzdag.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
FINNHUB_API_KEY=...
```

자세한 연결 방법은 [SETUP.md](SETUP.md)를 참고하세요.

## 검증

```bash
npm run build
npm run lint
```
