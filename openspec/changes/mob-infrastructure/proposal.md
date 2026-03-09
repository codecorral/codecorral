## Why

The three-loop AI-DLC lifecycle (inception → bolt elaboration → construction) requires orchestration infrastructure before any phase-specific work can begin. Each loop needs bead creation, session dispatch, loop transition logic, and configuration. Without this foundation, the phase-specific changes (inception, bolt elaboration, construction) have no execution substrate.

This change provides the conductor, loop sequencing, session management (pool model + phase groups), TuiCR integration, intent routing mechanics, and Ralph base configuration that all three phases depend on.

## What Changes

- Define conductor orchestration: bead creation for Loops 1 and 2, loop transition logic (Loop 1→2→3), and completion detection
- Define intent signal classification and signal-to-action routing (mechanism only — team configurations live in [mob-agent-team-prompting](../mob-agent-team-prompting/proposal.md))
- Define AgentDeck session management: pool model for inception, phase-based session groups (Ideation, Elaboration, Review, Construction), and TuiCR review gate lifecycle
- Define loop orchestration: three distinct Ralph invocations, loop sequencing enforcement, Ralph base config
- Provide base `.ralph-tui/config.toml` configuration

## Capabilities

### New Capabilities
- `conductor-orchestration`: Script that reads intent-brief frontmatter, classifies signals, creates beads for Loops 1 and 2, manages loop transitions, and monitors bead status for completion detection
- `session-orchestration`: AgentDeck pool model for inception sessions, phase-based session groups (D7), TuiCR dynamic review sessions at phase boundaries, session activation/deactivation lifecycle
- `ralph-base-config`: Base `.ralph-tui/config.toml` (tracker=beads-rust, agent=claude, autoCommit=true) shared across all three loops

### Modified Capabilities

## Impact

**Source artifacts in mob-forge:**
- Conductor orchestration logic
- `.ralph-tui/config.toml` — base Ralph configuration
- AgentDeck session management definitions

**Runtime dependencies:**
- AgentDeck for session pool and phase groups
- Ralph-TUI for loop execution (Loops 2 and 3)
- beads-rust (br) for bead creation, status monitoring, and close operations
- OpenSpec CLI for change status queries

## Related Changes

| Change | Relationship |
|--------|-------------|
| [mob-agent-team-prompting](../mob-agent-team-prompting/proposal.md) | Sibling — provides team configs consumed by conductor routing |
| [mob-phase-inception](../mob-phase-inception/proposal.md) | Depends on this — uses pool model, conductor dispatch, Loop 1 orchestration |
| [mob-phase-bolt-elaboration](../mob-phase-bolt-elaboration/proposal.md) | Depends on this — uses conductor Loop 1→2 transition, Ralph base config |
| [mob-phase-construction](../mob-phase-construction/proposal.md) | Depends on this — uses conductor Loop 2→3 transition, Ralph base config |
