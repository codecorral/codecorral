## Unit: engine-core

**Description:** The foundational workflow engine — XState actor management, event queue with sequential-per-instance processing, snapshot persistence, MCP server, and CLI. The engine runs as a long-lived process managed implicitly (auto-started when needed by CLI or MCP connection, no user-facing daemon commands). Ships with a hardcoded `test-v0.1` workflow definition for validation.

**Deliverable:** A long-lived engine process that hosts XState actors, persists state to `~/.codecorral/instances/`, exposes MCP tools (`workflow.transition`, `workflow.status`, `workflow.context`), accepts CLI commands (`codecorral status`, `codecorral history`), and recovers from restart by rehydrating actors from persisted snapshots. Installable via npm (`npx codecorral`) and Nix (`nix profile install`).

**Dependencies:** None

## Relevant Requirements

- Workflow engine daemon with XState-based state machines, event queue, guard evaluation, action dispatch, and state persistence
- CLI (`codecorral`) for workflow inspection, control, and configuration — independently installable
- Event sourcing from three origins: agent (MCP), human (CLI), deterministic (hooks) — all processed identically through the same event queue
- CLI must be independently installable via npm (`npx codecorral`), Nix (`nix profile install`), or Homebrew

## System Context

**Contracts exercised:** C6 (MCP tools — `workflow.transition`, `workflow.status`, `workflow.context`), C8 (process lifecycle — implicit start, state persistence and recovery).

**Key architectural decisions:**
- Single-threaded event loop with queue per workflow instance (XState actor mailbox)
- Full XState snapshot persistence via `actor.getPersistedSnapshot()` — opaque snapshots, not hand-rolled fields
- Event translation layer: external `{ event, payload }` → internal `{ type, ...flatPayload }`
- **Implicit process management:** The engine process starts automatically when needed (first CLI command or MCP connection) and runs in the background. No explicit `daemon start/stop` commands — follows the pattern of modern MCP-based CLIs where the server lifecycle is transparent to the user. Process discovery via socket file (`~/.codecorral/daemon.sock`).
- Events fired during process downtime are lost (no write-ahead log in v1)
- Installable via both npm and Nix. The Nix package provides the CLI binary; the Home Manager module for declarative workspace configuration ships in Unit 8.

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
- Nix package derivation (CLI binary via `nix profile install` or flake reference)

**Out of scope:**
- Agent-deck session integration (Unit 2)
- Conductor lifecycle (Unit 3)
- OpenSpec conformist integration (Unit 4)
- cmux/developer surface (Unit 5)
- Real workflow definitions — `test-v0.1` is a validation harness, not a production workflow
- Home Manager module for declarative workspace configuration (Unit 8)
- Async precondition services — `test-v0.1` uses only sync guards to validate the basic model
