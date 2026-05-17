# Dashboard Operator UI

## Requirements

### Requirement: Parity-First Operator Surface
The dashboard UI MUST preserve all operator-facing capabilities currently available in the existing dashboard before any redesign work is considered complete. Visual or structural improvements MUST NOT ship as a substitute for missing operational behavior.

#### Scenario: A redesign is evaluated against current operator workflows
- GIVEN the current dashboard already supports a correctness-critical set of operational actions
- WHEN the redesigned UI is reviewed for release readiness
- THEN every current dashboard capability MUST remain reachable in the new UI
- AND missing parity for any current operator workflow MUST block the redesign from being considered complete

### Requirement: Clear Two-Section Information Architecture and Navigation
The dashboard MUST expose exactly two primary top-level destinations: `Dashboard` and `Settings`. `Dashboard` MUST be the default operator workspace and MUST combine overview, account-management, and operational observability workflows into one coherent surface. `Settings` MUST own configuration-heavy controls such as force mode, sticky-session administration, presets, thresholds, and the Antigravity subsection when that feature is enabled. Navigation MUST NOT keep Overview, Accounts, Configuration, or Operations as separate primary top-level destinations.

#### Scenario: Operators navigate the redesigned dashboard
- GIVEN the dashboard contains overview data, account management, configuration controls, operational actions, and optional Antigravity functionality
- WHEN an operator uses the redesigned UI
- THEN the UI MUST present `Dashboard` and `Settings` as the only primary navigation destinations
- AND overview, account-management, and operational observability flows MUST remain reachable from within `Dashboard`
- AND Antigravity MUST remain discoverable only through `Settings`, command search, or safe legacy redirects when the feature is enabled

### Requirement: Legacy Dashboard Route Compatibility
Legacy dashboard routes MUST redirect operators to the canonical two-section destinations without reviving the obsolete four-area information architecture.

#### Scenario: An operator follows an old dashboard route
- GIVEN an operator or bookmark uses a legacy route such as `/accounts`, `/operations`, `/configuration`, or `/antigravity`
- WHEN the route is opened in the redesigned dashboard
- THEN `/accounts` and `/operations` MUST resolve to the canonical `Dashboard` destination
- AND `/configuration` MUST resolve to `Settings`
- AND `/antigravity` MUST resolve to the Settings-hosted Antigravity destination when available, or fall back to `Settings` when the feature is unavailable

### Requirement: Account Management Workspace Parity
The dashboard MUST provide a usable account-management workspace that preserves account discovery, filters, sorting, enable or disable actions, removal, re-authentication, active-account switching, token refresh, limits refresh, tags, notes, manual add, and auto-login workflows.

#### Scenario: Operators manage accounts from the redesigned workspace
- GIVEN multiple accounts exist with different health, metadata, and operational states
- WHEN an operator searches, filters, sorts, or acts on those accounts in the redesigned UI
- THEN the UI MUST preserve the account-management workflows available today
- AND the UI MUST expose the current account metadata and controls needed to operate without falling back to the legacy dashboard

### Requirement: Live Operational Feedback
The dashboard MUST preserve polling-driven live feedback for login progress, queue status, sync progress, limit refresh activity, and success or error notifications. The UI MUST surface asynchronous feedback in a way that is visible, timely, and resilient to long-running operations.

#### Scenario: An operator watches a long-running workflow
- GIVEN an operator starts a workflow such as auto-login, re-authentication, sync, or limits refresh
- WHEN that workflow continues after the initiating click
- THEN the dashboard MUST keep the operator informed through live state, progress indicators, queue visibility, or notifications
- AND the operator MUST be able to understand whether the workflow is running, succeeded, failed, or needs another action

### Requirement: Responsive, Dark, and Accessible Baseline UX
The dashboard MUST support responsive operation on common desktop and narrow layouts, MUST provide a dark theme baseline consistent with the current operator environment, and MUST meet a minimum accessibility baseline for keyboard navigation, labeling, focus visibility, and status messaging.

#### Scenario: The redesigned dashboard is used in varied operator environments
- GIVEN operators may use the dashboard on different viewport sizes and with keyboard-centric workflows
- WHEN the redesigned UI is rendered and interacted with
- THEN the UI MUST remain usable at narrow and wide viewport sizes without hiding critical actions behind inaccessible flows
- AND core controls, dialogs, navigation, and live status messaging MUST remain perceivable and keyboard accessible

### Requirement: Dashboard UI Verification Coverage
The change MUST define verification for dashboard smoke coverage, focused UI or component tests where the frontend setup supports them, and parity checks for the highest-risk operator workflows.

#### Scenario: Verification protects the redesigned operator experience
- GIVEN the redesign changes the dashboard architecture and interaction model
- WHEN verification scope is defined for the change
- THEN the plan MUST include at least dashboard smoke coverage and parity checks for core operator workflows
- AND the plan SHOULD include focused UI or component tests for navigation, live feedback, and destructive or high-risk actions when the chosen frontend test setup supports them
