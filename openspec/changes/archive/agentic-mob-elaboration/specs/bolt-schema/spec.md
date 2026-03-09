## ADDED Requirements

### Requirement: Custom OpenSpec schema for bolt elaboration
The system SHALL provide an OpenSpec schema at `openspec/schemas/bolt/` that defines the artifact types and dependency graph for Phase 2 per-unit bolt elaboration.

#### Scenario: Schema discovery
- **WHEN** a new OpenSpec change is created with `--schema bolt`
- **THEN** OpenSpec SHALL scaffold the change directory with all bolt artifact slots

### Requirement: Four bolt artifact types
The bolt schema SHALL define the following artifact types: `proposal`, `design`, `specs`, and `beads`.

#### Scenario: Artifact inventory
- **WHEN** `openspec status --change <name> --json` is run on a bolt change
- **THEN** the response SHALL list all four artifact types with their status and dependencies

### Requirement: Proposal artifact scoped to one unit
The bolt schema's `proposal` artifact SHALL be pre-populated with context from the inception change — the unit's name, scope, boundaries, bolt type, and relevant requirements from the inception's requirements.md.

#### Scenario: Unit context in proposal
- **WHEN** a bolt change is scaffolded for unit `user-auth` from inception `auth-system`
- **THEN** the proposal template SHALL include the unit's scope and boundaries from the inception units.md

### Requirement: Design artifact supports bolt-type-specific depth
The `design` artifact SHALL support two levels of depth based on bolt type. DDD bolts SHALL include domain model, ADRs, and detailed technical architecture. Simple bolts MAY omit the design artifact entirely.

#### Scenario: DDD bolt design
- **WHEN** a bolt change has bolt type `ddd`
- **THEN** the design artifact instructions SHALL require domain model (entities, aggregates, bounded contexts), technical architecture, and at least one ADR for significant decisions

#### Scenario: Simple bolt design optional
- **WHEN** a bolt change has bolt type `simple`
- **THEN** the design artifact SHALL be optional — the schema SHALL allow skipping it and proceeding directly from proposal to specs

### Requirement: Specs artifact defines BDD requirements for the unit
The `specs` artifact SHALL follow the same format as the spec-driven schema's specs — one spec file per capability within the unit, with requirements and Given/When/Then scenarios.

#### Scenario: BDD scenarios present
- **WHEN** the specs artifact is created for a unit
- **THEN** each requirement SHALL have at least one scenario in Given/When/Then format

### Requirement: Beads artifact replaces tasks
The `beads` artifact SHALL replace the spec-driven schema's `tasks` artifact. Instead of producing a tasks.md Markdown checklist, the beads artifact SHALL create beads via `br` (beads-rust) that Ralph-TUI executes in Loop 3.

#### Scenario: Beads creation
- **WHEN** the beads artifact is created
- **THEN** the system SHALL run `br` commands to create an epic for the unit and child beads for each implementable task

#### Scenario: Bead granularity
- **WHEN** beads are created from the specs
- **THEN** each bead SHALL be scoped to one focused coding session — small enough to complete in a single Claude Code session

### Requirement: Beads artifact is the apply-requires target
The bolt schema SHALL define `beads` as the apply-requires artifact. When beads are created, the bolt change is ready to drive Loop 3 construction.

#### Scenario: Apply-requires gate
- **WHEN** `openspec status --json` reports the beads artifact as done
- **THEN** the bolt change SHALL be marked as apply-ready and Ralph-TUI SHALL be able to execute the beads in Loop 3

### Requirement: Beads reference their source specs
Each bead created by the beads artifact SHALL include metadata linking it back to the spec scenarios it implements. This enables traceability from construction back through specs → design → proposal → unit → inception.

#### Scenario: Bead traceability
- **WHEN** a bead is created for implementing requirement FR-3 scenario "successful login"
- **THEN** the bead's description or metadata SHALL reference the spec file, requirement name, and scenario name

### Requirement: Beads dependency graph from specs
The beads artifact SHALL establish dependency ordering between beads based on the specs — beads for foundational requirements (data models, core APIs) SHALL be created before beads for features that depend on them.

#### Scenario: Bead ordering
- **WHEN** spec requirement FR-2 depends on FR-1's data model
- **THEN** the bead for FR-2 SHALL be marked as blocked by the bead for FR-1

### Requirement: Bolt schema supports OpenSpec verification
After Loop 3 construction completes for a unit, `opsx:verify` SHALL be able to verify the implementation against the bolt change's specs — checking that all BDD scenarios are satisfied.

#### Scenario: Post-construction verification
- **WHEN** `opsx:verify --change <unit-change>` is run after construction
- **THEN** it SHALL check each spec scenario against the implementation and report pass/fail
