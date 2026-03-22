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

### ED1: TypeScript monorepo with single entry point and client-only commands

The engine is a single TypeScript package producing one binary: `codecorral`. The binary serves as both CLI client and daemon process.

**Client-only commands:** Commands that only read persisted state (`codecorral status`, `codecorral history`, `codecorral workspaces`) work **without the daemon running**. They read directly from `~/.codecorral/instances/*.json` and `~/.codecorral/config.yaml`. This follows the pattern of tools like `git status` and `docker ps` — basic inspection commands should never fail because a server isn't running.

**Daemon-required commands:** Commands that modify state (`codecorral transition`, MCP tool calls) require the daemon. If the daemon isn't running, these commands auto-start it transparently. The user never sees "starting daemon..." messages — the command just works, slightly slower the first time.

**Why not separate packages?** One binary simplifies installation (npm, Nix) and version alignment. The client/daemon split is internal — both share type definitions and the JSON-RPC protocol.

### ED2: JSON-RPC over Unix domain socket with Content-Length framing

CLI-to-daemon communication uses JSON-RPC 2.0 over `~/.codecorral/daemon.sock`. Messages use **Content-Length header framing** (per the Language Server Protocol wire format) to ensure correct message boundary detection over the byte-stream socket. This is the same framing used by `vscode-jsonrpc`, which is the recommended library.

**MCP server architecture:** Each agent session gets its own MCP server process spawned via stdio. The MCP process is a thin adapter that connects to the daemon via the Unix socket:

```
Agent ↔ stdio ↔ MCP process ↔ Unix socket ↔ Daemon
```

Stdio is inherently single-client — one agent per MCP process. The daemon is the multiplexer, handling connections from multiple MCP processes and CLI clients concurrently. Each MCP process is stateless and short-lived (tied to the agent session lifecycle).

**Why JSON-RPC?** It's the protocol MCP itself uses, keeps the internal protocol consistent, and is well-supported in Node.js (`vscode-jsonrpc`, 4M+ weekly downloads). Unix socket (not TCP) because the daemon is single-machine, and socket file presence doubles as daemon discovery. Socket path must be under 104 bytes (macOS limit) — `~/.codecorral/daemon.sock` is well within this for typical usernames.

### ED3: Actor registry pattern

The daemon maintains an in-memory `Map<string, ActorRef>` keyed by instance ID. All operations (transition, status, context) look up the actor by ID. New instances are created by instantiating a machine from the definition registry, subscribing to state changes for persistence, and starting the actor.

On startup, the registry rehydrates from `~/.codecorral/instances/*.json` — each file contains the definition ID, a `schemaVersion` field, and the XState persisted snapshot. Orphaned `*.json.tmp` files (from crashes during writes) are deleted during startup before rehydration begins.

### ED4: Atomic snapshot persistence via tmp+rename

On every actor state change (via `actor.subscribe`), the engine:
1. Serializes the instance envelope (id, definitionId, unitBriefRef, xstateSnapshot, history, timestamps)
2. Writes to a temp file in the same directory (`<id>.json.tmp`)
3. Renames atomically to `<id>.json`

This prevents partial writes from corrupting instance state.

**Subscribe deduplication:** XState v5's `actor.subscribe()` fires on every `actor.send()`, not just on state changes — including when events are rejected by guards. The persistence callback checks referential equality of the snapshot (`if (snapshot !== prevSnapshot)`) before writing, avoiding unnecessary I/O on rejected events.

**Client-only read safety:** CLI commands that read instance files directly (without the daemon) may encounter ENOENT if the daemon archives/deletes an instance between `readdir()` and `readFile()`. The CLI silently skips ENOENT errors during reads, treating them as archived instances.

### ED5: Event translation at the boundary

External callers (MCP, CLI) send `{ event: string, payload?: Record<string, unknown> }`. The engine translates to XState's internal format `{ type: string, ...flatPayload }` at the boundary. This keeps the external API simple while using XState's native event discriminant.

### ED6: Definition registry with version selection

Workflow definitions are registered by ID (e.g., `test-v0.1`). The registry is a `Map<string, MachineConfig>` populated at startup. In engine-core, only `test-v0.1` is hardcoded. Later units register production definitions.

Definition precedence (D19): CLI-embedded defaults → project-level (`.codecorral/definitions/`) → user-level (`~/.codecorral/definitions/`). Engine-core implements the registry and the CLI-embedded tier only. File-based overrides are loaded if present but not required.

### ED7: Config file format, Nix module delegation, and loading

`~/.codecorral/config.yaml` is the primary configuration file for CodeCorral-specific settings (workspaces, workflow assignments). However, the CodeCorral HM module does **not** reimplement configuration for agent-deck, Claude Code, or OpenSpec. It **delegates** to their upstream Nix modules:

| Concern | Upstream Module | What CodeCorral's module does |
|---|---|---|
| Agent-deck profiles, MCPs, conductor | `programs.agent-deck` ([nix-agent-deck](https://github.com/agentplot/nix-agent-deck)) | Sets `programs.agent-deck.profiles.<name>.claude.configDir` and conductor config per workspace |
| Claude Code settings, agents, hooks, skills, MCP servers | `programs.claude-code` ([agentplot-kit](https://github.com/agentplot/agentplot-kit)) | Sets `programs.claude-code.profiles.<name>` with workspace-specific settings, agents, hooks |
| OpenSpec schema installation | `programs.openspec` (this repo's `nix/hm-module.nix`) | Sets `programs.openspec.schemas` list for the workspace |

The CodeCorral workspace config translates declarative workspace definitions into options on these upstream modules. It does not generate `config.toml`, `settings.json`, or schema symlinks directly — that's the upstream modules' job.

**Module guard:** The module uses `programs.codecorral.enable` as its activation guard, consistent with the existing `programs.openspec` module. All config generation and upstream delegation is wrapped in `lib.mkIf cfg.enable`.

**Upstream module imports:** Delegation to upstream modules is guarded with `lib.mkIf` checks (e.g., `lib.mkIf config.programs.agent-deck.enable`) so that CodeCorral does not produce "undefined option" errors if an upstream module is not imported. If an upstream module is not available, the CodeCorral module skips that delegation and logs a warning at `home-manager switch` time via `lib.warn`.

**Schema installation is global (union of all workspaces):** `programs.openspec.schemas` receives the union of all workspace schema lists. Schema isolation between workspaces is not supported in v1 — all schemas from all workspaces are visible globally via `~/.local/share/openspec/schemas/`. Project-local `schemasPath` takes precedence when both global and local provide the same schema (resolved by OpenSpec's existing resolution order: project > user > package).

**No duplicate profile assertion:** The module asserts (`lib.assertMsg`) that no two workspaces map to the same agent-deck or Claude Code profile name, preventing silent config merging.

```nix
# What the user writes:
codecorral.workspaces.my-project = {
  path = "/path/to/project";
  workflows = [ "intent" "unit" ];
  agentDeck.profile = "my-project";
  claudeCode.profile = {
    model = "claude-sonnet-4-6";
  };
  openspec.schemas = [
    "dev.codecorral.intent@2026-03-11.0"
  ];
};

# What the CodeCorral module generates (delegating to upstream):
programs.agent-deck.profiles.my-project.claude.configDir = ".claude-my-project";
programs.claude-code.profiles.my-project = {
  configDir = ".claude-my-project";
  settings = { /* workspace-specific settings */ };
};
programs.openspec = {
  enable = true;
  schemas = [ "dev.codecorral.intent@2026-03-11.0" ];
};
```

CodeCorral's own `~/.codecorral/config.yaml` contains only CodeCorral-specific state: workspace definitions, workflow assignments, and engine settings. It does not duplicate agent-deck, Claude Code, or OpenSpec configuration.

```yaml
workspaces:
  my-project:
    path: /path/to/project
    workflows:
      - intent
      - unit
    agentDeckProfile: my-project
    claudeCodeProfile: my-project
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
Actions: `assign` context fields on transitions. Critically, `review.revised` resets `context.hasWork = false` so the guard actually blocks re-approval without new work. This exercises the "guard blocks transition" scenario meaningfully — not just on the first submit.
Context fields: `hasWork` (boolean), `submitCount` (number), `workStartedAt` (ISO timestamp).
No invoked services, no sessions, no views, no conductor.

### ED9: Instance ID generation

Instance IDs use the format `{definitionId}-{shortId}` where `shortId` is a random 8-character alphanumeric string. Example: `test-v0.1-a1b2c3d4`. This keeps IDs human-readable and greppable while avoiding collisions.

### ED10: Event history in instance file

Each instance file includes a `history` array of processed events with timestamps. This is the source for `codecorral history <id>`. History is append-only within the instance file — written alongside each snapshot update. The history array is bounded (configurable, default 1000 entries) with oldest entries dropped.

### ED11: Snapshot versioning for definition migration

XState persisted snapshots are **not portable across machine definition changes**. Renaming a state, restructuring context, or changing invocations breaks rehydration. The instance envelope includes a `schemaVersion` field that records the definition version at creation time.

On rehydration, the engine compares the persisted `schemaVersion` to the current definition version. If mismatched:
1. Check the definition registry for a registered migration function (`migrations.get(fromVersion, toVersion)`)
2. If a migration exists, run it and rehydrate with the migrated snapshot
3. If no migration exists, log a warning and skip the instance (do not silently corrupt it)

For `test-v0.1`, no migrations exist — this is infrastructure for Units 4-7 when production definitions evolve. The `schemaVersion` field and migration hook are implemented now so the instance file format doesn't need to change later.

### ED12: Instance lifecycle and cleanup

Completed instances (in a final state like `done`) are **excluded from rehydration** — the daemon does not create actors for them. They remain on disk for `codecorral status` and `codecorral history` (read from file, not from actor). A `codecorral gc [--older-than 30d]` command removes completed instances older than a threshold. No automatic cleanup in v1 — users run `gc` manually or via cron.

### ED13: npm installation and daemon lifecycle

`npx codecorral` is suitable for one-shot read-only commands (`status`, `workspaces`) but is **not recommended for daemon usage**. The npx cache key changes on version updates, which can orphan a running daemon. The recommended npm path is `npm install -g codecorral`.

When the CLI auto-starts a daemon, it resolves its own binary path to an absolute path and records it in the PID file. This ensures the daemon process is identifiable regardless of how the CLI was invoked. The CLI warns if it detects it's running via npx and attempts to auto-start a daemon.

## Risks / Trade-offs

**[Synchronous persistence on every state change]** → Could bottleneck if actors transition rapidly. Mitigation: `test-v0.1` transitions are human-paced. If production workflows need higher throughput, introduce write coalescing (debounce writes, persist latest snapshot).

**[No WAL — events lost during downtime]** → Accepted for v1. Agents running in tmux sessions will get `connection refused` on MCP calls and should retry. The engine recovers to the last persisted state, which is at most one transition behind.

**[Single-process daemon]** → No horizontal scaling. Mitigation: CodeCorral targets solo developers — one machine, one daemon. Conductor pools (D2) are future work.

**[Unix socket limits discoverability]** → Clients must check `~/.codecorral/daemon.sock`. Mitigation: All access goes through the `codecorral` CLI binary, which handles discovery internally. MCP clients connect via stdio transport, not the socket directly.

**[Config file conflicts between HM-generated and manual edits]** → If a user has HM generating config but also manually edits, HM will overwrite on next activation. Mitigation: document that HM-managed config is declarative — manual edits should go in project-level `.codecorral/config.yaml` overrides instead.
