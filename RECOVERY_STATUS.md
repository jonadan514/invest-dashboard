# Asset Management Recovery Status

Canonical source snapshot:

- Vercel deployment: `dpl_CaDft12jiovHiYNoV5Be7aUkoCxc`
- Original deployment date: 2026-09-09
- Current production alias: `https://samhunho.vercel.app`
- Production must remain pointed at the original Vercel snapshot until Git recovery is complete.

## Recovery branch

`restore/vercel-2026-09-09`

## Current recovery status

- Canonical tracked source paths in Vercel snapshot: 113
- Original paths currently present in recovery branch: 67
- Missing original paths: 46

The Vercel connector can list all source files and retrieve small files exactly, but currently truncates longer file contents. Do not recreate truncated files manually; recover them byte-for-byte from the canonical deployment.

## Missing paths

```text
USER_GUIDE.md
app/access/page.tsx
app/assets/AssetRow.tsx
app/assets/page.tsx
app/budget/PlanSettingsForm.tsx
app/children/ChildAssetManager.tsx
app/children/ChildGiftManager.tsx
app/children/ChildGiftWorkspace.tsx
app/children/actions.ts
app/dividends/page.tsx
app/guide/page.tsx
app/holdings/page.tsx
app/loading.tsx
app/net-worth/NetWorthChart.tsx
app/net-worth/NetWorthItemEditor.tsx
app/net-worth/NetWorthManager.tsx
app/net-worth/actions.ts
app/settings/SettingsClient.tsx
app/transactions/actions.ts
app/transactions/page.tsx
components/BrandLockup.tsx
components/DashboardOverview.tsx
components/FinancialPlanProgress.tsx
lib/access/session.ts
lib/calc/account-snapshots.ts
lib/calc/child-gifts.ts
lib/calc/child-valuation.ts
pnpm-lock.yaml
public/saemhunho-logo-transparent.png
public/saemhunho-logo.jpg
public/saemhunho-logo.png
scripts/remove_logo_background.py
scripts/start-local.ps1
scripts/stop-local.ps1
supabase/migrations/002_complete_finance_features.sql
supabase/migrations/003_financial_plan_settings.sql
supabase/migrations/006_household_net_worth.sql
supabase/migrations/008_data_stability.sql
supabase/migrations/009_account_monthly_snapshots.sql
supabase/migrations/010_balance_sheet_account_flow.sql
supabase/migrations/20260902022903_child_gift_tracking.sql
supabase/migrations/20260902033839_classify_child_gift_deposits.sql
supabase/migrations/20260902133902_child_account_monthly_valuation.sql
supabase/migrations/20260908150040_household_data_integrity.sql
supabase/migrations/20260909004844_optimize_existing_rls_indexes.sql
tests/finance-calculations.test.ts
```

## Safety rules

1. Do not merge this branch until the canonical source has been fully recovered.
2. Do not replace the original FAMILY OFFICE / Asset Management UI with recreated UI.
3. Do not point production at GitHub until the recovery diff is complete and CI passes.
4. Do not modify or reset the dedicated Supabase project while recovering source.
5. Invest-only routes can be removed only after the original Asset Management source is safely preserved in Git.
