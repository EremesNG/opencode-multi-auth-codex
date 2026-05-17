# Tasks: Persistent Sticky Sessions

## Phase 1: TDD Baseline and RED Coverage
- [x] 1.1 Extend `tests/unit/feature-flags.test.ts` for **Sticky Session Flag Gating** and **Disabled-Flag Persistence Bypass** from `specs/sticky-session-routing/spec.md` and `specs/sticky-session-persistence/spec.md`.
  **Verification**:
  - Run: `npm run test -- tests/unit/feature-flags.test.ts --runInBand`
  - Expected: New sticky-session assertions fail first because the flag and bypass behavior are not implemented yet, while unrelated existing assertions remain green.

- [x] 1.2 Add focused request-identity RED coverage in `tests/unit/index-sticky.test.ts` for **Canonical Sticky Identity Resolution**, **No canonical identity is available**, and **Prompt cache key is present without explicit identity authorization**.
  **Verification**:
  - Run: `npm run test -- tests/unit/index-sticky.test.ts --runInBand`
  - Expected: The new suite fails first because canonical sticky identity resolution and request plumbing are not implemented yet.

- [x] 1.3 Add sidecar-contract RED coverage in `tests/unit/sticky-sessions.test.ts` for **Versioned Sticky Sidecar Storage**, **Deterministic Hashed Identity Keys**, **Bounded Retention and Cleanup**, **Atomic and Secure Sticky Writes**, and **Corruption Isolation and Self-Healing Cleanup**.
  **Verification**:
  - Run: `npm run test -- tests/unit/sticky-sessions.test.ts --runInBand`
  - Expected: The new suite fails first because the sticky sidecar module and persistence helpers do not exist yet.

- [x] 1.4 Extend `tests/unit/rotation-strategy.test.ts` with RED scenarios for **Initial Sticky Assignment**, **Healthy sticky account is reused**, **Sticky alias falls back to another valid account**, **Temporary failure keeps the mapping**, **Permanent failure removes the mapping**, and **Force mode bypasses sticky routing**.
  **Verification**:
  - Run: `npm run test -- tests/unit/rotation-strategy.test.ts --runInBand`
  - Expected: New sticky-routing assertions fail first, proving routing behavior is still non-sticky before production changes.

## Phase 2: Settings and Sticky Persistence Foundations
- [x] 2.1 Implement sticky-session types and default-OFF settings in `src/types.ts` and `src/settings.ts`, including `stickySessionsEnabled`, sticky policy types, and persisted-settings support required by the new RED tests.
  **Verification**:
  - Run: `npm run test -- tests/unit/feature-flags.test.ts --runInBand`
  - Expected: Sticky feature-flag defaults and persisted-settings assertions pass, with sticky behavior still inert outside the flag.

- [x] 2.2 Extract or expose the minimum shared persistence primitives in `src/store.ts` and implement `src/sticky-sessions.ts` for path resolution, identity normalization/hashing, schema validation, TTL/LRU pruning, file-size/entry caps, corruption salvage, and atomic sidecar writes under the shared write lock.
  **Verification**:
  - Run: `npm run test -- tests/unit/sticky-sessions.test.ts --runInBand`
  - Expected: Sidecar storage persists only hashed identity keys plus minimal metadata, prunes correctly, and reuses secure atomic-write coordination without touching `accounts.json` semantics.

## Phase 3: Request Identity Plumbing
- [x] 3.1 Implement canonical sticky-identity resolution in `src/index.ts`, using only the allowlisted hierarchy from the design, rejecting empty identities, and excluding `prompt_cache_key` unless explicitly authorized by sticky policy.
  **Verification**:
  - Run: `npm run test -- tests/unit/index-sticky.test.ts --runInBand`
  - Expected: Identity-resolution tests pass for header/body sources, missing identity fallback, and prompt-cache-key exclusion by default.

- [x] 3.2 Wire resolved sticky context from `src/index.ts` into `getNextAccount()` without changing non-sticky request behavior when the flag is OFF or no canonical identity is available.
  **Verification**:
  - Run: `npm run test -- tests/unit/index-sticky.test.ts tests/unit/feature-flags.test.ts --runInBand`
  - Expected: Request plumbing stays backward-compatible while sticky context is available only for opted-in requests.

## Phase 4: Sticky Routing Integration
- [x] 4.1 Extend `src/rotation.ts` and related selection context types to perform sticky lookup only after force-mode short-circuiting, reuse healthy mapped aliases without advancing `rotationIndex`, and classify temporary vs permanent sticky failures.
  **Verification**:
  - Run: `npm run test -- tests/unit/rotation-strategy.test.ts --runInBand`
  - Expected: Sticky-hit scenarios reuse the mapped alias, preserve force precedence, and keep `rotationIndex` unchanged on reuse.

- [x] 4.2 Complete fallback reassignment and commit-time sticky updates in `src/rotation.ts` using `src/sticky-sessions.ts`, ensuring replacement selection reuses current strategy semantics and updates/removes mappings only after the chosen account is confirmed usable.
  **Verification**:
  - Run: `npm run test -- tests/unit/rotation-strategy.test.ts tests/unit/sticky-sessions.test.ts --runInBand`
  - Expected: Replacement selection updates the sticky mapping correctly, temporary exhaustion retains mappings, permanent exhaustion removes them, and sidecar state remains bounded.

## Phase 5: Focused Regression and Delivery Checks
- [x] 5.1 Add any narrow coordination regression needed in `tests/unit/store.test.ts` for shared write-lock or path-helper behavior that sticky persistence depends on, but only if the new sidecar tests expose uncovered store-helper seams.
  **Verification**:
  - Run: `npm run test -- tests/unit/store.test.ts tests/unit/sticky-sessions.test.ts --runInBand`
  - Expected: Shared persistence helpers remain backward-compatible for `accounts.json` while supporting sticky-sidecar coordination.

- [x] 5.2 Run the focused sticky-session regression matrix across feature flags, identity plumbing, sidecar persistence, routing, and helper coordination.
  **Verification**:
  - Run: `npm run test -- tests/unit/feature-flags.test.ts tests/unit/index-sticky.test.ts tests/unit/sticky-sessions.test.ts tests/unit/rotation-strategy.test.ts tests/unit/store.test.ts --runInBand`
  - Expected: All sticky-session focused suites pass together with no regressions in the changed areas.

- [x] 5.3 Run the repository type-check/lint gate after the focused suites pass.
  **Verification**:
  - Run: `npm run lint`
  - Expected: TypeScript completes without errors for the sticky-session changes, with no build step executed.

## Execution Order
Work strictly TDD-first: create RED tests for flags, identity plumbing, sidecar persistence, and routing before any production change; then implement settings/persistence primitives, then request plumbing, then routing integration, and finish with focused regression plus `npm run lint`. Do not run `npm run build`.
