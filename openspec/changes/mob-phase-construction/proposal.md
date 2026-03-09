## Why

Phase 3 (Construction) executes the beads created by bolt elaboration — each bead is a focused coding session that implements one piece of the spec. This is the existing Ralph-TUI `--parallel` workflow, extended to consume beads from the bolt schema and respect the dependency graph between construction tasks.

Construction needs three-loop integration: it consumes beads from Loop 2, executes them via Ralph `--print` mode with parallel worktree isolation, and respects bead dependency ordering so foundational code is built before dependent features.

## What Changes

- Define the construction flow: how Loop 3 processes beads from bolt elaboration, parallel execution with worktrees, dependency enforcement
- Define Ralph-TUI Loop 3 configuration: `--parallel` mode, iteration limits, worktree isolation settings

## Capabilities

### New Capabilities
- `construction-flow`: Phase 3 bead-driven coding with Ralph `--parallel`, worktree isolation for independent beads, bead dependency enforcement via `br ready`

### Modified Capabilities

## Impact

**Source artifacts in mob-forge:**
- Construction-specific Ralph-TUI invocation documentation
- Parallel execution and worktree configuration

**Runtime dependencies:**
- Ralph-TUI for parallel bead execution (`--parallel` flag)
- beads-rust (br) for bead dependency checking (`br ready`) and bead close
- Git worktrees for parallel isolation
- [mob-infrastructure](../mob-infrastructure/proposal.md) for conductor Loop 2→3 transition and Ralph base config
- [mob-agent-team-prompting](../mob-agent-team-prompting/proposal.md) for construction.hbs template

## Related Changes

| Change | Relationship |
|--------|-------------|
| [mob-infrastructure](../mob-infrastructure/proposal.md) | Depends on — uses conductor transitions, Ralph base config |
| [mob-agent-team-prompting](../mob-agent-team-prompting/proposal.md) | Depends on — uses construction.hbs template |
| [mob-phase-bolt-elaboration](../mob-phase-bolt-elaboration/proposal.md) | Upstream — consumes beads created by bolt elaboration |
| [mob-phase-inception](../mob-phase-inception/proposal.md) | Transitively upstream — inception produces units that drive bolt elaboration |
