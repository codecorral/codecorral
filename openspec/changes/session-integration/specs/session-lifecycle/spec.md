## ADDED Requirements

### Requirement: Recursive child session teardown
The engine SHALL provide a `stopSessionTree` function that stops a session and all its descendants. It SHALL list all sessions via `agent-deck list --json`, identify children by matching the `parent` field to the target title, recurse depth-first into each child, then stop the target session.

#### Scenario: Stop session with no children
- **WHEN** `stopSessionTree` is called for title `cc-abc12345-setup` and no sessions have `parent` matching that title
- **THEN** only `agent-deck session stop "cc-abc12345-setup"` is executed

#### Scenario: Stop session with children
- **WHEN** `stopSessionTree` is called for title `cc-abc12345-agent` and two sessions have `parent: "cc-abc12345-agent"` — `cc-abc12345-sub1` and `cc-abc12345-sub2`
- **THEN** `cc-abc12345-sub1` and `cc-abc12345-sub2` are stopped first (depth-first), then `cc-abc12345-agent` is stopped

#### Scenario: Stop session with nested children
- **WHEN** `stopSessionTree` is called for title `parent` which has child `child1`, and `child1` has child `grandchild1`
- **THEN** `grandchild1` is stopped first, then `child1`, then `parent`

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
