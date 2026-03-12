# CodeCorral

## Project Overview
CodeCorral is the orchestration layer for AI-DLC (AI-Driven Development Lifecycle). It implements a three-loop architecture (inception, bolt elaboration, construction) that coordinates agent teams, manages bead-driven task execution, and provides human review gates.

## Architecture
- **Conductor** — Central orchestration script that routes intents, creates beads, and manages loop transitions
- **Three-loop lifecycle:**
  - Loop 1 (Inception): Pool model via AgentDeck, one bead per intent
  - Loop 2 (Bolt Elaboration): Ralph `--print` mode, one bead per unit
  - Loop 3 (Construction): Ralph `--parallel` mode with worktrees, many beads per unit
- **Intent routing** maps complexity signals (trivial/simple/moderate/complex/architectural) to team sizing and execution strategy

## Key Dependencies
- [openspec](https://github.com/madswan-dev/openspec) — Change management
- [ralph-tui](https://github.com/madswan-dev/ralph-tui) — Autonomous loop execution
- [agent-deck](https://github.com/asheshgoplani/agent-deck) — Session management
- [beads-rust](https://github.com/madswan-dev/beads-rust) — Task tracking
- [openmob](https://github.com/codecorral/openmob) — Mob elaboration ceremonies
- [shuffle](https://github.com/codecorral/shuffle) — Agent-deck configuration

## Commands
```bash
nix build .#openspec-schemas   # Build schema package
nix flake check                # Validate flake
```

## Project Structure
```
codecorral/
  openspec/
    changes/         # Active change proposals
    schemas/         # JSON schemas (e.g. dev.codecorral.intent)
    specs/           # Main specifications
    config.yaml      # OpenSpec configuration
  nix/
    hm-module.nix    # Home Manager module for schema distribution
  flake.nix          # Nix flake — builds & distributes schemas
```

## Development Guidelines
- Use OpenSpec for all design changes — proposals before implementation
- Design decisions are numbered (D1, D2, ...) for traceability
- Bead taxonomy follows AI-DLC conventions
- Construction beads use worktree isolation: `wt/construction-{intent}-{unit}-{task-id}`
- Schemas are distributed as a Nix package via `flake.nix` + Home Manager module
