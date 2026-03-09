## ADDED Requirements

### Requirement: Three distinct loop invocations
Ralph-TUI SHALL support three loop configurations, each as a separate invocation with its own epic, prompt template, and settings. Loop 1 (inception) monitors an externally-driven bead. Loop 2 (bolt elaboration) runs per-unit beads in `--print` mode. Loop 3 (construction) runs implementation beads in `--print` mode with parallel support.

#### Scenario: Loop 2 invocation
- **WHEN** Ralph-TUI is invoked with `--epic bolt-{intent} --prompt .ralph-tui/templates/bolt-elaboration.hbs`
- **THEN** it SHALL process bolt-elaboration beads for each unit in the epic

#### Scenario: Loop 3 invocation
- **WHEN** Ralph-TUI is invoked with `--epic construction-{intent}-{unit} --prompt .ralph-tui/templates/construction.hbs --parallel 3`
- **THEN** it SHALL process construction beads with up to 3 parallel workers using worktree isolation

### Requirement: Loop 1 uses interactive Claude, not Ralph --print mode
Because agent teams require a persistent interactive session and Ralph spawns Claude with `--print` (single prompt, exits after response), the inception loop SHALL NOT use Ralph's standard agent spawn for mob elaboration. Instead, the inception bead SHALL be executed via an interactive Claude Code session (directly or via AgentDeck) and Ralph SHALL monitor bead status for loop transition.

### Requirement: One bead per loop for inception and bolt-elaboration
The inception loop SHALL execute as a single bead. Each unit's bolt-elaboration SHALL execute as a single bead. Internal phasing is handled by the agent (via agent teams in Loop 1, or sequential artifact creation in Loop 2) — not by multiple beads.

#### Scenario: Inception is one bead
- **WHEN** the inception loop starts
- **THEN** exactly one bead SHALL exist in the inception epic, covering all internal phases

#### Scenario: Bolt-elaboration is one bead per unit
- **WHEN** bolt-elaboration starts for N units
- **THEN** the bolt epic SHALL contain exactly N beads, one per unit

### Requirement: Bead creation for Loop 1 and Loop 2
A conductor script SHALL create the beads that drive Loops 1 and 2. Loop 1 gets one epic with one bead (the inception task). Loop 2 gets one epic with N beads (one per unit, with dependencies from bolt-plan).

#### Scenario: Inception bead creation
- **WHEN** the conductor processes a new intent
- **THEN** it SHALL create a br epic `inception-{intent-name}` with one child bead containing the intent brief

#### Scenario: Bolt beads from units.md
- **WHEN** the inception loop completes and units.md exists
- **THEN** the conductor SHALL create a br epic `bolt-{intent-name}` with one child bead per unit, labeled with bolt type, and dependencies wired per bolt-plan

### Requirement: Loop sequencing
The conductor SHALL enforce that Loop 1 completes before Loop 2 beads execute, and Loop 2 completes for a unit before its Loop 3 beads execute.

#### Scenario: Phase ordering
- **WHEN** the inception bead is not closed
- **THEN** bolt-elaboration beads SHALL not be created or executed

#### Scenario: Per-unit gating
- **WHEN** bolt-elaboration for unit X is not closed
- **THEN** construction beads for unit X SHALL not be available in `br ready`

### Requirement: Ralph config supports loop-specific settings
The project's `.ralph-tui/config.toml` SHALL provide sensible defaults, with loop-specific settings applied via CLI flags at invocation time.

#### Scenario: Base config
- **WHEN** `.ralph-tui/config.toml` is read
- **THEN** it SHALL specify `tracker = "beads-rust"`, `agent = "claude"`, `autoCommit = true`

#### Scenario: Loop 2 settings
- **WHEN** Loop 2 is invoked
- **THEN** it SHALL use `--iterations 10` and the bolt-elaboration template, without parallel mode

#### Scenario: Loop 3 settings
- **WHEN** Loop 3 is invoked
- **THEN** it SHALL use `--iterations 20`, the construction template, and optionally `--parallel 3` for independent beads

### Requirement: AgentDeck session lifecycle for inception loop
The inception loop SHALL activate a pre-configured AgentDeck session when starting mob elaboration and return it to idle when the inception completes.

#### Scenario: Session activation
- **WHEN** the conductor launches an inception mob elaboration
- **THEN** it SHALL activate the AgentDeck pool session and launch the Claude Code agent team within it

#### Scenario: Session deactivation
- **WHEN** the inception agent team shuts down and the inception bead is closed
- **THEN** the conductor SHALL return the AgentDeck session to idle
