# Asset Management Recovery Status

Canonical deployment: `dpl_CaDft12jiovHiYNoV5Be7aUkoCxc` (2026-09-09).
Recovery branch: `restore/vercel-2026-09-09`.

## 2026-10-05 checkpoint — INCOMPLETE / DO NOT MERGE

Production `samhunho.vercel.app` was verified through Vercel deployment lookup to still resolve to the canonical deployment. No production deployment, alias change, database operation, or PR was performed.

### Source inventory and hash audit

- Deployment file listing exposes 118 source files, including 5 generated/local artifacts.
- 113 known tracked source files are enumerated in `recovery/canonical-file-manifest.json`.
- **113 is not the complete deployment source count.** The connector replaces deeper children under accounts, API routes, and transaction routes with `[truncated: maximum depth exceeded]`. A full direct API inventory is still required.
- At the start: 33 files matched the deployment SHA-1, 34 existing files differed, and 46 files were missing. These numbers concern the 113 known tracked files only.
- This checkpoint restores 12 tracked files byte-for-byte. Each restored file's raw-byte SHA-1 equals its Vercel source UID.
- Current known tracked files: 45 verified, 22 different, 46 missing. Deeper omitted paths remain unaudited.
- A tooling artifact (`supabase/.temp/cli-latest`) was downloaded and verified separately, but deliberately not added to Git.

### Recovery methods

Complete, untruncated base64 responses were decoded and checked against Vercel source UIDs. Historical Git blobs were used only when their raw-byte SHA-1 exactly matched the canonical deployment UID. No source was reconstructed from snippets or rewritten.

The contents connector truncates long base64 values. In 114 inspected source/artifact responses, 74 were truncated. The Dashboard Source viewer also did not yield a complete usable export during this attempt. Direct REST responds that an authentication token is required. Vercel CLI 62.2.0 was installed; its device login is still pending, and no CLI credential has been obtained. Complete direct API recovery is blocked on that authentication.

### Exact restorations

- `.env.example`
- `app/accounts/DeleteButton.tsx`
- `app/accounts/page.tsx`
- `app/layout.tsx`
- `app/settings/page.tsx`
- `components/AppShell.tsx`
- `package.json`
- `proxy.ts`
- `tsconfig.json`
- `lib/calc/realized-pnl.ts`
- `lib/calc/holdings.ts`
- `lib/calc/xirr.ts`

### Validation

`npm ci` was attempted and failed with EUSAGE: the canonical `package.json` requires Next.js / eslint-config-next 16.2.9 and lucide-react, but the unrestored lockfile has 16.3.8 and lacks lucide-react. The lockfile was not regenerated, because that would replace the canonical dependency snapshot.

Production build, lint, and the full original tests have not been run: the dependency installation failed and essential source files are missing. Preview deployment and PR have not been created.

Invest routes and calculation modules are retained, including transactions, holdings, dividends, asset/search, XIRR and rebalancing. No Invest cleanup has been performed.

### Remaining known missing files

- `USER_GUIDE.md`
- `app/access/page.tsx`
- `app/assets/AssetRow.tsx`
- `app/assets/page.tsx`
- `app/budget/PlanSettingsForm.tsx`
- `app/children/ChildAssetManager.tsx`
- `app/children/ChildGiftManager.tsx`
- `app/children/ChildGiftWorkspace.tsx`
- `app/children/actions.ts`
- `app/dividends/page.tsx`
- `app/guide/page.tsx`
- `app/holdings/page.tsx`
- `app/loading.tsx`
- `app/net-worth/NetWorthChart.tsx`
- `app/net-worth/NetWorthItemEditor.tsx`
- `app/net-worth/NetWorthManager.tsx`
- `app/net-worth/actions.ts`
- `app/settings/SettingsClient.tsx`
- `app/transactions/actions.ts`
- `app/transactions/page.tsx`
- `components/BrandLockup.tsx`
- `components/DashboardOverview.tsx`
- `components/FinancialPlanProgress.tsx`
- `lib/access/session.ts`
- `lib/calc/account-snapshots.ts`
- `lib/calc/child-gifts.ts`
- `lib/calc/child-valuation.ts`
- `pnpm-lock.yaml`
- `public/saemhunho-logo-transparent.png`
- `public/saemhunho-logo.jpg`
- `public/saemhunho-logo.png`
- `scripts/remove_logo_background.py`
- `scripts/start-local.ps1`
- `scripts/stop-local.ps1`
- `supabase/migrations/002_complete_finance_features.sql`
- `supabase/migrations/003_financial_plan_settings.sql`
- `supabase/migrations/006_household_net_worth.sql`
- `supabase/migrations/008_data_stability.sql`
- `supabase/migrations/009_account_monthly_snapshots.sql`
- `supabase/migrations/010_balance_sheet_account_flow.sql`
- `supabase/migrations/20260902022903_child_gift_tracking.sql`
- `supabase/migrations/20260902033839_classify_child_gift_deposits.sql`
- `supabase/migrations/20260902133902_child_account_monthly_valuation.sql`
- `supabase/migrations/20260908150040_household_data_integrity.sql`
- `supabase/migrations/20260909004844_optimize_existing_rls_indexes.sql`
- `tests/finance-calculations.test.ts`

### Remaining known differing files

- `README.md`
- `SETUP.md`
- `app/accounts/AccountForm.tsx`
- `app/accounts/actions.ts`
- `app/budget/MonthlyForm.tsx`
- `app/budget/actions.ts`
- `app/budget/page.tsx`
- `app/children/page.tsx`
- `app/globals.css`
- `app/net-worth/page.tsx`
- `app/page.tsx`
- `app/pension/page.tsx`
- `app/settings/actions.ts`
- `components/PolarisCard.tsx`
- `components/RebalancingAlert.tsx`
- `components/Sidebar.tsx`
- `components/TrendChart.tsx`
- `lib/calc/budget.ts`
- `lib/labels.ts`
- `lib/supabase/server.ts`
- `lib/types.ts`
- `package-lock.json`

## Continuation

1. Finish Vercel CLI device authentication without sharing credentials in chat.
2. Fetch the complete deployment files tree directly, then fetch every source file by UID. Decode original bytes and validate SHA-1 before restoring.
3. Re-audit all paths, including deep API/transaction/account paths, migrations and logo binaries. Preserve source exactly; do not run database migrations.
4. Run npm ci, production build, lint and original tests after exact source recovery.
5. Deploy Preview only, compare all original screens to the canonical deployment, then create a PR.
6. Do not merge master or alter production until the user reviews the completed result.
