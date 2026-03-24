# CodeCorral

Workflow engine for AI-DLC (AI-Driven Development Lifecycle) — orchestrating agent teams through structured development phases with human review gates.

## Overview

CodeCorral explores how to turn the AI-DLC methodology into a running system. At its core is an XState-based workflow engine that drives two composable workflow definitions through a shared task board:

- **Intent workflow** — Takes a raw idea through elaboration (requirements, system context, unit decomposition) and publishes unit briefs to the task board
- **Unit workflow** — Picks up unit briefs and drives them through elaboration, implementation, code review, and verification

The two workflows are loosely coupled through the task board — no runtime coupling, different machines, different schemas, different schedules.

## Architecture

The engine sits at the center of four bounded contexts:

| Context | Tool | Role |
|---------|------|------|
| **Workflow Engine** | XState daemon | Owns workflow definitions, state machines, transitions, guards, actions |
| **Session Management** | [agent-deck](https://github.com/asheshgoplani/agent-deck) | Engine creates and manages agent sessions via CLI |
| **Change Management** | [OpenSpec](https://github.com/madswan-dev/openspec) | Engine conforms to OpenSpec's artifact-driven change workflow |
| **Mob Ceremonies** | [OpenMob](https://github.com/codecorral/openmob) | Structured agent elaboration ceremonies during inception |

A **conductor** (one per profile) bridges the engine and the outside world — it polls the task board, delegates work to agent-deck sessions, and routes human approvals back into the engine. The engine is deterministic; the conductor provides LLM judgment.

## Key Concepts

- **Human review gates** — Explicit states in XState machines where the workflow pauses for human approval
- **Conductor ownership** — All sessions are conductor children (`--parent conductor-{name}`), giving automatic transition notifications
- **Task board as anti-corruption layer** — Intent and unit workflows communicate only through the board, keeping them independently evolvable
- **Workspace = workflow instance** — One cmux workspace per workflow for its entire lifetime; phase transitions reconcile, never recreate

## Tech Stack

- **Runtime:** Bun
- **State machines:** XState v5
- **CLI:** Commander
- **MCP:** Model Context Protocol SDK for tool integration
- **Distribution:** Nix flake + Home Manager module for schema distribution

## Project Structure

```
codecorral/
  src/
    actors/          # XState actor definitions
    cli/             # CLI entry point (commander)
    config/          # Workspace and workflow configuration
    daemon/          # Engine daemon lifecycle
    mcp/             # MCP server for tool integration
    persistence/     # XState snapshot persistence
  openspec/
    changes/         # Active and archived change proposals
    schemas/         # JSON schemas (e.g. dev.codecorral.intent)
    specs/           # Main specifications
    config.yaml      # OpenSpec configuration
  nix/
    hm-module.nix    # Home Manager module for schema distribution
  flake.nix          # Nix flake — builds & distributes schemas
```

## Commands

```bash
bun test                       # Run tests
bun run typecheck              # Type check
nix build .#openspec-schemas   # Build schema package
nix flake check                # Validate flake
```

## Related Repositories

- [openspec](https://github.com/madswan-dev/openspec) — Artifact-driven change management
- [openmob](https://github.com/codecorral/openmob) — Mob elaboration ceremony framework
- [agent-deck](https://github.com/asheshgoplani/agent-deck) — Session management for agent teams
- [shuffle](https://github.com/codecorral/shuffle) — Declarative agent-deck profile configuration

## Installation

### OpenSpec Schemas via Home Manager (Nix)

This flake distributes custom OpenSpec schemas (e.g., `intent`) to your system using Home Manager's `xdg.dataFile`. Once installed, schemas are available globally at `~/.local/share/openspec/schemas/` without needing to copy them into each project.

#### 1. Add the flake input

In your `flake.nix` (the one that drives your Home Manager config), add `codecorral` as an input:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    home-manager.url = "github:nix-community/home-manager";
    codecorral.url = "github:codecorral/codecorral";
  };

  # ... rest of your flake
}
```

#### 2. Import the Home Manager module

Pass the module to your Home Manager configuration. How you do this depends on your setup, but typically:

```nix
# In your home-manager config (e.g., home.nix or flake.nix outputs)
home-manager.users.yourname = {
  imports = [
    codecorral.homeManagerModules.openspec
  ];
};
```

#### 3. Enable the module

In your Home Manager config:

```nix
{
  programs.openspec = {
    enable = true;

    # Optional: install only specific schemas (default: all)
    # schemas = [ "dev.codecorral.intent@2026-03-11.0" ];
  };
}
```

#### 4. Apply

```bash
home-manager switch --flake .
```

#### 5. Verify

```bash
# Check the symlink exists
ls -la ~/.local/share/openspec/schemas/

# From any project without a local intent schema:
openspec schema which intent
# Should resolve from the "user" tier
```

Project-local schemas always take precedence over user-level schemas installed this way.

## License

TBD
