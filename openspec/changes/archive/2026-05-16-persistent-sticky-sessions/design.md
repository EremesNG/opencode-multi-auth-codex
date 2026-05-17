# Design: Persistent Sticky Sessions

## Technical Approach
Sticky sessions will be implemented as an opt-in pre-selection layer on top of the existing account rotation pipeline, not as a new rotation strategy. The runtime will:

1. Resolve a canonical sticky identity in `src/index.ts` from an explicit allowlisted hierarchy.
2. Hash that normalized identity before it crosses the persistence boundary.
3. Pass the resolved sticky context into `getNextAccount()`.
4. Let `src/rotation.ts` try sticky reuse only after force-mode short-circuiting and before normal candidate iteration.
5. Persist sticky mappings in a dedicated sidecar file `sticky-sessions.json` stored next to `accounts.json`.
6. Keep `rotationIndex` unchanged on sticky reuse and only advance it when the existing rotation strategy actually selects a replacement.

The implementation MUST preserve current behavior when the feature flag is off or when no canonical identity can be derived.

## Architecture Decisions

### Decision: Feature-flag gate with conservative defaults
**Choice**: Add `featureFlags.stickySessionsEnabled = false` to runtime settings defaults and keep sticky persistence entirely bypassed unless that flag is enabled.

**Alternatives considered**:
- New top-level `stickySessions.enabled` boolean only.
- Environment-only flag with no persisted settings support.

**Rationale**:
- The repo already exposes optional behavior through `featureFlags`.
- Default-OFF parity is a hard spec requirement.
- Persisted settings allow the dashboard/API to enable the feature later without changing app code.

### Decision: Separate sticky configuration from the enablement flag
**Choice**: Keep enablement in `featureFlags`, and introduce a small `StickySessionSettings` type for internal/persisted policy values:
- `identitySources: StickyIdentitySource[]`
- `allowPromptCacheKey: boolean`
- `ttlMs: number`
- `maxEntries: number`
- `maxFileBytes: number`

Default policy:
- `identitySources`: `['header:session_id', 'header:conversation_id', 'body:metadata.session_id', 'body:metadata.conversation_id']`
- `allowPromptCacheKey`: `false`
- bounded retention defaults held in code constants, mirrored into defaults only if a persisted settings shape is preferred.

**Alternatives considered**:
- No sticky policy object, only hard-coded constants.
- Allow `prompt_cache_key` by default.

**Rationale**:
- The spec requires an explicit allowlisted identity hierarchy.
- `prompt_cache_key` is already used for outbound backend headers, but the spec explicitly forbids treating it as canonical identity by default.
- Separating policy from the on/off flag keeps the first release small while leaving room for safe future tuning.

### Decision: Dedicated sidecar module instead of expanding `store.ts` inline
**Choice**: Add a new module `src/sticky-sessions.ts` responsible for sticky-session persistence and identity hashing, while reusing store-path and write-lock primitives from `src/store.ts`.

**Alternatives considered**:
- Put sticky logic directly in `store.ts`.
- Persist sticky mappings inside `accounts.json`.

**Rationale**:
- The proposal/spec explicitly require a dedicated sidecar and corruption isolation from `accounts.json`.
- `store.ts` already has a lot of unrelated account-store concerns; a companion module keeps sticky persistence testable in isolation.

### Decision: Reuse current health semantics, classify permanence pragmatically
**Choice**: Reuse the current account state as the source of truth for fallback decisions:
- **Permanent**: alias missing, `enabled === false`, `authInvalid === true`, or token refresh results in `authInvalid` being set.
- **Temporary**: `rateLimitedUntil > now`, `modelUnsupportedUntil > now`, `workspaceDeactivatedUntil > now`, or `ensureValidToken()` fails without setting `authInvalid`.

**Alternatives considered**:
- Introduce a new explicit account-failure enum everywhere.
- Guess permanence from error strings.

**Rationale**:
- The current codebase already materializes temporary/permanent signals in account state.
- This avoids a large auth/rotation redesign that the proposal explicitly excludes.

### Decision: Update sticky mapping only after selection is confirmed usable
**Choice**: Persist sticky assignments only after the chosen account has passed health gating, returned a valid token, and the selection is being committed.

**Alternatives considered**:
- Assign sticky mapping before token validation.
- Rewrite sticky mapping on every attempted candidate.

**Rationale**:
- The spec requires first-assignment/reassignment only after successful selection.
- Pre-committing would pin identities to unusable aliases and create false stickiness.

## Data Flow

### Request path in `src/index.ts`
1. Parse request body as today.
2. Resolve `normalizedModel` as today.
3. Resolve sticky identity before calling `getNextAccount()`:
   - inspect request headers/body against the allowlisted hierarchy,
   - normalize the first explicit identity found,
   - hash only inside the sticky module or a shared helper,
   - if no canonical identity exists, pass `sticky: null`.
4. Call `getNextAccount(effectiveConfig, { model, sticky })`.
5. Keep all retry/error semantics unchanged outside sticky routing.

### Selection path in `src/rotation.ts`
1. Auto-clear expired force state.
2. If force mode is active, execute the existing forced-account branch unchanged and return immediately.
3. Build current `healthMap` and healthy alias pools as today.
4. If sticky sessions are disabled or no sticky identity exists, execute the current selection pipeline unchanged.
5. If a sticky mapping exists:
   - load mapped alias,
   - validate existence/enabled/health/model/workspace conditions,
   - call `ensureValidToken(mappedAlias)`.
6. On successful sticky reuse:
   - increment `usageCount`, `lastUsed`, `activeAlias`, `lastRotation`,
   - refresh sticky entry `lastUsedAt`,
   - DO NOT advance `rotationIndex`.
7. On sticky miss/failure with replacement candidates available:
   - exclude the unusable sticky alias from candidate aliases for this request,
   - run the current active strategy over the remaining valid aliases,
   - preserve the existing `nextIndex()` semantics for the replacement only,
   - update sticky mapping to the replacement alias after commit.
8. On sticky failure with no replacement candidates:
   - preserve current null/error semantics,
   - keep or remove mapping based on temporary vs permanent failure classification.

## File Changes

### New file
- `src/sticky-sessions.ts`
  - resolve sticky sidecar path from `path.dirname(getStorePath())`
  - define sidecar schema/types
  - normalize/hash identities
  - load/validate/prune/save mappings
  - expose `getStickyAssignment`, `upsertStickyAssignment`, `touchStickyAssignment`, `removeStickyAssignment`, `pruneStickySessions`, and read-only helpers for tests

### Modified files
- `src/types.ts`
  - add `stickySessionsEnabled` to `FeatureFlags`
  - add `StickyIdentitySource`, `StickySessionSettings`, `ResolvedStickyIdentity`, `StickySessionEntry`, `StickySessionsFile`
  - extend `RotationSettings` with optional sticky-session policy block if persisted policy is chosen
- `src/settings.ts`
  - add sticky-session defaults to the feature-flag defaults
  - optionally layer env overrides later without changing first implementation shape
  - keep `isFeatureEnabled('stickySessionsEnabled')` available for routing/persistence bypass
- `src/index.ts`
  - add canonical identity resolver helper(s)
  - derive sticky context before `getNextAccount()`
  - DO NOT infer identity from `prompt_cache_key` unless explicit policy authorizes it
- `src/rotation.ts`
  - extend `AccountSelectionContext` with `sticky?: ResolvedStickyIdentity | null`
  - wrap current candidate selection in a sticky-aware flow
  - preserve force-mode precedence and `rotationIndex` semantics
- `src/store.ts`
  - expose any minimal persistence helpers needed by the new sidecar module (prefer helper extraction over duplicating atomic-write code)
  - keep `accounts.json` and sticky sidecar isolated

### Test files
- `tests/unit/feature-flags.test.ts`
- `tests/unit/rotation-strategy.test.ts`
- `tests/unit/store.test.ts`
- `tests/unit/sticky-sessions.test.ts` (new, recommended)

## Interfaces / Contracts

### Settings/types
```ts
interface FeatureFlags {
  antigravityEnabled: boolean
  stickySessionsEnabled: boolean
}

type StickyIdentitySource =
  | 'header:session_id'
  | 'header:conversation_id'
  | 'body:metadata.session_id'
  | 'body:metadata.conversation_id'
  | 'body:prompt_cache_key'

interface StickySessionSettings {
  identitySources: StickyIdentitySource[]
  allowPromptCacheKey: boolean
  ttlMs: number
  maxEntries: number
  maxFileBytes: number
}

interface ResolvedStickyIdentity {
  source: StickyIdentitySource
  canonical: string
  hash: string
}
```

### Sidecar schema
```ts
interface StickySessionEntry {
  alias: string
  createdAt: number
  lastUsedAt: number
}

interface StickySessionsFile {
  version: 1
  updatedAt: number
  entries: Record<string, StickySessionEntry>
}
```

### Identity normalization
- trim whitespace
- lowercase header/body string identifiers
- collapse internal whitespace only if the source is known to be case-insensitive
- reject empty strings after normalization
- hash with `sha256(normalizedCanonicalIdentity)` and persist only the hex digest

### Persistence responsibilities in `src/sticky-sessions.ts`
- **Path**: `path.join(path.dirname(getStorePath()), 'sticky-sessions.json')`
- **Load**:
  - if feature flag is off, return an in-memory empty view and do not touch disk
  - if file missing, return empty schema
  - if file corrupt, salvage valid entries when possible; otherwise return empty schema without affecting `accounts.json`
- **Save**:
  - prune expired entries first
  - prune LRU until `maxEntries` and `maxFileBytes` are satisfied
  - serialize through shared write lock
  - write `tmp` file with `0o600`, `fsync`, rename, and directory `fsync`
- **Atomic write / permissions**:
  - reuse the same replacement flow already used by `saveStore()`
  - keep sidecar and temp files local-only (`0o600`)
  - create store dir with existing `0o700` behavior

## Testing Strategy

Implementation should be TDD-first in this order.

### Block 1 — RED: feature-flag parity
- add tests proving sticky bypass when `stickySessionsEnabled === false`
- verify existing sidecar file is ignored while flag is off
- suggested command:
  - `pnpm exec jest tests/unit/feature-flags.test.ts --runInBand`

### Block 2 — RED: sidecar persistence contract
- new `tests/unit/sticky-sessions.test.ts`
- cover schema versioning, hashed-only persistence, TTL pruning, LRU pruning, file-size cap, corruption isolation, and write-lock behavior
- suggested command:
  - `pnpm exec jest tests/unit/sticky-sessions.test.ts --runInBand`

### Block 3 — RED: routing integration
- extend `tests/unit/rotation-strategy.test.ts`
- cover:
  - first assignment persists mapping
  - healthy sticky reuse
  - sticky reuse does not advance `rotationIndex`
  - fallback replacement updates mapping
  - no replacement + temporary failure keeps mapping
  - no replacement + permanent failure removes mapping
  - force mode bypasses sticky routing
- suggested command:
  - `pnpm exec jest tests/unit/rotation-strategy.test.ts --runInBand`

### Block 4 — GREEN / refactor
- implement minimum production code to satisfy each failing block
- keep helper extraction small and verify focused suites after each block
- final focused regression pass:
  - `pnpm exec jest tests/unit/feature-flags.test.ts tests/unit/sticky-sessions.test.ts tests/unit/rotation-strategy.test.ts --runInBand`

No build step is required or allowed for this design task.

## Migration / Rollout

1. Ship feature flag default OFF.
2. Do not create/read `sticky-sessions.json` until the flag is enabled.
3. On first enabled sticky assignment, create the sidecar lazily.
4. Rollback path is trivial: disable the feature flag; the sidecar becomes inert.

## Open Questions

1. Whether `StickySessionSettings` should be persisted in `store.settings` from v1 or kept as internal constants for the first implementation. The design supports either, but implementation should prefer the smallest surface compatible with the spec.
2. Whether request headers carrying `session_id` / `conversation_id` are already propagated by OpenCode in all provider flows. If not, body metadata sources should remain the primary canonical path.

## What NOT to copy from PR #23

PR #23 could not be verified from this checkout or accessible remote metadata during design work, so implementation MUST use the spec as the source of truth and explicitly avoid these anti-patterns:

- do **not** store sticky mappings inside `accounts.json`
- do **not** persist raw `session_id`, `conversation_id`, or `prompt_cache_key`
- do **not** treat `prompt_cache_key` as canonical identity by default
- do **not** introduce a new rotation strategy for sticky behavior
- do **not** let sticky reuse override active force mode
- do **not** advance `rotationIndex` on sticky hits
- do **not** delete mappings for temporary cooldown/token-refresh failures
- do **not** update sticky mappings before the replacement account is actually usable
