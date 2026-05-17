# Proposal: Persistent Sticky Sessions

## Intent

Add opt-in sticky session reuse to the existing multi-account rotation flow so a session can keep using the same healthy account across requests, while still falling back to the current rotation strategy when that account becomes unavailable. The feature must persist from v1, default to OFF, and preserve current behavior for installations that do not enable it.

## Scope

### In Scope

- Introduce sticky-session persistence as a dedicated sidecar file named `sticky-sessions.json` under the existing store directory, separate from `accounts.json`.
- Persist only minimal sticky metadata keyed by a hashed session identity rather than raw session IDs.
- Integrate sticky reuse into the current selection flow in `src/rotation.ts` and `src/index.ts` as a pre-selection optimization, not as a new rotation strategy.
- Reuse an already assigned healthy account when sticky mode is enabled.
- If the assigned account is blocked, invalid, missing, or otherwise unusable, fall back to the active rotation strategy, assign the replacement account to the session, and persist the new mapping.
- Preserve force mode precedence: when force mode is active, sticky reuse SHALL NOT override the forced account.
- Preserve rotation semantics: sticky reuse SHALL NOT advance `rotationIndex`; the index only advances when the existing rotation strategy actually selects a replacement.
- Add bounded persistence controls: TTL/LRU cleanup, maximum entries/size protections, atomic write behavior, and shared locking discipline consistent with current store writes.
- Add tests first and verify an initial RED state before implementation, covering reuse, fallback reassignment, force-mode precedence, cleanup, and flag-off behavior.

### Out of Scope

- Creating a new rotation strategy or mandatory sticky routing mode.
- Storing sticky mappings inside `accounts.json`.
- Persisting raw session identifiers, prompt bodies, or broad per-session telemetry.
- Changing current force-mode semantics beyond preserving its precedence.
- Redesigning rate-limit, auth-refresh, or account-health policies outside the sticky-session integration points.
- UI/UX expansion beyond the minimum configuration surface required to expose an opt-in feature flag.

## Approach

The change will extend the current runtime/settings model with a default-OFF feature flag for sticky sessions, then layer sticky lookup into the existing account selection pipeline.

At a high level:

1. Identify the session using stable request-level identity already present in the runtime flow, normalize it, and hash it before persistence.
2. Load sticky metadata from `sticky-sessions.json` using the same store directory conventions as `accounts.json`.
3. Before invoking the normal candidate selection path, attempt sticky reuse when the feature is enabled and force mode is not active.
4. If the sticky account is still present and healthy, reuse it without advancing `rotationIndex`.
5. If the sticky account is no longer usable, run the current rotation strategy unchanged, then update the sticky assignment to the replacement account selected by that strategy.
6. Apply TTL/LRU and entry-size enforcement during load/save/update so the sidecar remains bounded and self-healing.
7. Reuse the project’s atomic write and lock discipline so sticky persistence remains crash-safe and consistent with existing store behavior.

## Affected Areas

- `src/rotation.ts` — inject sticky reuse and fallback reassignment into the current account-selection flow.
- `src/index.ts` — provide the request/session identity needed for sticky lookup alongside existing request normalization.
- `src/settings.ts` / `src/types.ts` — add the opt-in sticky feature flag and any bounded configuration metadata.
- `src/store.ts` or a dedicated companion module — shared persistence helpers, path resolution, atomic write/lock reuse, and sidecar coordination.
- `tests/unit/rotation-strategy.test.ts` — strategy integration and sticky fallback behavior.
- `tests/unit/store.test.ts` and/or new sticky persistence tests — sidecar persistence, cleanup, and locking guarantees.
- `tests/unit/feature-flags.test.ts` — default-OFF and persisted flag behavior.

## Risks

- Session identity drift could break reuse if different request paths produce inconsistent identifiers.
- Incorrect fallback handling could pin sessions to invalid accounts or accidentally bypass existing health checks.
- Updating sticky mappings at the wrong time could incorrectly advance round-robin state or bias least-used metrics.
- Sidecar corruption or concurrent writes could create stale mappings unless atomic writes and locking are explicit.
- Unbounded sticky growth could create disk bloat or degraded lookup performance without TTL/LRU and hard limits.
- Overexposing sticky state in APIs or logs could leak session-derived identifiers if hashing/minimal metadata is not enforced.

## Rollback Plan

- Disable the sticky-session feature flag to restore current routing behavior immediately.
- Stop reading or writing `sticky-sessions.json` when the flag is off.
- If operational issues appear after release, remove the sidecar integration while leaving `accounts.json` and existing rotation strategies unchanged.
- Because sticky state is isolated in a sidecar file, rollback does not require account-store migration or destructive rewriting of account data.

## Success Criteria

- With sticky mode OFF, account selection behaves exactly as it does today.
- With sticky mode ON, repeated requests for the same session reuse the assigned healthy account.
- When the sticky account becomes unavailable and another valid account exists, the current rotation strategy selects the replacement and the sticky assignment is updated.
- Force mode always wins over sticky reuse.
- Sticky reuse does not advance `rotationIndex`; replacement rotation does.
- Sticky persistence survives restart using `sticky-sessions.json` and stores only hashed identity plus minimal metadata.
- Cleanup keeps the sidecar bounded via TTL/LRU and size/entry caps.
- The change is implemented TDD-first with failing tests written before production code.
