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
- **Project = workflow instance** — One cmux workspace per workflow for its entire lifetime; phase transitions reconcile, never recreate

## Tech Stack

- **Runtime:** Bun
- **State machines:** XState v5
- **CLI:** Commander
- **MCP:** Model Context Protocol SDK for tool integration
- **Distribution:** Nix flake + Home Manager modules for schema distribution and project configuration

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

Schema distribution is now part of the unified `programs.codecorral` module. The legacy `programs.openspec` namespace still works but emits deprecation warnings — migrate to `programs.codecorral.schemas`.

```nix
# Old (deprecated, still works):
programs.openspec.enable = true;
programs.openspec.schemas = [ "dev.codecorral.intent@2026-03-11.0" ];

# New (recommended):
programs.codecorral.enable = true;
programs.codecorral.schemas = [ "dev.codecorral.intent@2026-03-11.0" ];
```

Schemas are installed globally to `~/.local/share/openspec/schemas/` via `xdg.dataFile`. Empty list means all available schemas are installed.

#### Setup

In your `flake.nix`:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    home-manager.url = "github:nix-community/home-manager";
    codecorral.url = "github:codecorral/codecorral";
  };
}
```

Import the module:

```nix
home-manager.users.yourname = {
  imports = [ codecorral.homeManagerModules.codecorral ];
};
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

### Project Configuration via Home Manager (Nix)

The `homeManagerModules.codecorral` module lets you declaratively define CodeCorral projects with per-project Claude Code configuration. It requires [agentplot-kit](https://github.com/agentplot/agentplot-kit)'s claude-code module for profile support (not the upstream nix-community one).

#### 1. Add flake inputs

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    home-manager.url = "github:nix-community/home-manager";
    codecorral.url = "github:codecorral/codecorral";
    agentplot-kit.url = "github:agentplot/agentplot-kit";
    nix-agent-deck.url = "github:agentplot/nix-agent-deck";
  };
}
```

#### 2. Import modules

```nix
home-manager.users.yourname = {
  # Disable upstream claude-code module, use agentplot-kit's instead
  disabledModules = [ "programs/claude-code.nix" ];
  imports = [
    codecorral.homeManagerModules.codecorral
    agentplot-kit.homeManagerModules.claude-code
    nix-agent-deck.homeManagerModules.default
  ];
};
```

#### 3. Declare projects

```nix
{
  programs.codecorral = {
    enable = true;

    projects.my-project = {
      path = "/Users/you/Code/my-project";
      workflows = [ "intent" "unit" ];

      # Full pass-through to programs.claude-code.profiles.my-project
      claude_code = {
        settings.model = "claude-sonnet-4-6";
        agents.code-reviewer = {
          description = "Expert code review specialist";
          tools = [ "Read" "Grep" ];
          prompt = "You are an expert code reviewer.";
        };
        rules = [ "Always use conventional commits" ];
      };

      # Override conductor instructions per project (optional)
      conductors.foreman = {
        claude_md = ./my-foreman.md;   # null = use bundled default
        # policy_md = ./my-policy.md;  # null = use bundled default
      };
    };
  };

  # Global agent-deck settings are configured directly — not via CodeCorral
  programs.agent-deck = {
    enable = true;
    defaultTool = "claude";
    conductor.enable = true;
  };
}
```

#### Conventions

The module auto-sets two defaults per project (overridable):

- **Profile name = project name.** `projects.foo` creates `programs.agent-deck.profiles.foo` and `programs.claude-code.profiles.foo`.
- **Shared `configDir`.** Both agent-deck and claude-code profiles get `configDir = ".claude-<project_name>"` so they share the same Claude identity.

To override:
```nix
programs.codecorral.projects.my-project.claude_code.configDir = ".claude-custom";
```

#### Automatic session layout

On `home-manager switch`, the module automatically runs `shuffle deal` for each project, provisioning the 6-group AI-DLC session layout (clint, exploration, backlogs, elaboration, construction, operations) in agent-deck. This is idempotent and additive — existing sessions are never deleted. If shuffle or agent-deck is unavailable, the activation logs a warning and continues.

#### What goes in `config.yaml`

The module generates `~/.codecorral/config.yaml` with engine-own state only:

```yaml
projects:
  my-project:
    path: /Users/you/Code/my-project
    workflows:
      - intent
      - unit
    agent_deck_profile: my-project
```

Tool-specific configuration (Claude model, agents, rules, skills) is delegated to the upstream modules — it does NOT appear in `config.yaml`.

## License

TBD
