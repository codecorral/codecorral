# CodeCorral

Opinionated agent orchestration framework and methodology based on the AI-DLC (AI-Driven Development Lifecycle) whitepaper, supporting model elaboration with asynchronous human-in-the-loop reviews.

## Overview

CodeCorral provides the orchestration layer for AI-DLC's three-loop architecture:

- **Loop 1 (Inception):** Intent elaboration via agent mob teams
- **Loop 2 (Bolt Elaboration):** Per-unit detailed specification via agent teams
- **Loop 3 (Construction):** Parallel code implementation via bead-driven agents

## Architecture

CodeCorral integrates several tools into a cohesive workflow:

- **OpenSpec** — Change management and artifact workflow
- **Ralph-TUI** — Autonomous loop execution and bead processing
- **AgentDeck** — Session management for agent teams
- **beads-rust** — Task tracking and dependency management
- **OpenMob** — Mob elaboration ceremony configuration
- **Shuffle** — Declarative agent-deck profile configuration

## Key Components

- **Conductor** — Orchestration script handling signal routing, bead creation, and loop transitions
- **Intent Routing** — Maps intent complexity signals to team sizing and execution strategy
- **Loop Orchestration** — Manages the three-loop lifecycle and transitions between phases
- **TuiCR Integration** — Human review gates between automated elaboration phases

## Related Repositories

- [openmob](https://github.com/codecorral/openmob) — Mob elaboration ceremony framework
- [shuffle](https://github.com/codecorral/shuffle) — Declarative agent-deck configuration

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
