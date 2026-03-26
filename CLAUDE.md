# CodeCorral

## Project Overview
CodeCorral is the workflow engine for AI-DLC (AI-Driven Development Lifecycle). It uses XState-based state machines to drive two composable workflow definitions — intent and unit — through structured development phases with human review gates. The engine coordinates agent teams via agent-deck, manages change artifacts via OpenSpec, and runs mob elaboration ceremonies via OpenMob.

## Architecture
- **Workflow Engine** — XState daemon that owns workflow definitions, state machines, transitions, guards, and actions
- **Conductor** — LLM bridge (one per profile) that polls the task board, delegates work to agent-deck sessions, and routes human approvals back into the engine
- **Two-workflow composition:**
  - **Intent workflow** (`dev.codecorral.intent`): Raw idea → elaboration → unit decomposition → publishes unit briefs to task board
  - **Unit workflow** (`dev.codecorral.unit`): Consumes unit briefs → elaboration → implementation → code review → verification
- **Task board** as anti-corruption layer between intent and unit workflows
- **Human review gates** — Explicit XState states where workflows pause for human approval

## Key Dependencies
- [openspec](https://github.com/madswan-dev/openspec) — Artifact-driven change management
- [agent-deck](https://github.com/asheshgoplani/agent-deck) — Session management for agent teams
- [openmob](https://github.com/codecorral/openmob) — Mob elaboration ceremony framework
- [shuffle](https://github.com/codecorral/shuffle) — Declarative agent-deck profile configuration

## Tech Stack
- **Runtime:** Bun
- **State machines:** XState v5
- **CLI:** Commander
- **MCP:** Model Context Protocol SDK
- **Distribution:** Nix flake + Home Manager module

## Commands
```bash
bun test                       # Run tests
bun run typecheck              # Type check
nix build .#openspec-schemas   # Build schema package
nix flake check                # Validate flake
```

## Project Structure
```
codecorral/
  src/
    actors/          # XState actor definitions
    cli/             # CLI entry point (commander)
    config/          # Project and workflow configuration
    daemon/          # Engine daemon lifecycle
    mcp/             # MCP server for tool integration
    persistence/     # XState snapshot persistence
  openspec/
    changes/         # Active and archived change proposals
    schemas/         # JSON schemas (e.g. dev.codecorral.intent)
    specs/           # Main specifications
    config.yaml      # OpenSpec configuration
  decks/
    codecorral.deck.yaml       # 6-group AI-DLC session layout for shuffle
    conductors/                # Default conductor instruction files
  nix/
    codecorral-hm-module.nix   # Unified HM module (schemas, projects, deck activation)
  flake.nix                    # Nix flake — builds, distributes schemas, decks & projects
```

## Development Guidelines
- Use OpenSpec for all design changes — proposals before implementation
- Design decisions are numbered (D1, D2, ...) for traceability
- Sessions are conductor children (`--parent conductor-{name}`)
- Board interaction is the conductor's domain, not the engine's
- `codecorral pull` delegates to the conductor as single entry point
- Schemas are distributed as a Nix package via `flake.nix` + Home Manager module
