## ADDED Requirements

### Requirement: Intent signal classification
The system SHALL support five intent complexity signals: `trivial`, `simple`, `moderate`, `complex`, and `architectural`. The human SHALL assign the signal when creating the intent brief in the inception schema.

#### Scenario: Valid signal values
- **WHEN** an intent brief is created with signal `moderate`
- **THEN** the system SHALL accept the value and proceed with team selection

#### Scenario: Invalid signal value
- **WHEN** an intent brief is created with an unrecognized signal value
- **THEN** the system SHALL reject the value and prompt for a valid signal

### Requirement: Signal-to-team mapping for inception loop
The conductor SHALL map intent signals to team configurations for the Phase 1 inception loop: trivial → skip inception, simple → solo agent, moderate → 3-agent lean mob, complex → 5-agent full mob, architectural → 5-agent full mob with extra architect iterations.

#### Scenario: Routing table lookup
- **WHEN** the conductor reads an intent brief with signal `architectural`
- **THEN** it SHALL select the 5-agent full mob configuration with an additional architecture deep-dive phase

### Requirement: Team configuration definitions
The system SHALL maintain team configuration definitions that specify: which agent personas to include, the task list template to use, the expected artifact outputs, and the estimated token budget.

#### Scenario: Lean mob configuration
- **WHEN** the lean-mob configuration is loaded
- **THEN** it SHALL specify 3 agents (analyst, architect, critic), the inception schema's artifact set, and task assignments mapping agents to artifact types

#### Scenario: Full mob configuration
- **WHEN** the full-mob configuration is loaded
- **THEN** it SHALL specify 5 agents (analyst, architect, domain-modeler, qa-strategist, critic), the full inception artifact set, and parallel track assignments (requirements track + system-context track)

### Requirement: Signal nudging from prior context
When an intent brief is created, the system SHALL suggest a signal value based on contextual heuristics: number of existing specs touched, whether it is greenfield or brownfield, and estimated component count.

#### Scenario: Greenfield suggestion
- **WHEN** an intent targets a new capability with no existing specs
- **THEN** the system SHALL suggest `complex` as the default signal

#### Scenario: Single-spec modification suggestion
- **WHEN** an intent modifies a single existing spec with clear scope
- **THEN** the system SHALL suggest `simple` as the default signal

#### Scenario: Human override
- **WHEN** the system suggests a signal value
- **THEN** the human SHALL be able to accept or override the suggestion

### Requirement: Conductor as Ralph-TUI pre-execution hook
The intent routing conductor SHALL be implemented as a Ralph-TUI pre-execution hook for inception beads. It reads the intent brief, determines the team configuration, and passes parameters to Ralph-TUI before agents are spawned.

#### Scenario: Hook execution before team spawn
- **WHEN** Ralph-TUI begins processing an inception bead
- **THEN** the conductor hook SHALL execute first, read the intent-brief frontmatter, resolve the team configuration, and pass it to Ralph-TUI

#### Scenario: Hook provides team parameters
- **WHEN** the conductor hook completes
- **THEN** Ralph-TUI SHALL have received: team size, list of agent persona files, task list template path, and AgentDeck pool session identifier
