## Why

CodeCorral has no runtime engine. Workflow state is inferred from scattered artifacts, git history, and bead queries rather than tracked explicitly. Before any production workflow (intent, unit, t2d) can run, the foundational infrastructure must exist: XState actor hosting, event processing, snapshot persistence, MCP tools for agents, CLI for humans, and declarative workspace configuration. This unit delivers that foundation with a minimal `test-v0.1` workflow for validation — proving the actor lifecycle, persistence, recovery, and event processing work before anything depends on them.

## What Changes

- Create a long-lived engine daemon process hosting XState v5 actors with mailbox-based sequential event processing per instance
- Implement snapshot persistence: subscribe to each actor, atomically write `~/.codecorral/instances/<id>.json` on every state change, rehydrate on restart
- Expose MCP server with `workflow.transition`, `workflow.status`, `workflow.context`, and `workflow.setBrowserUrl` tools (contract C6)
- Implement CLI commands: `codecorral status [id]`, `codecorral history <id>`, `codecorral transition <event> --instance <id> [--payload '{}']`, `codecorral workspaces`
- Implement implicit daemon lifecycle: auto-start on first CLI/MCP use, socket-based discovery (`~/.codecorral/daemon.sock`), graceful shutdown with state persistence (contract C8)
- Implement event translation layer: external `{ event, payload }` → internal `{ type, ...flatPayload }`
- Ship `test-v0.1` workflow definition: 4 states (`IDLE → WORKING → REVIEWING → DONE`) with manual transitions only — no sessions, views, or conductor
- Create npm package structure (`npx codecorral`) for independent CLI installation
- Create Nix flake with Home Manager module for declarative workspace configuration generating `~/.codecorral/config.yaml`
- Define config file format (`~/.codecorral/config.yaml`) for workspaces, agent-deck profiles, Claude Code profiles, and OpenSpec schema declarations

## Capabilities

### New Capabilities
- `xstate-actor-runtime`: XState v5 actor creation, hosting, mailbox event processing, and snapshot persistence with atomic writes
- `mcp-server`: MCP server exposing workflow tools (transition, status, context, setBrowserUrl) with event translation layer
- `cli`: `codecorral` CLI for workflow inspection, control, and workspace enumeration — independently installable via npm and Nix
- `daemon-lifecycle`: Implicit process management — auto-start, socket discovery, PID file, graceful shutdown, state recovery from persisted snapshots
- `workspace-config`: Declarative workspace configuration via `~/.codecorral/config.yaml` — agent-deck profiles, Claude Code profiles, OpenSpec schemas per workspace
- `nix-distribution`: Nix flake + Home Manager module generating config from declarative workspace definitions; npm package for non-Nix users
- `test-workflow`: `test-v0.1` hardcoded workflow definition (IDLE → WORKING → REVIEWING → DONE) for validating the engine before production workflows exist

### Modified Capabilities

## Impact

**New code:**
- TypeScript package: engine daemon, MCP server, CLI, XState actor management, persistence layer, config loader
- Nix flake: `flake.nix` updated with engine binary, Home Manager module for workspace config generation
- npm package: `codecorral` CLI independently installable

**Runtime artifacts:**
- `~/.codecorral/daemon.sock` — Unix domain socket
- `~/.codecorral/daemon.pid` — PID file
- `~/.codecorral/daemon.log` — stderr log
- `~/.codecorral/instances/*.json` — persisted workflow instance snapshots
- `~/.codecorral/config.yaml` — workspace configuration (HM-generated or manual)

**Dependencies:**
- XState v5 (state machine runtime)
- Node.js (engine runtime)
- MCP SDK (tool server)
- Nix + Home Manager (declarative config path, optional)
