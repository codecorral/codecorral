## ADDED Requirements

### Requirement: Custom OpenSpec schema for inception
The system SHALL provide an OpenSpec schema at `openspec/schemas/inception/` that defines the artifact types and dependency graph for Phase 1 inception workflows.

#### Scenario: Schema discovery
- **WHEN** a new OpenSpec change is created with `--schema inception`
- **THEN** OpenSpec SHALL scaffold the change directory with all inception artifact slots

### Requirement: Five inception artifact types
The inception schema SHALL define the following artifact types: `intent-brief`, `requirements`, `system-context`, `units`, and `bolt-plan`.

#### Scenario: Artifact inventory
- **WHEN** `openspec status --change <name> --json` is run on an inception change
- **THEN** the response SHALL list all five artifact types with their status and dependencies

### Requirement: Intent-brief is the root artifact
The `intent-brief` artifact SHALL have no dependencies and serve as the root of the dependency graph. All other artifacts depend on it directly or transitively.

#### Scenario: Intent-brief always ready
- **WHEN** a new inception change is created
- **THEN** the intent-brief artifact SHALL have status `ready`

### Requirement: Intent signal metadata in intent-brief
The intent-brief artifact template SHALL include a YAML frontmatter field `signal` with allowed values: `trivial`, `simple`, `moderate`, `complex`, `architectural`. This field drives team size selection for mob elaboration.

#### Scenario: Signal field present
- **WHEN** an intent-brief artifact is created from the template
- **THEN** it SHALL contain a `signal` field in its frontmatter that the human fills in

### Requirement: Parallel elaboration branch for requirements and system-context
The `requirements` and `system-context` artifacts SHALL both depend only on `intent-brief`, enabling parallel creation by separate agents or agent groups during mob elaboration.

#### Scenario: Phase 1 parallelism
- **WHEN** the intent-brief artifact is marked done
- **THEN** requirements and system-context SHALL both transition to `ready` status simultaneously

### Requirement: Requirements artifact captures user stories and acceptance criteria
The `requirements` artifact SHALL contain functional requirements (FR-N format), non-functional requirements, user stories with acceptance criteria in Given/When/Then format, and open questions for the human.

#### Scenario: Requirements content
- **WHEN** the requirements artifact is created
- **THEN** it SHALL contain at least one functional requirement with a corresponding BDD acceptance criterion

### Requirement: System-context artifact captures boundaries and interfaces
The `system-context` artifact SHALL contain system boundary definitions, external interface descriptions, a system context diagram (mermaid), constraints, and stakeholder analysis.

#### Scenario: System-context content
- **WHEN** the system-context artifact is created
- **THEN** it SHALL contain a mermaid system context diagram showing the system boundary and its external interfaces

### Requirement: Units artifact depends on requirements and system-context
The `units` artifact SHALL depend on both `requirements` and `system-context`, because unit decomposition requires knowing both what the system should do and how it is structured.

#### Scenario: Unit decomposition blocked until elaboration complete
- **WHEN** requirements is done but system-context is not
- **THEN** the units artifact SHALL remain in `blocked` status

#### Scenario: Unit decomposition unblocked
- **WHEN** both requirements and system-context are done
- **THEN** the units artifact SHALL transition to `ready`

### Requirement: Units artifact defines independently developable work packages
Each unit in the `units` artifact SHALL have: a name (kebab-case), a description of its scope, defined boundaries (what it includes and excludes), dependencies on other units, and the suggested bolt type (simple or ddd).

#### Scenario: Unit structure
- **WHEN** the units artifact is read
- **THEN** each unit entry SHALL contain name, scope, boundaries, dependencies, and bolt-type fields

### Requirement: Bolt-plan artifact depends on units
The `bolt-plan` artifact SHALL depend on `units` and define the execution order for unit elaboration in Phase 2, including which units can be elaborated in parallel and which have sequential dependencies.

#### Scenario: Bolt-plan ordering
- **WHEN** the bolt-plan artifact is created
- **THEN** it SHALL specify an ordered sequence of units to elaborate, with parallel groups where unit dependencies allow

### Requirement: Bolt-plan is the apply-requires target
The inception schema SHALL define `bolt-plan` as the apply-requires artifact. When the bolt-plan is complete, the inception change is ready to drive Phase 2.

#### Scenario: Apply-requires gate
- **WHEN** `openspec status --json` reports the bolt-plan as done
- **THEN** the inception change SHALL be marked as apply-ready

### Requirement: Human-review sentinel between elaboration and decomposition
The schema SHALL support an optional human-review sentinel artifact between the parallel elaboration artifacts (requirements, system-context) and the units artifact. This sentinel has no template — it is marked done manually by the human after reviewing Phase 1 elaboration outputs.

#### Scenario: Gate between elaboration and decomposition
- **WHEN** a human-review sentinel is configured between elaboration and decomposition
- **THEN** the units artifact SHALL remain blocked until the human marks the sentinel as done, even if requirements and system-context are both complete
