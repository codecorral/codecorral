# intent-schema Specification

## Purpose
TBD - created by archiving change intent-schema. Update Purpose after archive.
## Requirements
### Requirement: Intent schema definition
The intent schema SHALL be a valid OpenSpec custom schema at `openspec/schemas/intent/schema.yaml` defining five artifacts: `intent-brief`, `requirements`, `system-context`, `units`, and `bolt-plan`.

#### Scenario: Schema scaffolding
- **WHEN** a user runs `openspec new change <name> --schema intent`
- **THEN** the system SHALL create a change directory with the five-artifact structure defined by the intent schema

#### Scenario: Schema listed
- **WHEN** a user runs `openspec schemas`
- **THEN** the intent schema SHALL appear with its description and artifact DAG

### Requirement: Artifact dependency graph
The schema SHALL define artifact dependencies as: `intent-brief` has no dependencies; `requirements` and `system-context` each require `intent-brief`; `units` requires both `requirements` and `system-context`; `bolt-plan` requires `units`.

#### Scenario: Parallel generation of requirements and system-context
- **WHEN** `intent-brief` is complete and the user runs `openspec status`
- **THEN** both `requirements` and `system-context` SHALL show status `ready`

#### Scenario: Units blocked until both predecessors complete
- **WHEN** `requirements` is complete but `system-context` is not
- **THEN** `units` SHALL show status `blocked` with `system-context` in `missingDeps`

#### Scenario: Bolt-plan blocked until units complete
- **WHEN** `units` is not yet complete
- **THEN** `bolt-plan` SHALL show status `blocked` with `units` in `missingDeps`

### Requirement: Intent-brief artifact normalizes human input
The `intent-brief` artifact SHALL expand whatever the human provides (short phrase, sentence, or detailed document) into a consistent structured format with sections: Problem Statement, Desired Outcome, Scope, Stakeholders, and Constraints.

#### Scenario: Brief input expanded
- **WHEN** the human provides a one-sentence intent like "add dark mode support"
- **THEN** the generated intent-brief SHALL contain all five sections with content inferred from the input and project context

#### Scenario: Detailed input normalized
- **WHEN** the human provides a multi-page specification document as the intent
- **THEN** the generated intent-brief SHALL distill it into the same five-section format without inventing requirements beyond what is stated or clearly implied

### Requirement: Requirements artifact captures lightweight intent-level requirements
The `requirements` artifact SHALL capture user stories, use cases, non-functional requirements, and boundaries that scope the intent. This is lighter than formal spec-driven specs — no SHALL/scenario format required within the artifact content itself.

#### Scenario: Requirements structure
- **WHEN** the requirements artifact is generated from an intent-brief
- **THEN** it SHALL contain sections for User Stories, Use Cases, Non-Functional Requirements, and Boundaries

#### Scenario: Requirements bound the intent
- **WHEN** a user reads the requirements artifact
- **THEN** it SHALL be clear what is in scope and out of scope for this intent

### Requirement: System-context artifact positions the intent in the system landscape
The `system-context` artifact SHALL describe the system landscape from a C4 perspective: where the system lives, its context boundary, adjacent systems, the impact of this intent on the landscape, and relevant technical constraints.

#### Scenario: System-context structure
- **WHEN** the system-context artifact is generated from an intent-brief
- **THEN** it SHALL contain sections for System Landscape, Context Boundary, Adjacent Systems, Impact Analysis, and Technical Landscape

#### Scenario: System-context grounds the intent
- **WHEN** a user reads the system-context artifact
- **THEN** it SHALL be clear how this intent relates to the broader system architecture and what existing systems it touches

### Requirement: Units artifact identifies discrete work chunks
The `units` artifact SHALL decompose the intent into independently deliverable units. Each unit SHALL have a name, brief description, deliverable, and dependency relationships to other units.

#### Scenario: Unit identification
- **WHEN** the units artifact is generated from requirements and system-context
- **THEN** it SHALL list each unit with a name, description (2-3 sentences), deliverable statement, and inter-unit dependencies

#### Scenario: Unit briefs generated
- **WHEN** the units artifact is complete
- **THEN** a `units/<unit-name>/unit-brief.md` file SHALL exist for each identified unit, containing a description sufficient to seed a Loop 2 spec-driven proposal

#### Scenario: Units are mutable during exploration
- **WHEN** the user revises the units artifact (adding or removing units)
- **THEN** the corresponding `units/<unit-name>/` directories SHALL be added or removed to match

### Requirement: Bolt-plan artifact bridges inception to construction
The `bolt-plan` artifact SHALL define the execution plan for Loop 2: unit ordering by wave/dependency, priority assignments, and the information needed to create elaboration beads for each unit.

#### Scenario: Bolt-plan structure
- **WHEN** the bolt-plan artifact is generated from finalized units
- **THEN** it SHALL contain wave-based ordering of units with dependencies and priorities

#### Scenario: Bolt-plan enables bead creation
- **WHEN** a user reads the bolt-plan
- **THEN** it SHALL contain sufficient information to create one elaboration bead per unit for Loop 2 dispatch

### Requirement: Each artifact has a template
Each of the five artifacts SHALL have a corresponding template file in `openspec/schemas/intent/templates/` that defines the document structure.

#### Scenario: Template files exist
- **WHEN** the intent schema is installed
- **THEN** template files SHALL exist at `templates/intent-brief.md`, `templates/requirements.md`, `templates/system-context.md`, `templates/units/unit-brief.md`, and `templates/bolt-plan.md`

### Requirement: Each artifact has generation instructions
Each artifact definition in `schema.yaml` SHALL include an `instruction` field with guidance for AI-assisted first-draft generation, describing what the artifact should contain, how to derive it from its dependencies, and quality criteria.

#### Scenario: Instructions guide generation
- **WHEN** `openspec instructions <artifact-id> --change <name>` is run for an intent schema change
- **THEN** the returned instruction SHALL describe the artifact's purpose, input sources, and output expectations

