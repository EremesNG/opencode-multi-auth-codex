# Delta for Dashboard API Contract

## ADDED Requirements

### Requirement: Existing Dashboard API Contract Preservation
The system MUST preserve the existing `/api/*` dashboard contract surface throughout the React/Vite migration. Any endpoint, method, request field, response field, or error shape change that affects current dashboard behavior MUST remain backward compatible for the current UI and CLI web flow unless the change is explicitly specified in this change set before implementation.

#### Scenario: React UI migrates without breaking current API consumers
- GIVEN the server already exposes operator-facing dashboard endpoints under `/api/*`
- WHEN the React dashboard replaces the inline UI
- THEN the server MUST continue accepting the current endpoint methods and request payloads needed by the existing dashboard workflows
- AND current consumers MUST continue receiving compatible success and error payloads unless an explicit compatibility rule is added to this change spec first

### Requirement: Dashboard State Payload Parity
The system MUST keep a dashboard state surface that exposes the data required for parity in overview, account management, login progress, refresh queue visibility, rotation strategy, force mode, feature flags, logs, and conditional Antigravity visibility. Additive fields MAY be introduced, but parity data already used by the current dashboard MUST remain available during the migration.

#### Scenario: The new UI can render parity state from the current server
- GIVEN the dashboard requests operational state from the current server
- WHEN the UI loads or refreshes live state
- THEN the server MUST expose parity data for account inventory, active alias, sync state, login progress, refresh queue state, rotation strategy, force mode, feature flags, and log discovery
- AND any new fields added for the React UI MUST NOT remove or silently repurpose existing parity fields that current workflows depend on

### Requirement: Account Operation Contract Parity
The system MUST preserve account operations for manual add, auto-add or auto-login start, enable, disable, remove, re-authenticate, switch active auth, refresh token, refresh limits, and update tags or notes. The migrated UI MUST be able to invoke those operations through existing contracts or explicitly compatible wrappers that preserve the same operational outcome and validation semantics.

#### Scenario: An operator performs existing account actions in the redesigned UI
- GIVEN an operator uses account lifecycle actions that are available in the current dashboard
- WHEN the redesigned dashboard invokes those workflows
- THEN the server MUST continue supporting those actions without requiring a backend contract rewrite
- AND validation conflicts such as unknown aliases, disabled-account restrictions, or last-enabled-account protection MUST remain observable to the UI

### Requirement: Configuration Operation Contract Parity
The system MUST preserve configuration operations for rotation strategy, force mode, thresholds, weighted presets, account weights, settings reset, and feature-flag updates where the current API already supports them. Any newly introduced sticky-session configuration contract MUST be additive and MUST NOT regress current settings behavior.

#### Scenario: An operator updates dashboard configuration during migration
- GIVEN the current server supports runtime configuration changes through dashboard APIs
- WHEN the redesigned UI updates strategy, thresholds, weights, force mode, presets, or feature flags
- THEN the resulting runtime behavior MUST remain consistent with the current server semantics
- AND any sticky-session configuration additions MUST coexist with existing settings operations without breaking current settings consumers

### Requirement: Polling and Live-State Compatibility
The system MUST preserve auto-refresh behavior and live observability for login progress, refresh queue status, logs, and action acknowledgements during the migration. The React dashboard MAY change presentation, but it MUST continue receiving enough API state to support polling-based updates and operator feedback without full-page reloads.

#### Scenario: Long-running dashboard activity remains observable
- GIVEN login, token refresh, or limits refresh operations can outlive a single UI interaction
- WHEN the redesigned dashboard polls for state or log updates
- THEN the server MUST continue exposing live progress and queue information needed to represent in-flight work
- AND operators MUST receive completion or failure feedback without navigating away or manually reloading the page

### Requirement: API Parity Verification Coverage
The change MUST include parity-focused verification for preserved dashboard endpoints, preserved operator workflows, preserved live-state behavior, and any additive sticky-session configuration contracts introduced by the redesign.

#### Scenario: Verification proves contract-safe migration behavior
- GIVEN the dashboard redesign changes the frontend architecture but not the server authority boundary
- WHEN verification is prepared for the migration
- THEN the verification plan MUST include API contract or parity checks for state, settings, account operations, force mode, refresh workflows, and sticky-session additions
- AND the verification plan MUST be able to detect regressions caused by accidental API drift

## MODIFIED Requirements

## REMOVED Requirements
