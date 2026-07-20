# 🌿 우리집 투자 대시보드 — 셋업 가이드 (Phase 0)

> 설계 문서: `/home/jyh/plans/투자대시보드_설계.md` (v1.2) · 구글 드라이브 동일본
> 화면 목업: 드라이브 `투자대시보드_목업_v1.2.html`

## 1회만 하면 되는 준비

### ① Supabase 프로젝트 만들기 (5분)
1. https://supabase.com 가입 → **New Project** (무료 플랜)
   - Name: `invest-dashboard`, Region: `Northeast Asia (Seoul)`
   - Database Password는 따로 메모
2. 프로젝트 생성되면 **SQL Editor** 열기
   → 이 저장소의 `supabase/migrations/001_init.sql` 내용 전체 복사·붙여넣기 → **Run**
   → 테이블 6개(accounts, assets, transactions, prices, fx_rates, balances) 생성됨
3. **Authentication → Users → Add user → Create new user**
   - 부부 공용 계정 1개: 이메일 + 비밀번호 입력 (Auto Confirm 체크)

### ② 환경변수 연결
1. Supabase **Settings → API**에서 두 값 복사:
   - Project URL
   - anon public key
2. 프로젝트 루트에 `.env.local` 파일 생성 (`.env.example` 참고):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

### ③ 의존성 설치 & 실행 (Windows 터미널에서)
```bash
cd C:\Users\JYH\projects\invest-dashboard
npm install
npm run dev
```
→ http://localhost:3000 접속 → 로그인 화면 → ①-3에서 만든 계정으로 로그인
→ "Phase 0 완료" 화면이 보이면 성공 ✅

## 현재 구성 (Phase 0)
```
app/
  page.tsx              로그인 확인 후 자리표시 대시보드
  login/page.tsx        로그인 화면 (베이지+다크그린 테마)
  auth/signout/route.ts 로그아웃
lib/supabase/
  client.ts             브라우저용 Supabase 클라이언트
  server.ts             서버 컴포넌트용 클라이언트
middleware.ts           세션 갱신 + 미로그인 차단
supabase/migrations/
  001_init.sql          DB 스키마 (테이블 6개 + RLS)
```

## 다음 단계
- **Phase 1**: 계좌·종목·거래 CRUD → 보유 집계 → 평가액 표시 + CSV 내보내기
- **Phase 2**: 시세 자동 (업비트 → Finnhub → KIS → 환율)
- **Phase 3**: XIRR 수익률, 자산추이 차트
- **Phase 4**: 매매일지·배당·연금현황(나/아내 인별)·리밸런싱 배지
- 배포: Vercel 연결은 Phase 1 끝나고 (env 변수 동일하게 등록)

## 참고
- Next.js 16에서 `middleware.ts` 이름 변경(deprecation) 경고가 보이면:
  파일명을 `proxy.ts`로, 함수명을 `proxy`로 바꾸면 됩니다.
