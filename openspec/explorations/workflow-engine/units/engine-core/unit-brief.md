## Unit: engine-core

**Description:** The foundational workflow engine — XState actor management, event queue with sequential-per-instance processing, snapshot persistence, daemon lifecycle, CLI skeleton, and MCP server. Ships with a hardcoded `test-v0.1` workflow definition for validation.

**Deliverable:** A running daemon that hosts XState actors, persists state to `~/.codecorral/instances/`, exposes MCP tools (`workflow.transition`, `workflow.status`, `workflow.context`), accepts CLI commands (`codecorral status`, `codecorral history`, `codecorral daemon start/stop/status`), and recovers from restart by rehydrating actors from persisted snapshots.

**Dependencies:** None

## Relevant Requirements

- Workflow engine daemon with XState-based state machines, event queue, guard evaluation, action dispatch, and state persistence
- CLI (`codecorral`) for workflow inspection, control, and configuration — independently installable
- Event sourcing from three origins: agent (MCP), human (CLI), deterministic (hooks) — all processed identically through the same event queue
- CLI must be independently installable via npm (`npx codecorral`) or Homebrew

## System Context

**Contracts exercised:** C6 (MCP tools — `workflow.transition`, `workflow.status`, `workflow.context`), C8 (daemon lifecycle — socket at `~/.codecorral/daemon.sock`, PID file, auto-start on first CLI command, state recovery on restart).

**Key architectural decisions:**
- Single-threaded event loop with queue per workflow instance (XState actor mailbox)
- Full XState snapshot persistence via `actor.getPersistedSnapshot()` — opaque snapshots, not hand-rolled fields
- Event translation layer: external `{ event, payload }` → internal `{ type, ...flatPayload }`
- Daemon auto-starts on first `codecorral` command if not running (C8 socket detection)
- Events fired during daemon downtime are lost (no write-ahead log in v1)

**`test-v0.1` definition:** 4 states (`IDLE → WORKING → REVIEWING → DONE`) with manual transitions only. No sessions, no views, no conductor. Validates the actor lifecycle, persistence, recovery, and event processing before anything depends on them.

## Scope Boundaries

**In scope:**
- XState v5 actor creation via `setup().createMachine()`, actor hosting, mailbox-based event processing
- Snapshot persistence (subscribe to actor, write atomically on every state change)
- Daemon lifecycle: socket, PID file, auto-start, graceful shutdown, state recovery
- MCP server exposing `workflow.transition`, `workflow.status`, `workflow.context`, `workflow.setBrowserUrl`
- CLI commands: `codecorral status [id]`, `codecorral history <id>`, `codecorral daemon start/stop/status`, `codecorral transition <event> --instance <id> [--payload '{}']`
- Event translation layer (C6)
- `test-v0.1` workflow definition
- npm package structure (independently installable CLI)

**Out of scope:**
- Agent-deck session integration (Unit 2)
- Conductor lifecycle (Unit 3)
- OpenSpec conformist integration (Unit 4)
- cmux/developer surface (Unit 5)
- Real workflow definitions — `test-v0.1` is a validation harness, not a production workflow
- Nix flake packaging (Unit 8)
- Async precondition services — `test-v0.1` uses only sync guards to validate the basic model
