# Dashboard Sticky Session Administration

## Requirements

### Requirement: Sticky Session Configuration Visibility
When sticky-session support is available to the dashboard, the UI MUST expose the current sticky-session configuration surface for enablement, identity sources, TTL, maximum entries, and maximum file-size cap. The UI MUST treat `allowPromptCacheKey` as an advanced control and MUST NOT present it as a default or equivalent identity source.

#### Scenario: An operator reviews sticky-session settings in the dashboard
- GIVEN sticky-session administration is included in the redesigned dashboard
- WHEN an operator opens sticky-session configuration
- THEN the UI MUST show enablement state, configured identity sources, TTL, maximum entry count, and file-size cap
- AND the UI MUST present `allowPromptCacheKey` as an advanced option instead of a default sticky identity behavior

### Requirement: Sticky Session Semantic Alignment
The dashboard MUST describe sticky-session behavior in a way that remains consistent with the canonical sticky-session routing and persistence specifications. The UI MUST NOT imply that raw identities are persisted, MUST NOT imply that `prompt_cache_key` is used by default, and MUST NOT describe sticky reuse or cleanup semantics differently from the backend rules.

#### Scenario: Sticky-session controls explain the current backend behavior correctly
- GIVEN sticky-session routing and persistence already have canonical behavioral specs
- WHEN the redesigned dashboard displays sticky-session controls, descriptions, or help text
- THEN the UI MUST align with the existing backend semantics for identity resolution, hashing, reuse, fallback, TTL, entry bounds, and file-size protection
- AND the UI MUST avoid suggesting unsupported or unsafe sticky behavior

### Requirement: Sticky Session Operational Status and Cleanup Exposure
The dashboard MUST surface the sticky-session operational status and cleanup affordances introduced by this change family. The backend contract for those affordances MUST be explicit enough for the UI to render them without inventing asynchronous behavior or ambiguous completion states.

#### Scenario: Sticky operational controls follow backend capability
- GIVEN sticky-session administration is included in the redesigned dashboard
- WHEN the redesigned dashboard renders sticky-session administration
- THEN the UI MUST expose cleanup and status actions because the backend provides a real contract for them
- AND the UI MUST avoid misleading operators into expecting background polling or unavailable asynchronous completion states

### Requirement: Sticky Session Cleanup Contract Simplicity
Manual sticky-session cleanup MUST use a synchronous backend contract. `POST /api/sticky-sessions/cleanup` MUST return `200 OK` with `{ ok, before, after, removed, prunedAt }`, and `GET /api/sticky-sessions/status` MUST return the current sticky-session statistics needed by the dashboard.

#### Scenario: An operator triggers manual sticky cleanup
- GIVEN sticky-session administration is enabled and available
- WHEN the operator requests a cleanup from the dashboard
- THEN the backend MUST complete the cleanup within the request and return `200 OK`
- AND the response MUST include `ok`, `before`, `after`, `removed`, and `prunedAt` so the UI can acknowledge the result without polling

#### Scenario: The dashboard refreshes sticky status after cleanup
- GIVEN the operator has viewed sticky-session status or completed a cleanup
- WHEN the dashboard requests `GET /api/sticky-sessions/status`
- THEN the backend MUST return the current sticky-session statistics required by the UI
- AND the UI MUST be able to refresh the displayed status directly without relying on asynchronous cleanup polling

### Requirement: Sticky Session Safety Guardrails
The dashboard MUST protect operators from unsafe sticky-session changes by validating inputs, distinguishing advanced controls from default controls, and surfacing the impact of disabling sticky sessions or narrowing identity sources.

#### Scenario: An operator edits sticky-session settings
- GIVEN an operator changes sticky-session settings from the dashboard
- WHEN the change could affect identity matching or retention bounds
- THEN the UI MUST validate required values and preserve the backend contract constraints
- AND the UI MUST clearly distinguish routine controls from advanced behavior such as `allowPromptCacheKey`

### Requirement: Sticky Session Administration Verification Coverage
The change MUST include parity-focused verification that sticky-session administration in the dashboard reflects the backend semantics and preserves current sticky-session safety guarantees.

#### Scenario: Verification protects sticky-session administration UX
- GIVEN sticky-session behavior is correctness-critical and already covered by canonical backend specs
- WHEN verification is prepared for the redesigned dashboard
- THEN the plan MUST include checks that the UI exposes the agreed sticky controls and semantics accurately
- AND the plan MUST catch regressions where the dashboard misrepresents default identity handling, retention controls, or the synchronous cleanup/status contract
