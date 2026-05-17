# Dashboard Delivery and Packaging

## Requirements

### Requirement: React SPA Served by the Current Server
The dashboard migration MUST serve the React/Vite SPA through the current server runtime rather than introducing a separate frontend host. Serving the SPA MUST preserve the existing `/api/*` routes and MUST keep the CLI web entrypoint behavior intact.

#### Scenario: The server hosts both the SPA and the existing API surface
- GIVEN the redesign adopts React and Vite for the dashboard frontend
- WHEN an operator starts the existing web console entrypoint
- THEN the current server MUST serve the dashboard application assets
- AND the server MUST preserve existing `/api/*` route handling without route collisions or broken CLI web behavior

### Requirement: Canonical Frontend Source and Output Paths
The redesign MUST use `web/` as the canonical React/Vite source workspace and `dist/web/` as the canonical production asset output served by `src/web.ts`. The frontend build configuration MUST target `../dist/web` from inside `web/` so the repository-level output path stays aligned with server delivery and packaging.

#### Scenario: Frontend path decisions remain consistent across planning artifacts
- GIVEN the redesign introduces a separate frontend workspace
- WHEN the team documents source paths, build output, and server delivery behavior
- THEN `web/` MUST be the source workspace referenced by design and tasks
- AND `dist/web/` MUST be the runtime and packaging output referenced by serving and publish requirements

### Requirement: Safe UI-to-API Route Separation
The server MUST separate SPA asset delivery from API routing so that frontend history handling, static asset paths, and dashboard entry routes do not intercept or degrade `/api/*` requests.

#### Scenario: API routes continue working after SPA asset integration
- GIVEN the server now delivers compiled frontend assets in addition to API responses
- WHEN a client requests dashboard routes and `/api/*` routes during normal operation
- THEN SPA entry routing MUST resolve only UI requests
- AND `/api/*` requests MUST continue to resolve to backend handlers with unchanged semantics

### Requirement: Package and Publish Asset Inclusion
The frontend build output required to run the redesigned dashboard MUST be included in the package and publish flow so that installed distributions can serve the dashboard without a post-install frontend build step.

#### Scenario: A published package can serve the redesigned dashboard
- GIVEN the package is produced for installation or publication
- WHEN the published artifact is installed and the web console is started
- THEN the required frontend assets MUST already be present in the distributable output
- AND operators MUST NOT need an additional manual frontend build step to use the dashboard

### Requirement: Automated Verification Stays Fixture-Backed
The change MUST define an automated verification plan that covers dashboard smoke verification, API contract or parity checks, focused frontend tests when the frontend setup supports them, and lint or typecheck verification. The automated plan MUST rely on tests, fixtures, and static verification only; it MUST NOT require running a production build as part of spec authoring or implementation gating.

#### Scenario: The redesign has an actionable verification strategy before implementation
- GIVEN the dashboard migration affects packaging, routing, and operator workflows
- WHEN verification expectations are documented for the change
- THEN the plan MUST include dashboard smoke coverage, API parity coverage, and lint or typecheck expectations
- AND the plan MUST rely on fixture-backed or otherwise static serving verification instead of requiring a production build to be considered complete
- AND manual build/package approval MUST remain outside the automated verification scope

### Requirement: Deferred Build and Package Approval Gate
Production build execution and package or publish dry-runs MUST remain deferred until a later explicit approval step. The absence of that approval MUST NOT block the SDD plan from being complete or the automated verification matrix from passing, because the approval gate is separate from automated plan verification.

#### Scenario: Packaging validation is intentionally postponed
- GIVEN the redesign changes packaging responsibilities for frontend assets
- WHEN the team reaches plan review or routine automated verification
- THEN production build and package dry-run steps MUST be documented as deferred manual validation
- AND automated plan gates MUST continue using tests, fixtures, and static verification until explicit approval is granted
- AND the manual approval gate MUST be tracked separately from automated pass/fail status

### Requirement: Rollback-Friendly Serving Integration
The server integration for the redesigned dashboard MUST preserve a rollback path that can disable or replace the SPA serving layer without changing account data, backend API behavior, or sticky-session persistence semantics.

#### Scenario: The team needs to back out the redesigned UI
- GIVEN the React dashboard may reveal regressions during rollout
- WHEN the team disables or rolls back the new UI layer
- THEN the rollback MUST avoid changing account-store data, sticky-session sidecar semantics, or backend API contracts
- AND the serving integration MUST remain isolated enough to support that rollback without a backend rewrite
