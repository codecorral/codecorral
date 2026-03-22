## Unit: engine-core

**Description:** The foundational workflow engine — XState actor management, event queue with sequential-per-instance processing, snapshot persistence, MCP server, CLI, and declarative workspace configuration via Nix flake + Home Manager module. The engine runs as a long-lived process managed implicitly (auto-started when needed by CLI or MCP connection, no user-facing daemon commands). Ships with a hardcoded `test-v0.1` workflow definition for validation.

**Deliverable:** A long-lived engine process that hosts XState actors, persists state to `~/.codecorral/instances/`, exposes MCP tools (`workflow.transition`, `workflow.status`, `workflow.context`), accepts CLI commands (`codecorral status`, `codecorral history`, `codecorral workspaces`), and recovers from restart by rehydrating actors from persisted snapshots. Installable via npm (`npx codecorral`) and Nix (`nix profile install`). Nix flake with Home Manager module for declaratively defining workspaces — this is the primary testing loop for validating the engine against real workspace configurations from day one.

**Dependencies:** None

## Relevant Requirements

- Workflow engine daemon with XState-based state machines, event queue, guard evaluation, action dispatch, and state persistence
- CLI (`codecorral`) for workflow inspection, control, and configuration — independently installable
- Event sourcing from three origins: agent (MCP), human (CLI), deterministic (hooks) — all processed identically through the same event queue
- CLI must be independently installable via npm (`npx codecorral`), Nix (`nix profile install`), or Homebrew
- Nix flake for declarative workspace and workflow configuration
- CLI can enumerate configured workspaces

## System Context

**Contracts exercised:** C6 (MCP tools — `workflow.transition`, `workflow.status`, `workflow.context`), C8 (process lifecycle — implicit start, state persistence and recovery).

**Key architectural decisions:**
- Single-threaded event loop with queue per workflow instance (XState actor mailbox)
- Full XState snapshot persistence via `actor.getPersistedSnapshot()` — opaque snapshots, not hand-rolled fields
- Event translation layer: external `{ event, payload }` → internal `{ type, ...flatPayload }`
- **Implicit process management:** The engine process starts automatically when needed (first CLI command or MCP connection) and runs in the background. No explicit `daemon start/stop` commands — follows the pattern of modern MCP-based CLIs where the server lifecycle is transparent to the user. Process discovery via socket file (`~/.codecorral/daemon.sock`).
- Events fired during process downtime are lost (no write-ahead log in v1)
- Installable via both npm and Nix. The Nix flake provides both the CLI binary and a Home Manager module for declarative workspace configuration.

**Nix flake + Home Manager module:** Declarative workspace configuration is in this unit because it's the primary testing loop — you define workspaces in Nix, the HM module generates `~/.codecorral/config.yaml`, and the engine reads it. Without this, every test requires manual config file editing.

```nix
codecorral.workspaces.my-project = {
  path = "/path/to/project";                 # project directory
  workflows = [ "intent" "unit" ];           # which workflow definitions to enable
  agentDeck.profile = "my-project";          # agent-deck profile name for this workspace
  claudeCode.profile = {                     # Claude Code profile for agent sessions
    model = "claude-sonnet-4-6";             # default model for agents in this workspace
    apiKey = "sk-ant-...";                   # or reference to secret manager
  };
  openspec.schemas = [                       # OpenSpec schemas available in this workspace
    "dev.codecorral.intent@2026-03-11.0"     # built-in schemas referenced by name@version
    "dev.codecorral.unit@1.0"
  ];
  openspec.schemasPath = "./openspec/schemas"; # project-local schemas (resolved relative to path)
  openspec.config = {                        # openspec config.yaml overrides
    defaultSchema = "dev.codecorral.unit@1.0";
  };
};
```

The workspace config declaratively sets:
- **agent-deck profile** — session management identity, worktree conventions, conductor identity
- **Claude Code profile** — model selection, API keys for all agent sessions
- **OpenSpec schemas** — which schemas are available, where project-local schemas live, and default schema selection. The HM module ensures the declared schemas are installed (via the Nix package) and that `openspec/config.yaml` in the project references them correctly.

This means switching between projects with different credentials, model preferences, or schema configurations is a workspace-level concern, not per-session or per-command.

`codecorral workspaces` enumerates configured workspaces and their status. The HM module generates config; the engine reads config. Later units (conductor-and-board, plugin-distribution) extend the workspace config with additional fields (conductor policy, `.provide()` overrides, view config overrides) as those capabilities ship.

**`test-v0.1` definition:** 4 states (`IDLE → WORKING → REVIEWING → DONE`) with manual transitions only. No sessions, no views, no conductor. Validates the actor lifecycle, persistence, recovery, and event processing before anything depends on them.

## Scope Boundaries

**In scope:**
- XState v5 actor creation via `setup().createMachine()`, actor hosting, mailbox-based event processing
- Snapshot persistence (subscribe to actor, write atomically on every state change)
- Implicit process lifecycle: auto-start on first use, socket-based discovery, graceful shutdown, state recovery
- MCP server exposing `workflow.transition`, `workflow.status`, `workflow.context`, `workflow.setBrowserUrl`
- CLI commands: `codecorral status [id]`, `codecorral history <id>`, `codecorral transition <event> --instance <id> [--payload '{}']`
- Event translation layer (C6)
- `test-v0.1` workflow definition
- npm package structure (independently installable CLI)
- Nix flake with Home Manager module for declarative workspace configuration
- `codecorral workspaces` CLI command (enumerate configured workspaces with status)
- Config file format (`~/.codecorral/config.yaml`) generated by HM module or written manually by non-Nix users
- Declarative agent-deck profile configuration per workspace (profile name, worktree conventions)
- Declarative Claude Code profile configuration per workspace (model, API key reference)
- Declarative OpenSpec schema configuration per workspace (available schemas, project-local schema path, default schema)

**Out of scope:**
- Agent-deck session integration (Unit 2)
- Conductor lifecycle (Unit 3)
- OpenSpec conformist integration (Unit 4)
- cmux/developer surface (Unit 5)
- Real workflow definitions — `test-v0.1` is a validation harness, not a production workflow
- Conductor policy generation from Nix flake (Unit 3 extends workspace config)
- `.provide()` override generation from Nix flake (Unit 4 extends workspace config)
- View config overrides from Nix flake (Unit 5 extends workspace config)
- Async precondition services — `test-v0.1` uses only sync guards to validate the basic model
