# Deployment and domain audit — 2026-10-05 13:23 KST

## Required end state

Keep only the original Asset Management / FAMILY OFFICE application, with its original UI and /access shared-password authentication. Do not treat master as the source of truth. Preserve the 2026-09-09 snapshot before removing Invest-only functionality. No database or migration deletion is authorized.

## Verified mappings

| Entry | Deployment | Git/source | Visible login |
| --- | --- | --- | --- |
| samhunho.vercel.app | dpl_CaDft12jiovHiYNoV5Be7aUkoCxc | 2026-09-09 CLI upload; metadata e572a289 | FAMILY OFFICE /access, shared password |
| asset-management-dashboard.vercel.app | dpl_CaDft12jiovHiYNoV5Be7aUkoCxc | same canonical snapshot | Alias mapping verified; UI not separately visited |
| jfamily.vercel.app | dpl_CaDft12jiovHiYNoV5Be7aUkoCxc | same canonical snapshot | Alias mapping verified; UI not separately visited |
| invest-dashboard-orpin.vercel.app | dpl_7N286AGqktN7J3DhNnZV39XjFL7Y | master b2d746eb71cfedf4d7d351b52cc9b0eafb02ea95 | /login, Supabase email/password |
| asset-management-dashboard-jyh438190-2515s-projects.vercel.app | dpl_7N286AGqktN7J3DhNnZV39XjFL7Y | same master deployment | Alias mapping verified |
| asset-management-dashboard-git-master-jyh438190-2515s-projects.vercel.app | dpl_7N286AGqktN7J3DhNnZV39XjFL7Y | same master deployment | Alias mapping verified |

Both principal login screens were visited directly and showed different applications. The uploaded Vercel Overview screenshot names the master deployment and the invest-dashboard-orpin domain; it does not show the canonical CLI snapshot.

The project name is asset-management-dashboard, but renaming the project has not unified these existing domain assignments. The metadata of the old canonical deployment includes historical aliases; the current alias listing is authoritative for present domain targets.

## Source findings

Master's app/login/page.tsx calls supabase.auth.signInWithPassword({ email, password }) and displays a newly written Asset Management login page. Master does not implement the required original /access login. Its sidebar and pages also differ from the source snapshot. This is a follow-up Asset Management rewrite, not evidence that its UI is the original, and the old domain name alone does not prove all its visible content remains Invest.

The original snapshot itself includes transactions, holdings, dividends, asset/search, XIRR and rebalancing code. Recovery and cleanup must be two separate commits/stages so the source snapshot can be independently verified and preserved.

Current recovery remains incomplete: 45 of 113 known tracked source files are hash-verified, 46 are missing, and 22 differ. Deeper source paths are not fully enumerated. The original package-lock is not restored; npm ci fails due to dependency mismatch. The network policy blocks CLI Vercel API authentication/retrieval, while the source connector truncates long file contents.

## Authentication and environment status

The canonical /access submission returned error=password for the supplied password during the previous live check. Environment-variable and runtime-log reads are denied by connector permissions. The user said they deleted a setting because it was not the correct one, but the exact key deleted has not been verified; do not assume which variable it was or recreate it with a guessed value.

Project environment changes do not update already-created deployments. A new password must be set for a new validated Asset Management deployment, without exposing it in Git or chat. Keep Supabase data and existing tables intact.

## Ordered implementation

1. Complete exact recovery into restore/vercel-2026-09-09 and preserve an immutable canonical snapshot/commit.
2. Create a separate cleanup branch/commit from that verified snapshot.
3. Remove Invest-only routes, components, calculations and imports. Inspect shared account, budget, pension, children and valuation dependencies before deleting anything. Preserve all original source migration files; do not execute destructive schema changes.
4. Keep the original FAMILY OFFICE brand, layout, /access page and DASHBOARD_ACCESS_PASSWORD model. Do not introduce the master's Supabase email login.
5. Validate installation, build, lint/tests and every Asset Management screen in Preview.
6. After the user reviews the completed Preview, coordinate a single production deployment and domain configuration. Make samhunho the main address; retire or redirect the old invest domain, and ensure the Vercel Visit entry opens the validated Asset Management application.
7. Do not merge master, redeploy, change aliases, change passwords, or remove original source/data during this audit.

## Audit actions

Read-only Vercel deployment/project/alias/deployment-list queries, live viewing of the two login pages, and Git source inspection. Only recovery-branch documentation was written. No production setting or database mutation occurred.
