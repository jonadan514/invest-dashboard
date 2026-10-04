# Invest Dashboard

부부의 투자계좌, 보유자산, 거래원장, 투자성과, 월별 저축 계획을 한곳에서 관리하는 개인용 투자 관리 대시보드입니다.

이 프로젝트의 역할은 **"무엇을 살 것인가"를 판단하는 리서치 도구가 아니라, 실제로 무엇을 얼마나 사고팔았고 그 결과가 어땠는지를 기록하는 투자 원장**입니다.

## 역할

- **AlphaDesk**: 시장/종목 분석, 매수 후보와 투자 판단
- **Invest Dashboard**: 실제 계좌, 거래, 자산배분, 성과, 현금흐름 기록
- **AI Briefing Bot**: 외부 투자정보 수집·요약

장기적으로는 AlphaDesk의 판단과 Invest Dashboard의 실제 매매·성과를 연결해 개인 투자 프로세스 자체를 검증하는 구조를 목표로 합니다.

## 핵심 원칙

### 1. 거래 원장이 단일 입력원

현재 보유수량이나 평균단가를 직접 수정하지 않습니다.

```text
transactions
  ↓
보유수량 / 이동평균 원가
  ↓
현재 평가액
  ↓
미실현손익 / 실현손익 / XIRR
```

### 2. 포트폴리오 XIRR은 외부 현금흐름만 사용

전체 포트폴리오 XIRR에서는 계좌 내부의 매수·매도·배당·이자를 현금흐름으로 보지 않습니다.

- `deposit`: 외부 → 투자계좌, 음수 현금흐름
- `withdraw`: 투자계좌 → 외부, 양수 현금흐름
- `buy/sell/dividend/interest/fee`: 포트폴리오 내부 이동이므로 제외
- 현재 포트폴리오 평가액: 최종 양수 현금흐름

이렇게 해야 동일 자금이 입금과 매수에서 이중 계산되지 않습니다.

### 3. 해외자산 원가는 거래 당시 환율로 고정

USD 자산은 매수 당시 `fx_rate`를 원화 원가에 고정 사용합니다.

```text
원화 매수원가
= (수량 × 매수가 + 수수료 + 세금) × 거래 당시 환율
```

현재 환율은 현재 평가액 계산에만 사용합니다.

### 4. 수수료·세금 반영

- 매수: 원가에 수수료·세금 포함
- 매도: 매도대금에서 수수료·세금 차감
- 실현손익: 순매도대금 - 원화 취득원가

### 5. 동일 날짜 거래 순서

같은 날짜의 거래는 `created_at` 순으로 계산합니다.

## 주요 기능

| 영역 | 기능 |
|---|---|
| 대시보드 | 총 평가금액, 투자원금, 미실현/실현손익, XIRR, 저축 현황 |
| 계좌 | 본인/배우자 계좌, 일반·연금·IRP·ISA·코인·예적금·부채 등 |
| 거래 | 매수, 매도, 입금, 출금, 배당, 이자 |
| 보유종목 | 이동평균 원가, 현재가, 평가액, 수익률, 자산배분 |
| 배당 | 배당 거래 집계 |
| 매매일지 | 거래별 메모와 실현손익 복기 |
| 재무계획 | 공금, 성과급, 비상금, 갈아타기/투자 자금 배분 |

## 기술 구조

```text
Next.js 16 / React 19
        │
        ▼
Supabase Auth + Data API
        │
        ▼
personal-backend
├─ accounts
├─ assets
├─ transactions
├─ prices
├─ fx_rates
├─ balances
└─ invest_monthly_budgets
```

- Frontend/Server: Next.js App Router
- Database/Auth: Supabase
- 한국주식/ETF 시세: Yahoo Finance
- 미국주식/ETF 시세: Finnhub
- 가상자산 시세: Upbit
- USD/KRW: Frankfurter
- 시세 캐시: Supabase `prices`, `fx_rates`

## 주요 디렉터리

```text
app/
  accounts/          계좌 관리
  transactions/      거래 입력·수정·조회
  holdings/          보유종목/자산배분
  dividends/         배당
  journal/           매매일지
  budget/            월별 재무계획
  api/               검색/내보내기 API

components/           공용 UI
lib/
  calc/               보유수량, 실현손익, XIRR, 예산 계산
  prices/             외부 시세/환율 수집
  supabase/           Supabase client
  types.ts            핵심 타입

supabase/migrations/
  001_init.sql                    최초 단독 프로젝트 스키마
  002_shared_backend_sync.sql     공용 백엔드 전환 후 동기화
```

## 데이터 모델

### accounts

투자/현금/부채 계좌 단위입니다.

주요 값:
- 소유자: `me | spouse`
- 계좌유형: `general | pension | irp | isa | crypto | savings | debt | cash | mmf`
- 세제혜택 여부
- 예적금/부채용 금리·월납입액·만기
- 비상금 계좌 여부

### assets

종목 마스터입니다.

- 국내/미국 주식
- 국내/미국 ETF
- 가상자산
- 예적금
- 기타

### transactions

투자 계산의 핵심 원장입니다.

```text
date
account_id
asset_id
type
quantity
price
amount
fee
tax
fx_rate
currency
memo
created_at
```

### invest_monthly_budgets

월별 가계 자금배분 기록입니다.

- 공금 저축
- 성과급
- 계획 투입액
- 현금/비상금 잔액
- 주담대 이자·원금·추가상환
- 메모

## Supabase

현재 별도 투자용 Supabase 프로젝트가 아니라 공용 `personal-backend`를 사용합니다.

자세한 연결 방법은 [SETUP.md](SETUP.md)를 참고하세요.

공용 DB에서 투자 관련 테이블은 RLS를 사용하며, 사용자 소유 데이터는 `auth.uid()` 기준으로 분리합니다.

새로운 public 테이블을 추가할 때는 다음 둘을 모두 명시해야 합니다.

1. Data API용 최소 권한 `GRANT`
2. Row Level Security 및 사용자별 정책

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저:

```text
http://localhost:3000
```

필수 환경변수:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
FINNHUB_API_KEY=...
```

## 검증

```bash
npm run build
npm run lint
```

계산 로직을 변경할 때 특히 확인할 항목:

- 매수 후 평균단가
- 일부 매도 후 잔여 원가
- 동일일 매수/매도 순서
- USD 거래 환율
- 수수료·세금 포함 실현손익
- 입출금 기준 XIRR

## 기존 데이터 주의사항

과거 USD 거래 중 `fx_rate=1`로 저장된 데이터는 실제 거래시점 환율이 없는 레거시 데이터입니다.

현재 계산기는 이런 행에 대해서는 임시로 현재 환율을 fallback으로 사용하지만, 정확한 투자원가와 환차손익을 위해 **거래 수정 화면에서 실제 거래 당시 환율을 보정하는 것이 권장됩니다.**

## 현재 범위 밖

아직 별도 계산하지 않는 항목:

- 세법상 실제 양도소득세 계산
- 증권사별 원천징수/세금 자동 대사
- 기업행사에 따른 수량/원가 자동 조정
- 증권사 API 기반 거래 자동수집
- AlphaDesk 판단과 실제 거래의 자동 연결
