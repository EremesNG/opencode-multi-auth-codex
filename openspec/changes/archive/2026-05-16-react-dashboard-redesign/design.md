# Design: React Dashboard Redesign

## Technical Approach

The dashboard redesign is a frontend-only migration that preserves the existing Node server as the authority for all business logic and `/api/*` contracts. The current inline HTML/CSS/JS monolith in `src/web.ts` will be replaced by a Vite-built React SPA whose compiled assets are served by the same server runtime.

Key principles:
- **Parity-first**: every existing dashboard capability MUST work in the React UI before any UX redesign is considered complete.
- **Server authority preserved**: `src/web.ts` continues to own `/api/*`, account orchestration, sticky-session logic, and static asset delivery.
- **Additive-only API changes**: any new endpoint for sticky-session admin or static assets is additive; existing contracts remain frozen.
- **Rollback-ready**: the serving integration can be disabled without touching account data, sticky-session sidecars, or backend API contracts.

## Architecture Decisions

### Decision: React + Vite as the frontend stack
**Choice**: Adopt React 18+ with Vite 5+ as the build tool, using TypeScript for the frontend workspace.
**Alternatives considered**:
- Keep inline `src/web.ts` dashboard and refactor in place: rejected because the monolith makes stateful UX redesign and long-term maintainability expensive.
- Move to a different framework or SSR stack: rejected because it increases integration/hosting complexity without improving the parity-first objective.
- Redesign backend APIs simultaneously: rejected because coupling UI migration to API redesign raises regression risk across critical operator workflows.
**Rationale**: React provides a component model, explicit client-side state boundaries, and a faster iteration loop for UX work. Vite gives fast dev builds and a simple static output that the current Node server can serve with minimal changes.

### Decision: Frontend workspace under `web/`
**Choice**: Create a new top-level directory `web/` containing the React/Vite project.
**Rationale**: Isolates frontend dependencies, build configuration, and source files from the backend Node project. Keeps frontend-specific implementation concentrated in `web/`, while any root `package.json` changes stay limited to minimal serving and packaging integration.

### Decision: Static asset serving via `src/web.ts` with fixture-backed verification
**Choice**: The React/Vite source of truth lives under `web/`, Vite is configured to emit production assets to `../dist/web`, and `src/web.ts` serves `dist/web/` after `/api/*` route checks. Automated verification for serving behavior uses committed static fixture assets and server tests only; production build and package dry-runs are explicitly deferred to a later manual approval gate.
**Rationale**: This keeps one canonical source/output route, preserves the current server ownership boundary, and avoids making the SDD plan depend on a production build to prove routing semantics.

### Decision: Use React Query (TanStack Query) for server state
**Choice**: Use `@tanstack/react-query` for polling, caching, and background refetching of `/api/state` and other dashboard endpoints.
**Rationale**: The current dashboard does manual `setInterval` polling and imperative DOM updates. React Query replaces that with declarative, cached server state, automatic background refetching, and built-in loading/error states. It preserves the polling behavior (e.g., 2s during login/queue, 5s otherwise) without manual timer management.

### Decision: Notification center as a global toast queue
**Choice**: Implement a lightweight toast/notification queue in React context (not a full UI library) to replace the current fixed-position toast.
**Rationale**: The current toast is simple (`showToast` + 2.2s timeout). A context-based queue keeps the dependency footprint small while making notifications accessible from any component.

### Decision: No backend contract changes for parity phase
**Choice**: The first implementation phase consumes ONLY existing `/api/*` endpoints. Any additive endpoint (e.g., sticky-session config read/write) is introduced in a later phase after parity is verified.
**Rationale**: Prevents API drift and keeps the rollback boundary clean. The server remains the compatibility anchor.

### Decision: Sticky-session administration is hosted inside the Configuration route
**Choice**: `StickySessionPanel` lives inside `web/src/components/ConfigurationPage.tsx` on the explicit Configuration route; it is not a standalone page.
**Alternatives considered**:
- Dedicated sticky-session page: rejected because Configuration already owns operator-facing runtime settings and an extra page adds unnecessary navigation complexity.
- Verifying the sticky UI before a real route/page host exists: rejected because it hides a prerequisite and can pass headless tests against a panel operators cannot actually reach.
**Rationale**: Embedding the panel in `ConfigurationPage.tsx` keeps the information architecture aligned with the operator UI spec, preserves discoverability, and makes the host route an explicit dependency before sticky-session verification.

## Data Flow

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   React SPA     │◄────►│  Node server     │◄────►│   Store / API   │
│   (Vite build)  │  /api│  (src/web.ts)    │       │   (accounts,    │
│                 │      │                  │       │   sticky, etc)  │
└─────────────────┘      └──────────────────┘      └─────────────────┘
        ▲                        │
        │                        │ serves static assets
        └────────────────────────┘
```

1. **Dev workflow**: `pnpm dev` inside `web/` starts the Vite dev server (port 5173 by default). The dev server proxies `/api/*` to the Node backend via `vite.config.ts` proxy. The backend target port defaults to `3434` and is overridable via the `VITE_BACKEND_PORT` environment variable or `web/.env.local`.
2. **Build workflow**: when explicitly approved later, `pnpm build` inside `web/` emits production assets to `../dist/web` (`dist/web/` from the repository root) with `index.html`, hashed JS/CSS assets, and static files.
3. **Production serving**: The Node server resolves `dist/web/` at runtime (relative to `MODULE_DIR`). API routes are checked first; unmatched requests serve static files from `dist/web/`; if no file matches, `index.html` is served for SPA routing, including the explicit Configuration route that hosts sticky-session administration.
4. **Verification workflow during planning and implementation**: server tests use committed static fixtures that mimic `dist/web/` output shape so SPA/static routing semantics can be verified without invoking a production build. Manual build/package approval remains a separate later gate.
5. **State flow**: React Query polls `/api/state` at configurable intervals. Mutations (enable/disable, refresh, etc.) invalidate the `state` query to trigger a background refetch.

## File Changes

### Created (frontend workspace)
- `web/package.json` — React, Vite, TypeScript, React Query, React Router DOM, dev dependencies.
- `web/vite.config.ts` — Vite config with React plugin, proxy for `/api/*` to `http://127.0.0.1:${BACKEND_PORT}` (default 3434, overridable via `VITE_BACKEND_PORT` or `.env.local`), and `build.outDir` set to `../dist/web`.
- `web/tsconfig.json` — Frontend TypeScript config, strict, DOM lib.
- `web/index.html` — SPA entrypoint with `<div id="root"></div>`.
- `web/src/main.tsx` — React root render, QueryClientProvider, BrowserRouter.
- `web/src/App.tsx` — Top-level route shell (AppShell) wiring Overview, Accounts, Configuration, Operations, and conditional Antigravity routes.
- `web/src/api/client.ts` — Typed fetch wrapper around `/api/*`, handles JSON parsing, error normalization, and auth-token-less requests (the dashboard is unauthenticated localhost-only).
- `web/src/api/queries.ts` — React Query query/mutation definitions for all dashboard endpoints.
- `web/src/hooks/useDashboardState.ts` — Hook wrapping the main `/api/state` query with polling logic.
- `web/src/hooks/useNotification.ts` — Toast queue hook/context.
- `web/src/components/AppShell.tsx` — Layout with navigation sidebar/topbar for Overview, Accounts, Configuration, Operations, and conditional Antigravity.
- `web/src/components/OverviewPage.tsx` — Meta cards, quick actions, queue status, login progress.
- `web/src/components/AccountsPage.tsx` — Filters, sort, account table/cards, drawer/detail view.
- `web/src/components/AccountDrawer.tsx` — Side drawer for account actions (enable/disable, re-auth, refresh, switch, edit tags/notes).
- `web/src/components/ConfigurationPage.tsx` — Configuration route host for rotation strategy, thresholds, weighted presets, account-weight editor, force mode controls, feature flags, and the embedded `StickySessionPanel` section.
- `web/src/components/OperationsPage.tsx` — Logs viewer, global actions (sync, refresh all tokens/limits).
- `web/src/components/AntigravityPage.tsx` — Conditional page for Antigravity accounts and quotas.
- `web/src/components/StickySessionPanel.tsx` — Sticky session config sub-panel rendered inside `ConfigurationPage.tsx` (enablement, identity sources, TTL, max entries, max file size, advanced `allowPromptCacheKey`).
- `web/src/components/NotificationCenter.tsx` — Toast container.
- `web/src/components/CreateAccountModal.tsx` — Modal for manual/auto-login account creation.
- `web/src/styles/theme.css` — CSS variables matching the current dark theme (`--bg`, `--panel`, `--accent`, etc.).
- `web/src/types/api.ts` — Shared TypeScript interfaces for API request/response shapes.
- `tests/fixtures/web-dist/` — Static SPA fixture assets used by server and headless smoke tests to validate `dist/web/` serving semantics without a real frontend build.

### Modified (backend)
- `src/web.ts` — Replace inline `HTML` string with static asset serving logic:
  - Add `serveStaticFile` helper to read from `dist/web/`.
  - Change `GET /` handler to serve `dist/web/index.html`.
  - Add catch-all handler after API routes: try static file, fallback to `index.html` for SPA routes.
  - Keep all `/api/*` handlers unchanged.
- `package.json` — Add `web:build` script (calls `pnpm --dir web build`) and include `dist/web` in `files` array for publish.
- `.gitignore` — Add `dist/web` and `web/node_modules`.

### Deleted (after parity verification)
- The inline `HTML` constant and all inline `<script>` logic inside `src/web.ts` (removed in a cleanup phase after parity is proven).

## Interfaces / Contracts

### Existing preserved contracts (no changes)
All current `/api/*` endpoints remain frozen:
- `GET /api/state` — full dashboard state payload.
- `GET /api/logs` — log tail.
- `POST /api/sync` — sync auth.json.
- `POST /api/auth/start` — begin OAuth login.
- `POST /api/auto-login/start` — begin auto-login.
- `POST /api/auto-login/add` — add auto-login credentials.
- `POST /api/switch` — switch active auth.json alias.
- `POST /api/remove` — remove account.
- `POST /api/account/meta` — update tags/notes.
- `POST /api/token/refresh` — refresh token(s).
- `POST /api/limits/refresh` — refresh limits.
- `POST /api/limits/stop` — stop refresh queue.
- `GET /api/accounts` — list accounts metadata.
- `PUT /api/accounts/:alias/enabled` — enable/disable account.
- `POST /api/accounts/:alias/reauth` — re-authenticate account.
- `GET /api/force` — get force mode state.
- `POST /api/force` — activate force mode.
- `POST /api/force/clear` — clear force mode.
- `GET /api/settings` — get settings.
- `PUT /api/settings` — update settings.
- `GET /api/settings/feature-flags` — get feature flags.
- `PUT /api/settings/feature-flags` — update feature flags.
- `POST /api/settings/reset` — reset settings.
- `POST /api/settings/preset` — apply preset.
- `POST /api/antigravity/refresh` — refresh Antigravity quota.
- `POST /api/antigravity/refresh-all` — refresh all Antigravity quotas.

### Additive contracts (introduced only after parity)
- `GET /api/sticky-sessions/config` — returns current sticky-session settings (enablement, identity sources, TTL, max entries, max file size, `allowPromptCacheKey`). Only exposed if sticky sessions feature flag is enabled.
- `PUT /api/sticky-sessions/config` — updates sticky-session settings with validation. Returns updated config or validation errors.
- `GET /api/sticky-sessions/status` — returns current sidecar stats (`before`, `after`, or equivalent current counts as defined by the backend implementation, `removed`, and `prunedAt`-adjacent timing data as applicable). Only exposed if sticky sessions feature flag is enabled.
- `POST /api/sticky-sessions/cleanup` — performs synchronous cleanup and returns `200 OK` with `{ ok, before, after, removed, prunedAt }`. Only exposed if sticky sessions feature flag is enabled.

**Important**: These additive endpoints MUST NOT modify existing endpoint behavior. They are gated by the `stickySessionsEnabled` feature flag and return 403 when disabled.

## Testing Strategy

### RED / GREEN order (TDD for new frontend code)
1. **RED**: Write a failing test that asserts a component renders or an API client returns the expected shape.
2. **GREEN**: Implement the minimal component/client code to pass.
3. **REFACTOR**: Clean up once green.

### Test layers
1. **Lint / typecheck**:
   - `pnpm lint` (tsc --noEmit) for the current backend workspace.
   - Frontend: `cd web && pnpm typecheck` (Vite/Rollup typecheck plugin or `tsc --noEmit`).
2. **Smoke / headless**:
   - Use headless/server tests to start the server against fixture-backed `dist/web/` assets and verify:
      - `/` returns the SPA (status 200, content-type text/html).
      - `/api/state` returns JSON with expected keys.
      - Navigation between Overview/Accounts/Configuration works without full reload.
      - Sticky-session administration is reachable through the Configuration route host rather than an isolated unmounted panel.
   - Run against static fixture assets that mirror `dist/web/` output shape, not the Vite dev server.
3. **Component / unit**:
   - Vitest (aligned with Vite) for React component tests.
   - Test account card rendering, filter/sort logic, modal open/close, toggle states.
   - Mock React Query with `msw` (Mock Service Worker) for API interception.
4. **API contract tests**:
   - Jest (existing backend test runner) for endpoint parity.
   - For each preserved endpoint, assert request/response shapes match the current implementation.
   - Assert additive sticky endpoints return correct error codes when feature flag is off.
5. **Integration / parity**:
   - Headless test that performs a sequence of operator actions (add account, enable/disable, refresh, switch, force mode, etc.) via the React UI and verifies the backend state changes correctly through `/api/state`.

### Automated verification stays build-free
As specified, the design phase does NOT require running a production build. During implementation, serving semantics MUST be proven with static fixtures plus automated tests. Production build and package dry-run remain deferred manual gates that require later explicit approval and are not part of automated plan verification.

## Migration / Rollout

### Phase 1: Scaffold & API client (1-2 days)
- Create `web/` workspace with Vite + React + TypeScript.
- Implement typed API client and React Query hooks for all existing endpoints.
- Add `AppShell` with navigation and empty page placeholders.
- **Gate**: Server tests using fixture-backed `dist/web/` assets prove that `/` serves the SPA entry and `/api/*` remains untouched, without requiring a production build.

### Phase 2: Parity migration — Overview & Accounts (3-5 days)
- Implement `OverviewPage` with meta cards, sync/refresh actions, queue progress, login status.
- Implement `AccountsPage` with filters, sorting, account cards/table, and all account actions (enable/disable, remove, re-auth, switch, refresh token/limits, edit tags/notes).
- Implement `CreateAccountModal` for manual and auto-login flows.
- **Gate**: Headless parity test passes for all account lifecycle actions; no functional loss compared to inline dashboard.

### Phase 3: Parity migration — Configuration & Operations (2-3 days)
- Implement the Configuration route/page host first, then expand `ConfigurationPage` with rotation strategy selector, thresholds, weighted presets (balanced/conservative/aggressive), account-weight editor, force mode toggle/alias selector, and the embedded sticky-session section container.
- Implement `OperationsPage` with logs viewer and global actions.
- Implement `AntigravityPage` (conditional on feature flag).
- **Gate**: Headless parity test passes for settings changes, force mode, weighted preset application, account-weight edits, and Antigravity actions.

### Phase 4: Sticky-session administration UI (2-3 days)
- Add backend endpoints `GET /api/sticky-sessions/config`, `PUT /api/sticky-sessions/config`, `GET /api/sticky-sessions/status`, and `POST /api/sticky-sessions/cleanup`.
- Implement `StickySessionPanel` inside `ConfigurationPage.tsx` on the explicit Configuration route, exposing: enablement toggle, identity-source selection, TTL, max entries, max file size, and advanced `allowPromptCacheKey`.
- Implement status sub-panel showing current sticky-session stats and last prune timing from `GET /api/sticky-sessions/status`.
- Implement manual cleanup trigger with synchronous success/error feedback from `POST /api/sticky-sessions/cleanup`, then refresh status directly without async polling.
- Ensure `allowPromptCacheKey` is presented as an advanced control, not a default.
- **Gate**: The Configuration route host already exists, sticky-session controls are reachable from that route, UI reflects backend semantics correctly, validation errors match backend constraints, feature-flag gating works, and status and cleanup actions provide accurate feedback.

### Phase 5: UX redesign pass (2-4 days)
- Improve information architecture, layout density, responsive breakpoints, keyboard navigation, focus visibility.
- Add loading skeletons, error boundaries, and empty states.
- **Gate**: No parity regressions; accessibility baseline met.

### Phase 6: Hardening & cleanup (2-3 days)
- Remove inline `HTML` constant and legacy `<script>` from `src/web.ts`.
- Add `dist/web` to `package.json` `files` and document deferred package verification steps.
- Final smoke tests continue using fixture-backed serving coverage unless later approval explicitly unlocks build/package validation.
- **Gate**: All approved tests pass; package/build validation remains a separate manual approval checkpoint.

### Rollback plan
- At any point before Phase 6 cleanup, restoring the inline `HTML` constant in `src/web.ts` and removing the static-asset fallback reverts to the legacy dashboard.
- The server integration is isolated: disabling SPA serving does not affect `/api/*`, account data, sticky-session sidecars, or runtime auth state.
- If sticky-session UI changes prove confusing, hide the panel via feature flag without removing backend capability.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Functional regression in operator-critical actions | High | Parity-first delivery with automated headless tests gating each phase. |
| API drift during frontend migration | Medium | Freeze existing contracts; additive endpoints only. Contract tests detect drift. |
| State-management complexity (polling, optimistic updates) | Medium | React Query handles caching/refetching; manual timers removed. |
| Sticky-session UI misrepresenting backend semantics | Medium | UI text reviewed against canonical sticky specs; validation mirrors backend constraints. |
| Packaging / publish missing built assets | Medium | `dist/web` included in `files`; build/package dry-run remains an explicit later approval gate, separate from plan acceptance. |
| Big-bang rollout without parity tests | High | **Explicitly forbidden** — see "What NOT to do". |

## What NOT to Do

- **No big-bang without parity tests**: Do not merge the React UI into main or publish a package until headless parity tests prove all existing operator workflows work.
- **No silent API contract changes**: Do not modify existing `/api/*` request/response shapes or error codes. Any needed change MUST be documented as an additive endpoint or explicit compatibility rule.
- **No island hybrid**: Do not run the React SPA on a separate host/port in production. The server MUST serve the SPA itself to keep the CLI `web` entrypoint intact.
- **No redesign before parity**: Visual or structural improvements MUST NOT ship as a substitute for missing operational behavior.
- **No build during design phase**: The design artifact is complete when the plan is documented and reviewed, not when a build succeeds.

## Resolved Decisions

1. **Sticky-session sidecar status/cleanup**: INCLUDED in this change family. The backend exposes `GET /api/sticky-sessions/status` for current stats and `POST /api/sticky-sessions/cleanup` as a synchronous `200 OK` cleanup action returning `{ ok, before, after, removed, prunedAt }`. These endpoints are gated by the sticky-sessions feature flag.
2. **Weighted preset UI**: INCLUDED in the parity scope from Phase 3. The React UI exposes weighted strategy presets (balanced/conservative/aggressive) and an account-weight editor wherever the API/settings support it.
3. **Vite dev server proxy port**: CONFIGURABLE via environment variable (`VITE_BACKEND_PORT`) with a default of `3434`. The `web/.env.local` file is respected and documented.
