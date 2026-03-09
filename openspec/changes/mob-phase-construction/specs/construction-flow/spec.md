## ADDED Requirements

### Requirement: Construction loop runs many beads per unit
The construction loop SHALL execute the beads created by Loop 2's beads artifact. Each bead is a focused coding session.

#### Scenario: Bead-driven construction
- **WHEN** Loop 2 has produced beads for unit `user-auth`
- **THEN** Ralph-TUI SHALL iterate through those beads, executing each as a separate `--print` Claude Code session

### Requirement: Bead dependencies respected
Ralph-TUI SHALL not execute a construction bead until all beads it depends on are complete.

#### Scenario: Bead dependencies respected
- **WHEN** construction bead B is blocked by bead A
- **THEN** Ralph-TUI SHALL not execute bead B until bead A is complete (enforced by `br ready`)

### Requirement: Parallel construction with worktrees
When construction beads have no mutual dependencies, Ralph-TUI SHALL execute them in parallel using worktree isolation.

#### Scenario: Parallel construction
- **WHEN** construction beads have no mutual dependencies
- **THEN** Ralph-TUI SHALL execute them in parallel using worktree isolation when `--parallel` is specified

### Requirement: Loop 3 Ralph-TUI settings
Loop 3 SHALL use `--iterations 20`, the construction template, and optionally `--parallel 3` for independent beads.

#### Scenario: Loop 3 invocation
- **WHEN** Ralph-TUI is invoked for Loop 3
- **THEN** it SHALL use `ralph-tui run --epic construction-{intent}-{unit} --prompt .ralph-tui/templates/construction.hbs --iterations 20 --parallel 3`

### Requirement: Loop 2 to Loop 3 gating
Construction beads for a unit SHALL not be available until that unit's bolt-elaboration bead is closed.

#### Scenario: Per-unit gating
- **WHEN** bolt-elaboration for unit X is not closed
- **THEN** construction beads for unit X SHALL not be available in `br ready`

### Requirement: Worktree branch naming
Each parallel construction session SHALL run in a dedicated git worktree with a predictable branch name.

#### Scenario: Worktree branch naming
- **WHEN** a construction bead is executed in parallel mode
- **THEN** it SHALL run in a worktree with branch name `wt/construction-{intent}-{unit}-{task-id}`
