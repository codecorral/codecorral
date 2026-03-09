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

#### Scenario: Inception with agent teams
- **WHEN** the intent signal is `moderate`, `complex`, or `architectural`
- **THEN** the conductor SHALL launch an interactive Claude Code session with agent teams enabled, NOT a Ralph `--print` session

#### Scenario: Simple inception via Ralph
- **WHEN** the intent signal is `simple`
- **THEN** Ralph MAY execute the inception bead in `--print` mode using subagents (Agent tool) instead of agent teams, since subagents work within single-prompt sessions

### Requirement: Bolt-elaboration prompt template
A Handlebars template at `.ralph-tui/templates/bolt-elaboration.hbs` SHALL instruct the agent to: create a bolt schema OpenSpec change for the unit, generate proposal/design/specs artifacts, create construction beads via `br`, close the bead, and document progress.

#### Scenario: Template uses task context
- **WHEN** the bolt-elaboration template is rendered
- **THEN** it SHALL include `{{taskTitle}}` (unit name), `{{taskDescription}}` (unit definition from units.md), `{{epicTitle}}` (intent name), and `{{labels}}` (bolt type: simple or ddd)

#### Scenario: DDD bolt conditional
- **WHEN** the bead label is `ddd`
- **THEN** the template SHALL include instructions for domain modeling, ADRs, and detailed technical architecture in the design artifact

#### Scenario: Simple bolt conditional
- **WHEN** the bead label is `simple`
- **THEN** the template SHALL instruct the agent to skip the design artifact and proceed directly from proposal to specs

#### Scenario: Beads creation in template
- **WHEN** the agent reaches the beads artifact step
- **THEN** the template SHALL instruct the agent to create a br epic with `--external-ref` linking to the bolt change's specs directory, then create child beads with dependencies

### Requirement: Construction prompt template
A Handlebars template at `.ralph-tui/templates/construction.hbs` SHALL instruct the agent to: review the bolt change's specs for BDD scenarios, implement the bead's task, verify acceptance criteria, close the bead, and document progress.

#### Scenario: Template references spec context
- **WHEN** the construction template is rendered for a bead whose epic has `--external-ref` pointing to specs
- **THEN** the template SHALL instruct the agent to read the referenced spec files for acceptance criteria

#### Scenario: Completion signal
- **WHEN** the agent completes the bead's implementation
- **THEN** the template SHALL instruct the agent to close the bead via `br close`, sync via `br sync --flush-only`, and emit `<promise>COMPLETE</promise>`

### Requirement: One bead per loop for inception and bolt-elaboration
The inception loop SHALL execute as a single bead. Each unit's bolt-elaboration SHALL execute as a single bead. Internal phasing is handled by the agent (via agent teams in Loop 1, or sequential artifact creation in Loop 2) — not by multiple beads.

#### Scenario: Inception is one bead
- **WHEN** the inception loop starts
- **THEN** exactly one bead SHALL exist in the inception epic, covering all internal phases

#### Scenario: Bolt-elaboration is one bead per unit
- **WHEN** bolt-elaboration starts for N units
- **THEN** the bolt epic SHALL contain exactly N beads, one per unit

### Requirement: Construction loop runs many beads per unit
The construction loop SHALL execute the beads created by Loop 2's beads artifact. Each bead is a focused coding session.

#### Scenario: Bead-driven construction
- **WHEN** Loop 2 has produced beads for unit `user-auth`
- **THEN** Ralph-TUI SHALL iterate through those beads, executing each as a separate `--print` Claude Code session

#### Scenario: Bead dependencies respected
- **WHEN** construction bead B is blocked by bead A
- **THEN** Ralph-TUI SHALL not execute bead B until bead A is complete (enforced by `br ready`)

#### Scenario: Parallel construction
- **WHEN** construction beads have no mutual dependencies
- **THEN** Ralph-TUI SHALL execute them in parallel using worktree isolation when `--parallel` is specified

### Requirement: Bead creation for Loop 1 and Loop 2
A conductor script SHALL create the beads that drive Loops 1 and 2. Loop 1 gets one epic with one bead (the inception task). Loop 2 gets one epic with N beads (one per unit, with dependencies from bolt-plan).

#### Scenario: Inception bead creation
- **WHEN** the conductor processes a new intent
- **THEN** it SHALL create a br epic `inception-{intent-name}` with one child bead containing the intent brief

#### Scenario: Bolt beads from units.md
- **WHEN** the inception loop completes and units.md exists
- **THEN** the conductor SHALL create a br epic `bolt-{intent-name}` with one child bead per unit, labeled with bolt type, and dependencies wired per bolt-plan

### Requirement: Loop 2 beads artifact feeds Loop 3 directly
When a bolt-elaboration bead creates construction beads via `br`, those beads SHALL be immediately available for Ralph-TUI to execute in Loop 3 without manual intervention.

#### Scenario: Seamless loop transition
- **WHEN** bolt-elaboration for unit X creates construction beads
- **THEN** Ralph-TUI SHALL be able to run `ralph-tui run --epic construction-{intent}-{unit-x}` immediately

### Requirement: AgentDeck session lifecycle for inception loop
The inception loop SHALL activate a pre-configured AgentDeck session when starting mob elaboration and return it to idle when the inception completes.

#### Scenario: Session activation
- **WHEN** the conductor launches an inception mob elaboration
- **THEN** it SHALL activate the AgentDeck pool session and launch the Claude Code agent team within it

#### Scenario: Session deactivation
- **WHEN** the inception agent team shuts down and the inception bead is closed
- **THEN** the conductor SHALL return the AgentDeck session to idle

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
