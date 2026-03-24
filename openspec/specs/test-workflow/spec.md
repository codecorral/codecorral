## ADDED Requirements

### Requirement: test-v0.1 workflow definition
The engine SHALL ship with a hardcoded `test-v0.1` workflow definition registered in the definition registry at startup. This definition SHALL have 4 states: `idle` (initial), `working`, `reviewing`, and `done` (final).

#### Scenario: test-v0.1 available at startup
- **WHEN** the engine starts
- **THEN** the definition registry contains `test-v0.1` and it can be used to create workflow instances

### Requirement: test-v0.1 state transitions
The `test-v0.1` definition SHALL support the following transitions:
- `idle` → `working` on event `start`
- `working` → `reviewing` on event `submit`
- `reviewing` → `done` on event `review.approved` (guarded: `context.hasWork === true`)
- `reviewing` → `working` on event `review.revised`

#### Scenario: Happy path through all states
- **WHEN** events `start`, `submit`, `review.approved` are sent in sequence to an instance with `hasWork` set
- **THEN** the instance transitions through `idle → working → reviewing → done`

#### Scenario: Review revision loop
- **WHEN** `review.revised` is sent while in `reviewing` state
- **THEN** the instance transitions back to `working`

#### Scenario: Approval guard blocks without work
- **WHEN** `review.approved` is sent while in `reviewing` state but `context.hasWork` is false
- **THEN** the transition is rejected and the instance remains in `reviewing`

### Requirement: test-v0.1 context tracking
The `test-v0.1` definition SHALL maintain context fields: `hasWork` (boolean, set to true on `submit`, reset to false on `review.revised`), `submitCount` (number, incremented on each `submit`), `workStartedAt` (ISO timestamp, set on `start`).

#### Scenario: Context updated on start
- **WHEN** the `start` event is processed
- **THEN** `context.workStartedAt` is set to the current ISO timestamp

#### Scenario: Context updated on submit
- **WHEN** the `submit` event is processed
- **THEN** `context.hasWork` is set to `true` and `context.submitCount` is incremented by 1

#### Scenario: hasWork reset on revision
- **WHEN** the `review.revised` event is processed
- **THEN** `context.hasWork` is set to `false`, requiring a new `submit` before `review.approved` can succeed

#### Scenario: Context survives persistence round-trip
- **WHEN** an instance is persisted to disk and rehydrated on daemon restart
- **THEN** all context fields (`hasWork`, `submitCount`, `workStartedAt`) retain their values

### Requirement: test-v0.1 has no external dependencies
The `test-v0.1` definition SHALL NOT use invoked services, session management, view reconciliation, or conductor integration. All guards SHALL be synchronous context reads. All actions SHALL be synchronous context assignments.

#### Scenario: No invoked services
- **WHEN** the `test-v0.1` machine config is inspected
- **THEN** no state contains an `invoke` field

#### Scenario: All guards are synchronous
- **WHEN** any guard in `test-v0.1` is evaluated
- **THEN** it reads only from `context` and returns a boolean synchronously

### Requirement: Instance creation via CLI
Users SHALL be able to create a `test-v0.1` workflow instance via the CLI for testing and validation purposes.

#### Scenario: Create test instance
- **WHEN** the user runs `codecorral transition start --instance test-v0.1-mytest --definition test-v0.1`
- **THEN** a new workflow instance is created with ID `test-v0.1-mytest` using the `test-v0.1` definition, the `start` event is processed, and the instance transitions to `working`
## MODIFIED Requirements

### Requirement: test-v0.1 workflow definition
The engine SHALL ship with a hardcoded `test-v0.1` workflow definition registered in the definition registry at startup. This definition SHALL have 4 states: `idle` (initial), `working`, `reviewing`, and `done` (final). The `test-v0.2` definition SHALL be registered alongside it.

#### Scenario: test-v0.1 available at startup
- **WHEN** the engine starts
- **THEN** the definition registry contains `test-v0.1` and it can be used to create workflow instances

#### Scenario: Both test definitions available
- **WHEN** the engine starts
- **THEN** the definition registry contains both `test-v0.1` and `test-v0.2`

## ADDED Requirements

### Requirement: Migration from test-v0.1 to test-v0.2
The engine SHALL register a snapshot migration from schema version `test-v0.1` to `test-v0.2` in the migration registry. The migration SHALL map `idle` → `idle`, `working` → `agent_working`, `reviewing` → `agent_working`, and `done` → `done`. It SHALL add `sessionTitle: null` and `sessionError: null` to the context while preserving existing context fields.

#### Scenario: Migration applied during rehydration
- **WHEN** a persisted instance has `schemaVersion: "test-v0.1"` and the current definition version is `test-v0.2`
- **THEN** the migration function is found and applied, mapping the state value and extending the context

#### Scenario: Idle state preserved
- **WHEN** a `test-v0.1` instance in `idle` state is migrated
- **THEN** the resulting snapshot has state `idle` with added `sessionTitle: null` and `sessionError: null`

#### Scenario: Working state mapped to agent_working
- **WHEN** a `test-v0.1` instance in `working` state is migrated
- **THEN** the resulting snapshot has state `agent_working`

#### Scenario: Context fields preserved
- **WHEN** a `test-v0.1` instance with `submitCount: 3` is migrated
- **THEN** the migrated snapshot retains `submitCount: 3` alongside new fields
