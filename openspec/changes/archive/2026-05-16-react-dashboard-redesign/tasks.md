# Tasks: React Dashboard Redesign

> TDD-first and parity-first are mandatory for this change. Every new React/Vite behavior starts RED → GREEN → REFACTOR, existing `/api/*` contracts stay frozen, and NO production build or publish dry-run is executed during this plan without later explicit approval.

## Phase 1: API contract freeze and dashboard inventory acceptance
- [x] 1.1 Capture the current dashboard API contract in focused parity tests — `tests/integration/dashboard-api-contract.test.ts`, `tests/integration/web-server.test.ts`, `src/web.ts`
  **Verification**:
  - Run: `pnpm test -- tests/integration/dashboard-api-contract.test.ts`
  - Expected: Preserved `/api/state`, account, settings, force-mode, logs, sync, refresh, and Antigravity request/response shapes are asserted and fail on drift.

- [x] 1.2 Add dashboard inventory acceptance coverage for the legacy operator surface before any UI rewrite — `tests/web-headless/dashboard-inventory-acceptance.test.ts`, `src/web.ts`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-inventory-acceptance.test.ts`
  - Expected: The existing dashboard proves reachability/visibility for Overview, Accounts, Operations, Configuration, login progress, queue visibility, logs, force mode, Antigravity gating, and account actions that the React UI must preserve.

## Phase 2: React/Vite workspace and fixture-backed server delivery baseline
- [x] 2.1 Scaffold the isolated React/Vite workspace with explicit test/typecheck scripts and typed API foundations — `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/types/api.ts`, `web/src/api/client.ts`
  **Verification**:
  - Run: `pnpm --dir web typecheck`
  - Expected: The new `web/` workspace resolves React/Vite/TypeScript entrypoints and typed API modules without type errors.

- [x] 2.2 Integrate static asset serving from canonical `dist/web/` output with SPA fallback without intercepting `/api/*` routes — `src/web.ts`, `src/index.ts`, `package.json`, `.gitignore`
  **Verification**:
  - Run: `pnpm test -- tests/integration/web-server.test.ts`
  - Expected: Loopback constraints remain intact, `/api/*` handlers keep current behavior, `src/web.ts` serves fixture-backed `dist/web/` assets, and UI route/static-file separation is protected by server tests.

- [x] 2.3 Add fixture-backed headless serving smoke that validates SPA entry delivery while preserving backend JSON routes — `tests/web-headless/dashboard-smoke.test.ts`, `tests/integration/web-server.test.ts`, `tests/fixtures/web-dist/`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-smoke.test.ts`
  - Expected: `/` serves the fixture-backed SPA entry from the canonical `dist/web/` contract and `/api/state` remains available as JSON from the same server runtime.

## Phase 3: Parity migration for Overview, Accounts, login, queue, logs, and Antigravity
- [x] 3.1 Build the navigation shell and parity data hook before redesign polish — `web/src/components/AppShell.tsx`, `web/src/hooks/useDashboardState.ts`, `web/src/hooks/useNotification.ts`, `web/src/components/NotificationCenter.tsx`, `web/src/styles/theme.css`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/AppShell.test.tsx web/src/hooks/__tests__/useDashboardState.test.tsx`
  - Expected: Navigation areas, polling behavior, notification plumbing, and Antigravity conditional visibility are covered by failing-then-passing frontend tests.

- [x] 3.2 Migrate the Overview experience with live login/queue/sync visibility and quick actions parity — `web/src/components/OverviewPage.tsx`, `web/src/api/queries.ts`, `web/src/components/__tests__/OverviewPage.test.tsx`, `tests/web-headless/dashboard-parity-overview.test.ts`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-parity-overview.test.ts`
  - Expected: Overview parity confirms meta cards, login progress, queue visibility, sync feedback, and operator notices without relying on the legacy inline script.

- [x] 3.3 Migrate Accounts workspace parity including filters, sorting, manual add, auto-login, switch, enable/disable, remove, token/limits refresh, tags, and notes — `web/src/components/AccountsPage.tsx`, `web/src/components/AccountDrawer.tsx`, `web/src/components/CreateAccountModal.tsx`, `web/src/components/__tests__/AccountsPage.test.tsx`, `tests/web-headless/dashboard-parity-accounts.test.ts`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-parity-accounts.test.ts`
  - Expected: High-risk account lifecycle flows behave the same as the legacy dashboard and remain blocked on parity regressions.

- [x] 3.4 Migrate Operations and observability parity for logs, refresh workflows, and Antigravity actions — `web/src/components/OperationsPage.tsx`, `web/src/components/AntigravityPage.tsx`, `web/src/components/__tests__/OperationsPage.test.tsx`, `tests/web-headless/dashboard-parity-operations.test.ts`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-parity-operations.test.ts`
  - Expected: Logs, refresh queue actions, global operations, and conditional Antigravity actions remain reachable and accurate.

## Phase 4: Sticky sessions status and synchronous cleanup administration
- [x] 4.1 Add additive sticky-session admin endpoints for config, current status, and synchronous cleanup without changing current settings contracts — `src/web.ts`, `src/settings.ts`, `src/sticky-sessions.ts`, `src/types.ts`, `tests/integration/sticky-session-admin-api.test.ts`
  **Verification**:
  - Run: `pnpm test -- tests/integration/sticky-session-admin-api.test.ts`
  - Expected: `GET/PUT /api/sticky-sessions/config`, `GET /api/sticky-sessions/status`, and synchronous `POST /api/sticky-sessions/cleanup` are additive, gated correctly, preserve existing settings semantics, and return the documented cleanup payload.

- [x] 4.2 Create the explicit Configuration route host and embed `StickySessionPanel` inside `ConfigurationPage.tsx` before sticky headless verification — `web/src/App.tsx`, `web/src/components/AppShell.tsx`, `web/src/components/ConfigurationPage.tsx`, `web/src/components/StickySessionPanel.tsx`, `web/src/components/__tests__/ConfigurationPage.test.tsx`, `web/src/components/__tests__/StickySessionPanel.test.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/ConfigurationPage.test.tsx web/src/components/__tests__/StickySessionPanel.test.tsx`
  - Expected: The Configuration route host renders the sticky-session panel in-place, navigation can target Configuration explicitly, and component tests catch host/panel integration errors before headless verification.

- [x] 4.3 Verify sticky-session administration through the real Configuration route with semantic guardrails, advanced `allowPromptCacheKey` handling, direct status refresh, and manual cleanup feedback — `tests/web-headless/dashboard-sticky-session-admin.test.ts`, `web/src/components/ConfigurationPage.tsx`, `web/src/components/StickySessionPanel.tsx`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-sticky-session-admin.test.ts`
  - Expected: The UI exposes sticky enablement, identity-source controls, TTL/bounds, advanced `allowPromptCacheKey`, current status, and synchronous cleanup behavior from the Configuration route without misrepresenting backend semantics or requiring async polling.

## Phase 5: Weighted presets and account-weight configuration parity
- [x] 5.1 Complete Configuration page parity for rotation strategy, thresholds, feature flags, reset flows, and force mode controls on top of the existing host route — `web/src/components/ConfigurationPage.tsx`, `web/src/components/__tests__/ConfigurationPage.test.tsx`, `tests/web-headless/dashboard-parity-configuration.test.ts`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-parity-configuration.test.ts`
  - Expected: Configuration updates preserve current runtime semantics for strategy, thresholds, feature flags, reset, and force-mode workflows, while keeping sticky-session administration reachable from the same route host.

- [x] 5.2 Add weighted preset and per-account weight editing parity inside configuration workflows — `web/src/components/ConfigurationPage.tsx`, `web/src/components/__tests__/WeightedPresets.test.tsx`, `tests/integration/weighted-presets-api.test.ts`
  **Verification**:
  - Run: `pnpm test -- tests/integration/weighted-presets-api.test.ts`
  - Expected: Balanced/conservative/aggressive preset application and per-account weight edits remain contract-compatible and observable in UI tests.

## Phase 6: UX improvements after parity gates pass
- [x] 6.1 Refine the navigation shell, responsive layout, and keyboard-accessible status messaging only after parity coverage is green — `web/src/components/AppShell.tsx`, `web/src/styles/theme.css`, `web/src/components/__tests__/AccessibilityShell.test.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/AccessibilityShell.test.tsx`
  - Expected: Overview/Accounts/Configuration/Operations navigation remains keyboard accessible, dark-theme consistent, and responsive without hiding critical actions.

- [x] 6.2 Add account drawer refinements, notification center polish, and scoped bulk-action affordances — `web/src/components/AccountDrawer.tsx`, `web/src/components/NotificationCenter.tsx`, `web/src/components/AccountsPage.tsx`, `web/src/components/__tests__/AccountDrawer.test.tsx`
  **Verification**:
  - Run: `pnpm --dir web test -- web/src/components/__tests__/AccountDrawer.test.tsx`
  - Expected: Drawer workflows, notifications, and any introduced bulk actions remain explicit, reversible, and covered by component tests.

- [x] 6.3 Introduce command/search only if it stays scoped to already-proven workflows and does not reduce discoverability — `web/src/components/AppShell.tsx`, `web/src/components/__tests__/CommandSearch.test.tsx`, `tests/web-headless/dashboard-command-search.test.ts`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-command-search.test.ts`
  - Expected: Command/search shortcuts, if added, accelerate existing tasks without becoming the only path to critical operator actions.

## Phase 7: Hardening test matrix, lint, and typecheck without build execution
- [x] 7.1 Establish the final frontend and backend verification matrix for unit, component, headless smoke, and API contract coverage — `web/package.json`, `tests/integration/dashboard-api-contract.test.ts`, `tests/web-headless/*.test.ts`
  **Verification**:
  - Run: `pnpm test`
  - Expected: The Jest suite passes for backend, integration, and headless parity coverage with no regressions in preserved operator workflows.

- [x] 7.2 Enforce static verification for both workspaces without production build — `package.json`, `web/package.json`
  **Verification**:
  - Run: `pnpm lint && pnpm --dir web lint && pnpm --dir web typecheck`
  - Expected: Root TypeScript checks and frontend lint/typecheck pass cleanly, proving the migration is statically sound without running a build.

- [x] 7.3 Document deferred manual build/package approval gates separately from automated plan verification — `openspec/changes/react-dashboard-redesign/design.md`, `openspec/changes/react-dashboard-redesign/specs/dashboard-delivery-packaging/spec.md`, `package.json`
  **Verification**:
  - Run: `pnpm test -- tests/integration/web-server.test.ts tests/web-headless/dashboard-smoke.test.ts`
  - Expected: Automated verification continues to prove SPA serving semantics through tests and fixtures alone, while build/package validation remains explicitly deferred until later approval.

- [x] 7.4 Remove the legacy inline dashboard only after parity and hardening suites are stable — `src/web.ts`, `tests/web-headless/dashboard-smoke.test.ts`, `tests/integration/web-server.test.ts`
  **Verification**:
  - Run: `pnpm test -- tests/web-headless/dashboard-smoke.test.ts tests/integration/web-server.test.ts`
  - Expected: The server works without the inline HTML/script fallback and the React-served dashboard remains the only UI path under test.

## Phase 8: Deferred packaging and publish validation
- [-] 8.1 Package/publish dry-run and production build validation — deferred: requires later explicit approval because this planning task MUST NOT run or require a production build now — `package.json`, `dist/web`, publish workflow docs`
  **Verification**:
  - Run: `pnpm build && pnpm pack --dry-run`
  - Expected: Deferred until explicitly approved; when authorized later, the package must already include `dist/web` so installed distributions serve the dashboard without a post-install build.
