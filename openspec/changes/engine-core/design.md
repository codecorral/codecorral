## Context

CodeCorral needs a workflow engine to serve as the single source of truth for where every unit of work stands. Today there is no runtime engine — state is inferred. This design covers the foundational engine-core unit: the XState actor runtime, persistence, MCP server, CLI, daemon lifecycle, workspace configuration, and a `test-v0.1` validation workflow.

The engine-core has no dependencies on other units. It ships a hardcoded test workflow that exercises the full actor lifecycle without requiring sessions, views, conductors, or real OpenSpec integration. Later units (session-integration, conductor-and-board, unit-workflow, view-engine) build on this foundation.

Key reference documents informing this design:
- Contract C6 (MCP tools) and C8 (daemon lifecycle) from `contracts.md`
- Review decisions D1, D5, D19, D20, D21, D25 from `review-decisions.md`
- Domain model ubiquitous language (workflow instance, workflow definition, event, guard, action, invoked service)

## Goals / Non-Goals

**Goals:**
- Deliver a working engine daemon that can host XState v5 actors, process events sequentially per instance, and persist snapshots atomically
- Expose MCP tools (C6) and CLI commands for agents and humans to interact with workflow instances
- Implement implicit daemon lifecycle (C8): auto-start, socket discovery, graceful shutdown, state recovery
- Provide declarative workspace configuration via Nix Home Manager module generating `~/.codecorral/config.yaml`
- Ship `test-v0.1` workflow definition that validates the engine independently of all other units
- Make the CLI independently installable via npm (`npx codecorral`) and Nix (`nix profile install`)

**Non-Goals:**
- Agent-deck session integration (Unit 2: session-integration)
- Conductor lifecycle or board interaction (Unit 3: conductor-and-board)
- OpenSpec conformist runtime integration like `checkArtifactExists` (Unit 4: unit-workflow)
- cmux/developer surface integration (Unit 5: view-engine)
- Production workflow definitions for intent, unit, or t2d (Units 4, 6, 7)
- Claude Code plugin packaging (Unit 8: plugin-distribution)
- Async precondition services — `test-v0.1` uses only sync guards
- Write-ahead log for events during downtime (deferred; events during downtime are lost in v1)

## Decisions

### ED1: TypeScript monorepo with single entry point

The engine is a single TypeScript package producing one binary: `codecorral`. The binary serves as both CLI client and daemon process. When invoked as a CLI command (e.g., `codecorral status`), it connects to the daemon via Unix socket. When no daemon is running, the CLI auto-starts one in the background.

**Why not separate packages?** One binary simplifies installation (npm, Nix) and version alignment. The client/daemon split is internal — both share type definitions and the JSON-RPC protocol.

### ED2: JSON-RPC over Unix domain socket

CLI-to-daemon communication uses JSON-RPC 2.0 over `~/.codecorral/daemon.sock`. The MCP server runs as a separate transport (stdio-based, per MCP SDK conventions) that calls into the same actor registry.

**Why JSON-RPC?** It's the protocol MCP itself uses, keeps the internal protocol consistent, and is well-supported in Node.js. Unix socket (not TCP) because the daemon is single-machine, and socket file presence doubles as daemon discovery.

### ED3: Actor registry pattern

The daemon maintains an in-memory `Map<string, ActorRef>` keyed by instance ID. All operations (transition, status, context) look up the actor by ID. New instances are created by instantiating a machine from the definition registry, subscribing to state changes for persistence, and starting the actor.

On startup, the registry rehydrates from `~/.codecorral/instances/*.json` — each file contains the definition ID and the opaque XState persisted snapshot.

### ED4: Atomic snapshot persistence via tmp+rename

On every actor state change (via `actor.subscribe`), the engine:
1. Serializes the instance envelope (id, definitionId, unitBriefRef, xstateSnapshot, history, timestamps)
2. Writes to a temp file in the same directory (`<id>.json.tmp`)
3. Renames atomically to `<id>.json`

This prevents partial writes from corrupting instance state. The subscribe callback is synchronous from XState's perspective — the write is fire-and-forget with error logging.

### ED5: Event translation at the boundary

External callers (MCP, CLI) send `{ event: string, payload?: Record<string, unknown> }`. The engine translates to XState's internal format `{ type: string, ...flatPayload }` at the boundary. This keeps the external API simple while using XState's native event discriminant.

### ED6: Definition registry with version selection

Workflow definitions are registered by ID (e.g., `test-v0.1`). The registry is a `Map<string, MachineConfig>` populated at startup. In engine-core, only `test-v0.1` is hardcoded. Later units register production definitions.

Definition precedence (D19): CLI-embedded defaults → project-level (`.codecorral/definitions/`) → user-level (`~/.codecorral/definitions/`). Engine-core implements the registry and the CLI-embedded tier only. File-based overrides are loaded if present but not required.

### ED7: Config file format and loading

`~/.codecorral/config.yaml` is the primary configuration file. Structure:

```yaml
workspaces:
  my-project:
    path: /path/to/project
    workflows:
      - intent
      - unit
    agentDeck:
      profile: my-project
    claudeCode:
      model: claude-sonnet-4-6
    openspec:
      schemas:
        - dev.codecorral.intent@2026-03-11.0
      schemasPath: ./openspec/schemas
      config:
        defaultSchema: dev.codecorral.unit@1.0
```

The HM module generates this file. Non-Nix users write it manually. The engine reads it at startup and exposes it via `codecorral workspaces`.

Config merging (D20): `~/.codecorral/config.yaml` (user defaults) merges with `.codecorral/config.yaml` (project overrides, if present). Project settings take precedence for project-specific fields.

### ED8: `test-v0.1` workflow definition

A minimal 4-state machine for validation:

```
IDLE → (start) → WORKING → (submit) → REVIEWING → (approve) → DONE
                                        ↓ (revise)
                                      WORKING
```

States: `idle`, `working`, `reviewing`, `done` (final).
Events: `start`, `submit`, `review.approved`, `review.revised`.
Guards: `review.approved` requires `context.hasWork === true` (sync guard only).
Actions: `assign` context fields on transitions (workStartedAt, submitCount, etc.).
No invoked services, no sessions, no views, no conductor.

### ED9: Instance ID generation

Instance IDs use the format `{definitionId}-{shortId}` where `shortId` is a random 8-character alphanumeric string. Example: `test-v0.1-a1b2c3d4`. This keeps IDs human-readable and greppable while avoiding collisions.

### ED10: Event history in instance file

Each instance file includes a `history` array of processed events with timestamps. This is the source for `codecorral history <id>`. History is append-only within the instance file — written alongside each snapshot update. The history array is bounded (configurable, default 1000 entries) with oldest entries dropped.

## Risks / Trade-offs

**[Synchronous persistence on every state change]** → Could bottleneck if actors transition rapidly. Mitigation: `test-v0.1` transitions are human-paced. If production workflows need higher throughput, introduce write coalescing (debounce writes, persist latest snapshot).

**[No WAL — events lost during downtime]** → Accepted for v1. Agents running in tmux sessions will get `connection refused` on MCP calls and should retry. The engine recovers to the last persisted state, which is at most one transition behind.

**[Single-process daemon]** → No horizontal scaling. Mitigation: CodeCorral targets solo developers — one machine, one daemon. Conductor pools (D2) are future work.

**[Unix socket limits discoverability]** → Clients must check `~/.codecorral/daemon.sock`. Mitigation: All access goes through the `codecorral` CLI binary, which handles discovery internally. MCP clients connect via stdio transport, not the socket directly.

**[Config file conflicts between HM-generated and manual edits]** → If a user has HM generating config but also manually edits, HM will overwrite on next activation. Mitigation: document that HM-managed config is declarative — manual edits should go in project-level `.codecorral/config.yaml` overrides instead.
