# Sticky Session Persistence

## Requirements

### Requirement: Versioned Sticky Sidecar Storage
When sticky sessions are enabled, the system MUST persist sticky mappings in a dedicated sidecar file named `sticky-sessions.json` under the existing store directory, separate from `accounts.json`. The sidecar MUST use a versioned schema and MUST store only minimal sticky metadata required for reuse and cleanup.

Minimal sticky metadata MUST include the canonical identity hash key, mapped alias, creation timestamp, and last-used timestamp. The sidecar MUST NOT store raw identities, prompt bodies, raw `prompt_cache_key` values, account tokens, or unrelated telemetry.

#### Scenario: Sticky mapping is stored in the sidecar
- GIVEN sticky sessions are enabled
- AND a sticky mapping is created or updated
- WHEN the mapping is persisted
- THEN the system MUST write it to `sticky-sessions.json` in the configured store directory
- AND the persisted record MUST use the versioned sticky schema with minimal metadata only

### Requirement: Deterministic Hashed Identity Keys
The system MUST persist only deterministic one-way hashes of normalized canonical identities so the same canonical identity resolves to the same sticky key across process restarts without exposing the raw identifier on disk.

#### Scenario: Equivalent identities map to one hashed key
- GIVEN two requests normalize to the same canonical identity
- WHEN sticky persistence resolves their storage key
- THEN the system MUST produce the same hashed key for both requests
- AND the persisted sidecar MUST NOT contain the raw identity value

### Requirement: Bounded Retention and Cleanup
The sticky sidecar MUST remain bounded by TTL and LRU cleanup, maximum entry count, and maximum file-size protections. The system MUST remove expired entries and least-recently-used entries before persisting data that would exceed configured limits.

#### Scenario: Cleanup prunes expired or least-recently-used entries
- GIVEN sticky sessions are enabled
- AND the sidecar contains expired entries or exceeds configured entry or size limits
- WHEN the sidecar is loaded or updated
- THEN the system MUST prune expired entries first
- AND the system MUST evict least-recently-used entries as needed to restore limits before completing the write

### Requirement: Atomic and Secure Sticky Writes
Sticky sidecar updates MUST use atomic write behavior, safe replacement, and the same shared write-lock discipline used for the primary store so concurrent updates do not leave partial files behind. The sidecar file and its temporary replacements MUST use secure local permissions equivalent to the current store protections.

#### Scenario: Sticky data is written atomically
- GIVEN sticky sessions are enabled
- AND a sticky mapping change must be persisted
- WHEN the sidecar is written
- THEN the system MUST serialize the update through the shared write-lock discipline
- AND the system MUST write through a temporary file and atomic replacement flow
- AND the resulting sidecar file MUST be stored with secure local permissions

### Requirement: Disabled-Flag Persistence Bypass
When the sticky-session feature flag is OFF, the system MUST NOT read from or write to `sticky-sessions.json`, and the presence of an old sidecar file MUST NOT change current routing behavior.

#### Scenario: Existing sidecar is ignored while flag is off
- GIVEN sticky sessions are disabled
- AND `sticky-sessions.json` already exists
- WHEN a request is routed
- THEN the system MUST ignore sticky-sidecar contents
- AND the request outcome MUST remain identical to the current non-sticky flow

### Requirement: Corruption Isolation and Self-Healing Cleanup
Corruption or invalid entries in `sticky-sessions.json` MUST be isolated from `accounts.json` and MUST NOT corrupt normal account-store behavior. The system MUST discard invalid sticky entries during load, preserve valid sticky entries when possible, and continue using current routing/error semantics if sticky data cannot be recovered.

#### Scenario: Sidecar corruption does not break account selection
- GIVEN sticky sessions are enabled
- AND `sticky-sessions.json` contains corrupt or schema-invalid content
- WHEN the sidecar is loaded
- THEN the system MUST avoid corrupting `accounts.json`
- AND the system MUST discard or repair invalid sticky content on a best-effort basis
- AND requests without recoverable sticky state MUST fall back to current routing semantics

### Requirement: Sticky Persistence Verification Coverage
The change MUST include focused automated checks for sidecar schema versioning, hashed-only persistence, flag-off bypass, TTL/LRU cleanup, entry and size limit enforcement, corruption handling, and atomic-write or lock-coordination behavior.

#### Scenario: Verification covers sticky-sidecar persistence
- GIVEN the sticky-sidecar change is implemented
- WHEN automated verification is prepared for the change
- THEN the test suite MUST include focused checks for the persistence guarantees that protect correctness, privacy, and bounded growth
