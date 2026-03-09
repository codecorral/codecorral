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

TBD

## License

TBD
