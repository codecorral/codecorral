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
