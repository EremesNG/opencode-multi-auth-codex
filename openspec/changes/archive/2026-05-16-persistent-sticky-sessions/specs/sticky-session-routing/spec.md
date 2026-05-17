# Delta for Sticky Session Routing

## ADDED Requirements

### Requirement: Sticky Session Flag Gating
The system MUST keep sticky-session behavior disabled by default. When the sticky-session feature flag is OFF, account selection, persistence reads/writes, force-mode handling, rotation state, and error behavior MUST remain identical to the current non-sticky flow.

#### Scenario: Flag off preserves current behavior
- GIVEN sticky sessions are disabled
- WHEN a request is routed through the existing selection pipeline
- THEN the system MUST skip sticky identity lookup and sticky persistence entirely
- AND the system MUST use the current account-selection flow unchanged

### Requirement: Canonical Sticky Identity Resolution
The system MUST attempt sticky routing only when it can derive a canonical identity from an explicit, allowlisted request identity hierarchy. The identity resolution process MUST normalize equivalent inputs deterministically before hashing. The default hierarchy MUST NOT persist from `prompt_cache_key` alone unless the request path makes an explicit sticky-identity decision that authorizes that field as the canonical identity source.

#### Scenario: Canonical identity is available
- GIVEN sticky sessions are enabled
- AND the request contains an allowlisted identity source that resolves to a canonical identity
- WHEN the request enters account selection
- THEN the system MUST normalize that identity deterministically
- AND the system MUST use only the normalized identity hash for sticky lookup and persistence

#### Scenario: No canonical identity is available
- GIVEN sticky sessions are enabled
- AND the request does not resolve an explicit canonical identity
- WHEN the request enters account selection
- THEN the system MUST skip sticky lookup and sticky persistence
- AND the system MUST continue with the current rotation behavior unchanged

#### Scenario: Prompt cache key is present without explicit identity authorization
- GIVEN sticky sessions are enabled
- AND the request includes `prompt_cache_key`
- AND no explicit sticky-identity decision authorizes `prompt_cache_key` as the canonical identity source
- WHEN the request enters account selection
- THEN the system MUST NOT persist or derive sticky identity from `prompt_cache_key` alone

### Requirement: Initial Sticky Assignment
When sticky sessions are enabled, force mode is inactive, a canonical identity is available, and no reusable sticky assignment exists, the system MUST select an account using the currently active rotation strategy over the accounts that are valid for the request. After a successful selection, the system MUST persist a mapping from the canonical identity hash to the selected alias.

#### Scenario: First request creates a sticky assignment
- GIVEN sticky sessions are enabled
- AND force mode is inactive
- AND a canonical identity is available
- AND no sticky mapping exists for that identity hash
- WHEN the request is routed successfully
- THEN the system MUST choose the alias using the active rotation strategy and current validity filters
- AND the system MUST persist the identity-hash-to-alias mapping after the selected account is confirmed usable

### Requirement: Sticky Reuse Validation
For later requests with the same canonical identity hash, the system MUST reuse the mapped alias only if that account still exists, is enabled, is healthy for the requested model and workspace conditions, and yields a valid token at selection time. Successful sticky reuse MUST NOT advance `rotationIndex`.

#### Scenario: Healthy sticky account is reused
- GIVEN sticky sessions are enabled
- AND a sticky mapping exists for the request identity hash
- AND the mapped alias still exists, is enabled, passes health checks, and provides a valid token
- WHEN another request with the same canonical identity is routed
- THEN the system MUST reuse the mapped alias
- AND the system MUST NOT advance `rotationIndex`

### Requirement: Sticky Fallback and Replacement Selection
If a sticky mapping exists but the mapped alias is not currently reusable, and at least one other valid account remains, the system MUST run the active rotation strategy over the remaining valid accounts, select a replacement alias, and update the sticky mapping to that replacement. Sticky fallback MUST respect the same model, workspace, health, enablement, and token-validity rules as normal selection. Sticky reuse itself MUST NOT advance `rotationIndex`, but replacement selection MUST preserve the current strategy's index-advance semantics.

#### Scenario: Sticky alias falls back to another valid account
- GIVEN sticky sessions are enabled
- AND a sticky mapping exists for the request identity hash
- AND the mapped alias is not reusable for the current request
- AND at least one other valid account remains
- WHEN the request is routed
- THEN the system MUST run the active rotation strategy over the remaining valid accounts
- AND the system MUST use the selected replacement alias for the request
- AND the system MUST update the sticky mapping to the replacement alias
- AND the system MUST preserve current `rotationIndex` advancement semantics for that replacement selection only

### Requirement: Exhausted Sticky Fallback Semantics
If the mapped sticky alias is not reusable and no replacement account is available, the system MUST preserve the current non-sticky error semantics for the request. The system MUST retain the sticky mapping when the mapped alias failure is temporary, and MUST remove the sticky mapping when the failure is permanent.

Temporary failures MUST include cooldown-based unavailability such as rate limiting, model unsupported cooldown, workspace deactivation cooldown, and transient token-refresh failure. Permanent failures MUST include missing aliases, explicitly disabled accounts, authentication invalidation, and irreversible token revocation.

#### Scenario: Temporary failure keeps the mapping
- GIVEN sticky sessions are enabled
- AND a sticky mapping exists for the request identity hash
- AND the mapped alias is temporarily unavailable
- AND no replacement account is available
- WHEN the request fails using current selection semantics
- THEN the system MUST keep the sticky mapping for later retries
- AND the request outcome MUST remain consistent with current error behavior

#### Scenario: Permanent failure removes the mapping
- GIVEN sticky sessions are enabled
- AND a sticky mapping exists for the request identity hash
- AND the mapped alias has failed permanently
- AND no replacement account is available
- WHEN the request fails using current selection semantics
- THEN the system MUST remove the sticky mapping
- AND the request outcome MUST remain consistent with current error behavior

### Requirement: Force Mode Precedence Over Sticky Routing
Force mode MUST take precedence over sticky routing. When force mode is active, the system MUST follow the current forced-alias behavior and MUST NOT allow sticky lookup or sticky reassignment to override that forced choice.

#### Scenario: Force mode bypasses sticky routing
- GIVEN sticky sessions are enabled
- AND force mode is active for a forced alias
- AND a sticky mapping exists for the request identity hash
- WHEN the request is routed
- THEN the system MUST follow force-mode selection semantics
- AND the system MUST NOT override the forced alias through sticky routing

### Requirement: Sticky Session Verification Coverage
The change MUST be delivered TDD-first with focused automated checks that prove flag-off parity, canonical identity gating, first-assignment persistence, healthy sticky reuse, replacement reassignment, no-replacement temporary retention, no-replacement permanent cleanup, force-mode precedence, and the guarantee that sticky reuse does not advance `rotationIndex`.

#### Scenario: Verification covers sticky-session behavior
- GIVEN the sticky-session change is implemented
- WHEN automated verification is prepared for the change
- THEN the test suite MUST include focused checks for all sticky-session routing branches that alter externally visible behavior or persisted state

## MODIFIED Requirements

## REMOVED Requirements
