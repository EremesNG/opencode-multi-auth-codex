# Proposal: Dashboard Two-Section UX Redesign

## Intent

### Problem Statement

The current React dashboard preserves a large feature surface, but its information architecture is still clumsy for day-to-day operation. The user has explicitly rejected the current UX/UI as inefficient, confusing, and not user-friendly. The clearest pain is the split between Overview and Accounts: operators must mentally switch between separate areas for information that belongs to the same workflow, and add-account entry points appearing in both places create duplication and uncertainty. The dashboard must return to an operational model where account health and quota visibility are central, while configuration-heavy controls move out of the main operational path.

### Goals

- Reduce the top-level dashboard experience to two sections only: **Dashboard** and **Settings**.
- Make **Dashboard** the primary operational surface by combining Overview, Accounts, and Operations into one coherent workspace.
- Restore a clear overview of every account's status and quota consumption without forcing operators into a separate Accounts screen.
- Move configuration-oriented controls such as force mode, sticky-session controls, and presets into **Settings**.
- Remove duplicate or conflicting entry points for account creation and related global actions.
- Keep the redesign parity-aware by reusing the current dashboard data surface, including per-account state already available in `DashboardState.accounts[]`.

## Scope

### In Scope

- Redefine the approved dashboard information architecture from four top-level areas to two top-level sections.
- Specify how Overview, Accounts, and operational observability/actions are merged into a single Dashboard experience.
- Specify that Settings owns configuration, force-mode controls, sticky-session administration, presets, and related runtime settings.
- Define the expected user-visible behavior changes needed to remove duplicate account workflows and improve operational clarity.
- Define verification and rollback guidance suitable for follow-up accelerated SDD tasks.

### Out of Scope

- Implementing the UI redesign in React code during this proposal task.
- Introducing new backend capabilities, changing `/api/*` contracts, or altering account/store semantics unless later specs explicitly require additive support.
- Build, packaging, or deployment changes.
- Reworking the local debug/runtime environment beyond using `http://localhost:5173/` as the manual verification surface.

## Approach

The redesign SHALL shift the product from route-first navigation to task-first operation.

### Proposed Two-Section Information Architecture

1. **Dashboard**
   - Serves as the default operator workspace.
   - Combines:
     - **Overview**: global health, quota consumption, sync/login/queue visibility, and high-signal summaries.
     - **Accounts**: account list, filters, search, status, tags/notes, enable/disable, switch, re-auth, refresh, remove, and add-account workflows.
     - **Operations**: logs, recent activity, long-running action feedback, and operational panels that support ongoing work.
   - MUST present per-account status and quota visibility together so operators can understand state and act without switching top-level sections.

2. **Settings**
   - Owns configuration-oriented surfaces that are not part of the primary operational loop.
   - Includes runtime configuration, force mode, sticky-session settings, presets, thresholds, feature flags, and related advanced controls.
   - MUST separate high-frequency operations from low-frequency configuration so the main dashboard stays focused.

### User-Visible Behavior Changes

- Operators land in a single Dashboard surface instead of choosing between separate Overview and Accounts destinations.
- Account creation MUST have one primary entry path inside Dashboard to eliminate the current duplicated add-account experience.
- Dashboard MUST show every account's operational status and quota consumption in-context, matching the user's expectation from the earlier UI.
- Global actions, queue visibility, and observability cards SHOULD be consolidated where they support live operations instead of being scattered across unrelated areas.
- Settings becomes the canonical place for configuration and advanced controls, reducing accidental context switches during normal account operations.

### Execution Direction for Follow-up Tasks

- Treat the existing React dashboard as the implementation base, not a restart.
- Update canonical dashboard UX specs to reflect the approved two-section IA and remove the previous four-area assumption.
- Use existing `DashboardState.accounts[]` fields such as `enabled`, `rateLimits`, `limitsConfidence`, `tags`, `notes`, and `usageCount` as the parity baseline for merged Dashboard views.
- Prioritize navigation, duplicate-action removal, and operational clarity before visual polish.

## Affected Areas

- `openspec/specs/dashboard-operator-ui/spec.md` — future spec updates will need to replace the current four-area navigation requirement.
- `openspec/specs/dashboard-api-contract/spec.md` — future work must confirm the two-section UI remains contract-compatible with current dashboard state APIs.
- `openspec/specs/dashboard-sticky-session-admin/spec.md` — future work must keep sticky-session controls under Settings while preserving current semantics.
- `web/src/components/*` and related headless/component tests — expected implementation targets for later tasks, but not modified by this proposal.

## Risks

- Merging Overview, Accounts, and Operations can create a crowded Dashboard if the layout is not intentionally prioritized.
- Existing specs currently encode a four-area navigation model, so implementation without spec alignment would create governance drift.
- Over-consolidation could hide rarely used but important operational actions if hierarchy inside Dashboard is not explicit.
- Moving force mode and sticky-session controls into Settings must preserve discoverability for operators who use those controls regularly.

## Rollback Plan

- Keep the redesign scoped so the current React navigation can be restored if the merged Dashboard proves less usable.
- Avoid backend contract changes as part of this change family so rollback remains a frontend-only concern.
- Verify the redesign first in local debugging at `http://localhost:5173/` before any broader rollout decision.
- If operator testing shows the merged Dashboard increases confusion, revert to the prior navigation structure while retaining any non-destructive internal component cleanup.

## Success Criteria

- The project has an actionable proposal for a two-section dashboard IA aligned with the user's approved direction.
- The proposal explicitly resolves the Overview-versus-Accounts confusion and removes duplicate add-account behavior.
- The proposal preserves the requirement that operators can see every account's status and quota consumption from the main Dashboard workspace.
- The proposal keeps configuration/force/sticky/presets under Settings and excludes build or packaging work from scope.
- The artifact is ready for accelerated follow-up planning into implementation tasks.
