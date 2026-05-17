# Proposal: React Dashboard Redesign

## Intent

### Problem Statement

The current dashboard is implemented as a single `src/web.ts` server-rendered HTML/CSS/JS monolith. That structure makes it costly to redesign the UX, hard to evolve shared state safely, and brittle to extend as more operational features accumulate. The UI now needs a ground-up redesign while preserving a large, correctness-critical feature surface and exposing sticky-session controls without regressing existing `/api/*` behavior.

### Goals

- Redesign the dashboard UX/UI from first principles while preserving operational parity for the current account-management and observability workflows.
- Migrate the dashboard frontend to a React SPA built with Vite, provided it can be introduced without breaking existing server APIs or runtime behavior.
- Keep the current Node server as the authority for business logic and `/api/*` contracts during the migration so the frontend can be replaced incrementally.
- Expose sticky-session controls and visibility in the dashboard, including enablement, identity-source configuration, retention bounds, and advanced `prompt_cache_key` handling where explicitly allowed.
- Create a phased path that prioritizes parity and safe rollout before visual polish or deeper architectural backend changes.

## Scope

### In Scope

- Freeze and document the current dashboard API contract surface as the baseline integration target for the new frontend.
- Introduce a Vite-powered React frontend workspace and define how built assets are served by the current server runtime.
- Replace the current inline dashboard implementation in `src/web.ts` with a frontend shell that serves the compiled SPA while preserving the current backend routes and operational responsibilities.
- Migrate all existing dashboard capabilities to React without functional loss, including:
  - account listing, status, enable/disable, remove, re-auth, switch, tags, notes, and manual account creation
  - individual/global refresh token and limit actions
  - filters, sorting, auto-login, login progress, refresh queue visibility, logs, polling, and toasts
  - Force Mode, rotation strategy controls, settings, feature flags, and Antigravity visibility/actions currently exposed in the dashboard
- Add sticky-session UI coverage for toggle state, identity-source selection, TTL, max entries, size/cap settings, advanced `prompt_cache_key` behavior, and sidecar status or cleanup actions if those backend affordances are available or added as part of the same change family.
- Define a migration plan that allows parity-first delivery before optional UX enhancements.

### Out of Scope

- Breaking or redesigning the existing `/api/*` contracts as part of the first migration phase.
- Rewriting core backend rotation, auth, refresh, limits, store, or sticky-session logic except where minimal API or serving adaptations are required for parity.
- Changing current sticky-session semantics that are already covered by canonical sticky specs beyond surfacing them correctly in the UI.
- Replacing the current Node server with a separate frontend host, SSR framework, or multi-service deployment topology.
- Introducing non-essential visual experimentation that delays parity on existing operator workflows.

## Approach

The dashboard redesign SHALL be delivered as a frontend modernization layered over the existing server contract, not as a simultaneous full-stack rewrite.

### Recommended Direction

Adopt React + Vite for the dashboard frontend, with the existing server continuing to own `/api/*`, account orchestration, sticky-session logic, and static asset delivery. This gives the project a component model, explicit client-side state boundaries, and a faster iteration loop for UX work without destabilizing backend behavior.

### Alternatives Considered

1. **Keep the inline `src/web.ts` dashboard and refactor in place**  
   Lower setup cost, but rejected as the primary direction because the current monolith makes stateful UX redesign, reuse, and long-term maintainability unnecessarily expensive.

2. **Move directly to a different frontend framework or SSR stack**  
   Could provide richer patterns, but rejected for this phase because it increases integration and hosting complexity without improving the parity-first migration objective.

3. **Redesign backend APIs at the same time as the frontend rewrite**  
   Could yield cleaner contracts eventually, but rejected for the initial proposal because coupling UI migration to API redesign materially raises regression risk across critical operator workflows.

### High-Level Plan

1. **API contract freeze** — inventory the current `/api/*` responses and dashboard behaviors used by the existing UI, including sticky-session and feature-flag surfaces.
2. **React/Vite setup** — add the frontend workspace, build pipeline, and static serving integration with the existing server.
3. **Parity migration** — move current screens and interactions into React with equivalent behavior before introducing meaningful UX changes.
4. **UX redesign pass** — improve information architecture, layout, workflow clarity, and feedback patterns once parity is stable.
5. **Sticky-session administration UI** — expose sticky-session configuration and operational visibility with clear guardrails around advanced identity options.
6. **Hardening** — verify polling, error states, long-running actions, force-mode interactions, queue visibility, and regressions in critical account workflows.

## Affected Areas

- `src/web.ts` — transition from inline monolithic dashboard rendering toward SPA asset serving and API contract stewardship.
- `src/index.ts` and related server wiring — any integration needed so the current runtime serves the frontend build safely.
- `src/settings.ts`, `src/types.ts`, and sticky-session related modules — only where needed to expose already-supported configuration/state cleanly to the UI.
- `src/sticky-sessions.ts`, `src/rotation.ts`, `src/store.ts`, and adjacent backend modules — reference points for parity, not rewrite targets, unless small API exposure changes are required.
- New frontend workspace files (for example under `web/`, `frontend/`, or another agreed path) — React components, state management, routing structure if needed, styles, and API client logic.
- Dashboard-focused tests — update or add automated coverage for API-backed UI parity and sticky-session administrative flows without relying on a build step in this proposal phase.

## Risks

- Functional regression risk is high because the dashboard concentrates many operator-critical actions in one surface.
- API drift risk increases if the frontend migration uncovers undocumented behavior in existing `/api/*` responses.
- State-management complexity could reintroduce bugs in polling, optimistic updates, queue progress, or concurrent actions if the React architecture is underspecified.
- Sticky-session controls are easy to misrepresent in UI; unclear identity-source rules or `prompt_cache_key` semantics could create operator confusion or unsafe expectations.
- Packaging and static asset serving changes could complicate the current CLI/server distribution if the integration path is not kept minimal.
- A redesign-first mindset without parity gates could ship a cleaner-looking interface that silently drops critical operational functionality.

## Rollback Plan

- Keep the existing server-owned `/api/*` contracts as the compatibility boundary so rollback can restore the prior dashboard implementation without backend migration.
- Roll back by serving the previous inline dashboard path if the React frontend introduces blocking regressions.
- Isolate new frontend assets and serving logic so they can be disabled or removed without touching account data, sticky-session sidecars, or runtime auth state.
- If sticky-session UI changes prove confusing or incomplete, keep the backend capability intact and hide the new controls until the UX is corrected.

## Success Criteria

- The project has a documented proposal and implementation path for moving the dashboard to React + Vite without breaking the current backend contract.
- The redesigned dashboard preserves all currently supported operator capabilities before any non-essential UX enhancements are considered complete.
- Sticky-session administration is visible and controllable in the UI with semantics consistent with the canonical sticky-session specs.
- The server continues to own `/api/*` behavior and static serving responsibilities during the migration.
- The rollout plan explicitly gates delivery by parity, sticky-session coverage, and hardening rather than visual redesign alone.
