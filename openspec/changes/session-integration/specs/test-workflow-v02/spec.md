## ADDED Requirements

### Requirement: test-v0.2 workflow definition
The engine SHALL ship with a `test-v0.2` workflow definition registered in the definition registry at startup alongside `test-v0.1`. This definition SHALL have 5 states: `idle` (initial), `setup`, `agent_working`, `teardown`, and `done` (final), plus a `setup_failed` (final) error state.

#### Scenario: test-v0.2 available at startup
- **WHEN** the engine starts
- **THEN** the definition registry contains both `test-v0.1` and `test-v0.2`

### Requirement: test-v0.2 state transitions
The `test-v0.2` definition SHALL support the following transitions:
- `idle` → `setup` on event `start`
- `setup` → `agent_working` on `createSession` service `onDone`
- `setup` → `setup_failed` on `createSession` service `onError`
- `agent_working` → `teardown` on event `impl.complete`
- `teardown` → `done` on `stopSession` and `removeSession` services completing sequentially via an internal teardown sequence

#### Scenario: Happy path through all states
- **WHEN** events `start` then `impl.complete` are sent in sequence, with session services succeeding
- **THEN** the instance transitions through `idle → setup → agent_working → teardown → done`

#### Scenario: Session creation failure
- **WHEN** `start` is sent and the `createSession` service fails
- **THEN** the instance transitions to `setup_failed`

### Requirement: test-v0.2 invokes createSession in setup state
The `setup` state SHALL invoke the `createSession` service actor with parameters derived from the workflow instance context: work path (current directory), deterministic session title, tool `claude`, worktree branch derived from instance ID, MCP server `workflow-engine`, and an initial message built via the session prompt builder.

#### Scenario: Session created on entering setup
- **WHEN** the machine enters the `setup` state
- **THEN** the `createSession` service actor is invoked with the correct parameters
- **AND** on success, the session title is stored in `context.sessionTitle`

### Requirement: test-v0.2 teardown invokes stopSession and removeSession
The `teardown` state SHALL invoke `stopSession` (with `recursive: true`) for the session title stored in context. On success, it SHALL then invoke `removeSession` for the same title. This MAY be implemented as a compound teardown state with substates or sequential invocations.

#### Scenario: Clean teardown
- **WHEN** the machine enters the `teardown` state with `context.sessionTitle` set to `cc-abc12345-setup`
- **THEN** `stopSession` is invoked with `{ title: "cc-abc12345-setup", recursive: true }`
- **AND** after stop succeeds, `removeSession` is invoked with `{ title: "cc-abc12345-setup" }`

#### Scenario: Teardown with stop failure
- **WHEN** `stopSession` fails during teardown
- **THEN** the machine transitions to `done` anyway (best-effort cleanup — session records are not critical)

### Requirement: test-v0.2 context
The `test-v0.2` definition SHALL maintain context fields: `sessionTitle` (string or null, set on `createSession` success), `sessionError` (string or null, set on any service error), `workStartedAt` (ISO timestamp, set on `start`).

#### Scenario: Context after successful setup
- **WHEN** the machine reaches `agent_working` state
- **THEN** `context.sessionTitle` contains the deterministic title and `context.sessionError` is null

#### Scenario: Context after setup failure
- **WHEN** the machine reaches `setup_failed` state
- **THEN** `context.sessionError` contains the error message and `context.sessionTitle` is null

### Requirement: test-v0.2 uses XState v5 actors field
The `test-v0.2` definition SHALL declare its service actors in the `setup({ actors: { ... } })` call, referencing `createSessionActor`, `stopSessionActor`, and `removeSessionActor` by name. This enables `.provide()` overrides for testing without agent-deck.

#### Scenario: Service actors overridable via provide
- **WHEN** a test creates an actor with `testWorkflowV02.provide({ actors: { createSession: mockCreateSession } })`
- **THEN** the machine uses the mock implementation instead of the real agent-deck CLI wrapper

### Requirement: test-v0.2 WFE_INSTANCE_ID in initial message
The initial message sent to the created session SHALL include the `WFE_INSTANCE_ID` value built via the session prompt builder, enabling the agent to call workflow MCP tools without explicit instance ID parameters.

#### Scenario: Instance ID in initial message
- **WHEN** `createSession` is invoked during `setup` for instance `test-v0.2-abc12345`
- **THEN** the initial message contains `export WFE_INSTANCE_ID="test-v0.2-abc12345"`
