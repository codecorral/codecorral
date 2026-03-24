## ADDED Requirements

### Requirement: Recursive child session teardown
The engine SHALL provide a `stopSessionTree` function that stops a session and all its descendants. It SHALL list sessions via `agent-deck list --json` filtered by the workflow's title prefix, then call `agent-deck session show --json` on each to discover the `parent` field (which is not available in `list --json` output). It SHALL recurse depth-first into children, then stop the target session. `stopSession` SHALL treat exit code 2 (not found) as success for idempotent teardown.

Note: agent-deck limits parent-child to two levels — `set-parent` rejects if the parent is itself a child. The recursion handles this correctly but never goes deeper than one level in practice.

#### Scenario: Stop session with no children
- **WHEN** `stopSessionTree` is called for title `cc-abc12345-setup` and no sessions have `parent` matching that title (after querying each via `show`)
- **THEN** only `agent-deck session stop "cc-abc12345-setup"` is executed

#### Scenario: Stop session with children
- **WHEN** `stopSessionTree` is called for title `cc-abc12345-agent` and `session show` reveals two sessions with `parent: "cc-abc12345-agent"`
- **THEN** both children are stopped first (depth-first), then `cc-abc12345-agent` is stopped

#### Scenario: Stop already-removed session succeeds
- **WHEN** `agent-deck session stop` returns exit code 2 (not found)
- **THEN** `stopSessionTree` treats this as success and continues

### Requirement: stopSession actor supports recursive mode
The `stopSession` service actor SHALL accept an optional `recursive` boolean parameter. When `recursive` is `true`, the actor SHALL call `stopSessionTree` instead of a direct `agent-deck session stop`.

#### Scenario: Recursive stop via service actor
- **WHEN** `stopSession` is invoked with `{ title: "cc-abc12345-agent", recursive: true }`
- **THEN** `stopSessionTree` is called, stopping all descendants before the target

#### Scenario: Non-recursive stop (default)
- **WHEN** `stopSession` is invoked with `{ title: "cc-abc12345-agent" }` (no recursive flag)
- **THEN** only `agent-deck session stop "cc-abc12345-agent"` is executed

### Requirement: Session lifecycle sequencing
The engine SHALL enforce the session lifecycle sequence: `running → stopped → removed`. The `removeSession` actor SHALL only be invoked after a session has been stopped. Workflow definitions are responsible for this sequencing via state machine transitions (stop in teardown state, remove in cleanup state).

#### Scenario: Stop then remove sequence
- **WHEN** a workflow transitions through `TEARDOWN` (invokes `stopSession`) then `CLEANUP` (invokes `removeSession`)
- **THEN** the session is first stopped, then removed in separate sequential states

### Requirement: Discovery of workflow sessions
The engine SHALL provide a function to discover all sessions belonging to a workflow instance by listing sessions and filtering by the deterministic title prefix (`cc-{shortId}-*`).

#### Scenario: Discover all sessions for a workflow
- **WHEN** `discoverWorkflowSessions` is called with instance ID `test-v0.2-abc12345`
- **THEN** it calls `agent-deck list --json` and returns all sessions whose title starts with `cc-abc12345`
