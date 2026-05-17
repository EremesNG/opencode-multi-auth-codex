# Tasks: Dashboard Two-Section UX Redesign

> TDD-first is mandatory for this change. Every navigation or UX change starts with failing focused tests, existing `/api/*` contracts stay frozen unless an additive backend adjustment becomes strictly necessary, and NO production build, pack, or publish dry-run is part of this plan.

## Phase 1: Freeze scope and create failing redesign coverage
- [x] 1.1 Preserve the current dashboard API contract before changing the UI composition — `tests/integration/dashboard-api-contract.test.ts`, `src/web.ts`
  **Verification**:
  - Run: `pnpm run test:integration:dashboard-contract`
  - Expected: The existing dashboard state, settings, force-mode, logs, account, and queue-related API contracts remain green and fail on contract drift.

- [x] 1.2 Add failing 2-section navigation, command palette, and accessibility coverage for the new IA — `web/src/components/__tests__/AppShell.test.tsx`, `web/src/components/__tests__/CommandSearch.test.tsx`, `web/src/components/__tests__/AccessibilityShell.test.tsx`, `tests/web-headless/dashboard-two-section-nav.test.ts`, `web/src/App.tsx`, `web/src/components/AppShell.tsx`, `web/src/components/CommandSearch.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/AppShell.test.tsx web/src/components/__tests__/CommandSearch.test.tsx web/src/components/__tests__/AccessibilityShell.test.tsx && pnpm test -- tests/web-headless/dashboard-two-section-nav.test.ts`
  - Expected: Tests fail first against the current 4-area model, then assert Dashboard and Settings as the only primary destinations, command search no longer exposes Overview/Accounts/Configuration/Operations as top-level commands, and landmark/keyboard navigation remains correct in the 2-section shell.

- [x] 1.3 Add failing legacy-route transition coverage for every current top-level path — `tests/web-headless/dashboard-legacy-route-redirects.test.ts`, `web/src/components/__tests__/AppShell.test.tsx`, `web/src/App.tsx`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-legacy-route-redirects.test.ts && pnpm --dir web test -- web/src/components/__tests__/AppShell.test.tsx`
  - Expected: Tests define and fail on the required redirect matrix before implementation: `/` stays the canonical Dashboard route, `/accounts` redirects to `/`, `/operations` redirects to `/`, `/configuration` redirects to `/settings`, and `/antigravity` redirects to `/settings/antigravity` when enabled or `/settings` when disabled.

## Phase 2: Establish the canonical Dashboard shell and collapse routing
- [x] 2.1 Create `DashboardPage.tsx` as the canonical `/` route shell before collapsing navigation, with failing coverage that proves it can host embedded Overview, Accounts, and Operations regions — `web/src/components/DashboardPage.tsx`, `web/src/components/__tests__/DashboardPage.test.tsx`, `web/src/App.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/DashboardPage.test.tsx && pnpm --dir web typecheck`
  - Expected: A new Dashboard page component exists as the intended `/` route target, tests fail first until the shell is wired, and the file shape is ready to absorb Overview/Accounts/Operations content without requiring a production build.

- [x] 2.2 Replace the current four top-level routes with the approved two-section route model and implement the full legacy redirect matrix — `web/src/App.tsx`, `web/src/components/AppShell.tsx`, `web/src/components/DashboardPage.tsx`, `web/src/components/OverviewPage.tsx`, `web/src/components/AccountsPage.tsx`, `web/src/components/OperationsPage.tsx`, `web/src/components/ConfigurationPage.tsx`, `web/src/components/AntigravityPage.tsx`, `web/src/main.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/AppShell.test.tsx web/src/components/__tests__/DashboardPage.test.tsx && pnpm test -- tests/web-headless/dashboard-two-section-nav.test.ts tests/web-headless/dashboard-legacy-route-redirects.test.ts && pnpm --dir web typecheck`
  - Expected: `DashboardPage` becomes the canonical component for `/`, `ConfigurationPage` becomes the canonical Settings surface at `/settings`, `AntigravityPage` lives under `/settings/antigravity`, standalone `/accounts` and `/operations` routes redirect to `/`, `/configuration` redirects to `/settings`, `/antigravity` redirects to `/settings/antigravity` when enabled or `/settings` when disabled, and `OverviewPage`/`AccountsPage`/`OperationsPage` are no longer exposed as primary top-level destinations.

- [x] 2.3 Relocate Antigravity into a concrete Settings subsection and preserve discoverability from navigation shortcuts — `web/src/components/ConfigurationPage.tsx`, `web/src/components/AntigravityPage.tsx`, `web/src/components/AppShell.tsx`, `web/src/components/CommandSearch.tsx`, `web/src/components/__tests__/ConfigurationPage.test.tsx`, `web/src/components/__tests__/CommandSearch.test.tsx`, `web/src/components/__tests__/AccessibilityShell.test.tsx`, `tests/web-headless/dashboard-legacy-route-redirects.test.ts`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/ConfigurationPage.test.tsx web/src/components/__tests__/CommandSearch.test.tsx web/src/components/__tests__/AccessibilityShell.test.tsx && pnpm test -- tests/web-headless/dashboard-legacy-route-redirects.test.ts`
  - Expected: Antigravity is documented and implemented as a Settings subsection at `/settings/antigravity`, remains reachable when the feature flag is enabled, is absent from primary nav when disabled, and the legacy `/antigravity` route redirects without breaking access to the feature.

- [x] 2.4 Consolidate configuration ownership under Settings, including force mode, sticky sessions, presets/weights, and advanced Antigravity controls — `web/src/components/ConfigurationPage.tsx`, `web/src/components/StickySessionPanel.tsx`, `web/src/components/AntigravityPage.tsx`, `web/src/components/__tests__/ConfigurationPage.test.tsx`, `web/src/components/__tests__/StickySessionPanel.test.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/ConfigurationPage.test.tsx web/src/components/__tests__/StickySessionPanel.test.tsx`
  - Expected: Settings becomes the canonical home for configuration, force mode, sticky sessions, presets, account-weight editing, and Antigravity administration without changing existing settings semantics.

## Phase 3: Build the merged Dashboard workspace
- [x] 3.1 Flesh out the `DashboardPage` workspace so it composes the existing Overview, Accounts, and Operations surfaces into one operator experience instead of separate top-level pages — `web/src/components/DashboardPage.tsx`, `web/src/components/OverviewPage.tsx`, `web/src/components/AccountsPage.tsx`, `web/src/components/OperationsPage.tsx`, `web/src/components/__tests__/DashboardPage.test.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/DashboardPage.test.tsx && pnpm --dir web typecheck`
  - Expected: `DashboardPage` renders health summary, quick actions, queue/login/system-health visibility, and embedded Overview/Accounts/Operations regions from one primary workspace without restoring those routes as separate primary destinations.

- [x] 3.2 Add per-account quota/status cards to the Dashboard workspace using the current dashboard state data surface — `web/src/components/DashboardPage.tsx`, `web/src/components/AccountsPage.tsx`, `web/src/components/__tests__/DashboardPage.test.tsx`, `tests/web-headless/dashboard-account-quota-cards.test.ts`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/DashboardPage.test.tsx && pnpm test -- tests/web-headless/dashboard-account-quota-cards.test.ts`
  - Expected: Every account is visible from Dashboard with status, quota bars, confidence/state cues, and actionable controls driven by existing `DashboardState.accounts[]` data.

## Phase 4: Remove duplicated workflows and preserve account parity
- [x] 4.1 Move add-account to a single Dashboard account workspace entry point and remove the duplicate Overview action — `web/src/components/DashboardPage.tsx`, `web/src/components/AccountsPage.tsx`, `web/src/components/OverviewPage.tsx`, `web/src/components/CreateAccountModal.tsx`, `web/src/components/__tests__/DashboardPage.test.tsx`, `web/src/components/__tests__/OverviewPage.test.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/DashboardPage.test.tsx web/src/components/__tests__/OverviewPage.test.tsx`
  - Expected: Account creation is initiated from one canonical Dashboard workflow, and the old duplicate add-account action is no longer exposed from Overview.

- [x] 4.2 Preserve account management parity inside the merged Dashboard workspace for search, filters, switch, re-auth, refresh, enable/disable, remove, tags, and notes — `web/src/components/AccountsPage.tsx`, `web/src/components/AccountDrawer.tsx`, `web/src/components/__tests__/AccountsPage.test.tsx`, `tests/web-headless/dashboard-parity-accounts.test.ts`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/AccountsPage.test.tsx && pnpm test -- tests/web-headless/dashboard-parity-accounts.test.ts`
  - Expected: High-risk account lifecycle actions still work after the Dashboard merge and remain guarded by focused component plus headless parity checks.

## Phase 5: Embed logs and observability into Dashboard
- [x] 5.1 Refactor logs and operational observability out of the standalone Operations route into a Dashboard panel, drawer, or in-page section — `web/src/components/DashboardPage.tsx`, `web/src/components/OperationsPage.tsx`, `web/src/components/__tests__/OperationsPage.test.tsx`, `tests/web-headless/dashboard-logs-panel.test.ts`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/OperationsPage.test.tsx && pnpm test -- tests/web-headless/dashboard-logs-panel.test.ts`
  - Expected: Logs, queue visibility, and global operational feedback remain reachable from Dashboard without a separate Operations top-level route.

- [x] 5.2 Keep queue, login progress, sync status, and system-health signals visibly consolidated in the merged operator surface — `web/src/components/DashboardPage.tsx`, `web/src/components/OverviewPage.tsx`, `web/src/components/__tests__/DashboardPage.test.tsx`, `tests/web-headless/dashboard-parity-overview.test.ts`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/DashboardPage.test.tsx && pnpm test -- tests/web-headless/dashboard-parity-overview.test.ts`
  - Expected: The merged Dashboard keeps live operational signals visible and actionable without forcing operators into Settings or hidden flows.

## Phase 6: Regression hardening and visual QA
- [x] 6.1 Run focused static and automated regression checks for the two-section redesign, including command search, accessibility, and legacy redirects — `web/src/App.tsx`, `web/src/components/*`, `tests/web-headless/*.test.ts`
  **Verification**:
  - Run: `pnpm --dir web typecheck && pnpm --dir web test -- web/src/components/__tests__/AppShell.test.tsx web/src/components/__tests__/CommandSearch.test.tsx web/src/components/__tests__/AccessibilityShell.test.tsx web/src/components/__tests__/DashboardPage.test.tsx web/src/components/__tests__/ConfigurationPage.test.tsx && pnpm run test:web:headless`
  - Expected: Frontend type safety, component coverage, route-transition coverage, command palette coverage, accessibility assertions, and headless dashboard regressions all pass without invoking any production build.

- [x] 6.2 Execute final visual QA against the local Vite dev experience at `http://localhost:5173/` and confirm the two-section UX is coherent — `web/src/components/AppShell.tsx`, `web/src/components/DashboardPage.tsx`, `web/src/components/ConfigurationPage.tsx`, `web/src/components/AntigravityPage.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/AppShell.test.tsx web/src/components/__tests__/DashboardPage.test.tsx web/src/components/__tests__/ConfigurationPage.test.tsx web/src/components/__tests__/CommandSearch.test.tsx web/src/components/__tests__/AccessibilityShell.test.tsx`
  - Expected: Automated checks pass, and with local dev available at `http://localhost:5173/`, manual QA confirms Dashboard/Settings navigation clarity, quota-card readability, logs discoverability, duplicate-action removal, Antigravity discoverability inside Settings, and safe behavior for legacy links.
