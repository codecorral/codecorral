## 1. Project Scaffolding

- [ ] 1.1 Initialize TypeScript package with `package.json` (name: `codecorral`, bin entry for `codecorral` CLI), tsconfig, and build pipeline
- [ ] 1.2 Set up project structure: `src/` with subdirectories for `daemon/`, `cli/`, `mcp/`, `actors/`, `config/`, `persistence/`
- [ ] 1.3 Add dependencies: xstate v5, @modelcontextprotocol/sdk, yaml (config parsing), commander (CLI framework)

## 2. XState Actor Runtime

- [ ] 2.1 Implement definition registry — `Map<string, MachineConfig>` with registration API and CLI-embedded tier loading
- [ ] 2.2 Implement `test-v0.1` workflow definition: 4 states (idle, working, reviewing, done), events (start, submit, review.approved, review.revised), sync guard (`hasWork`), context assignments (hasWork, submitCount, workStartedAt). `review.revised` resets `hasWork = false` so guard blocks re-approval without new work
- [ ] 2.3 Implement actor registry — `Map<string, ActorRef>` for tracking live actors by instance ID
- [ ] 2.4 Implement actor creation: look up definition, create actor with `createActor()`, subscribe for persistence, start, register in actor registry
- [ ] 2.5 Implement event translation layer: external `{ event, payload }` → internal `{ type, ...flatPayload }`
- [ ] 2.6 Implement transition result reporting: `TransitionResult` with accepted, newState, phase, message

## 3. Snapshot Persistence

- [ ] 3.1 Create `~/.codecorral/instances/` directory on first use (ensure parent dirs exist)
- [ ] 3.2 Implement atomic snapshot write: serialize `PersistedWorkflowInstance` (id, definitionId, schemaVersion, xstateSnapshot, history, timestamps), write to `.tmp`, rename to `.json`
- [ ] 3.3 Implement `actor.subscribe()` callback with referential equality deduplication (`if snapshot !== prevSnapshot`) that triggers atomic persistence only on actual state changes
- [ ] 3.4 Implement event history tracking: append to history array on each event, enforce bounded size (default 1000)
- [ ] 3.5 Implement instance rehydration: delete orphaned `*.json.tmp` files first, then read `*.json`, skip completed instances (final state), check `schemaVersion` against definition (skip on mismatch with no migration), `createActor(machine, { snapshot })`, re-subscribe, start — skip corrupted/unknown files with warnings
- [ ] 3.6 Implement instance ID generation: `{definitionId}-{random8chars}` format
- [ ] 3.7 Implement snapshot versioning: `schemaVersion` field in instance envelope, migration registry (`Map<string, MigrationFn>`), version comparison on rehydration

## 4. Daemon Lifecycle

- [ ] 4.1 Implement daemon process: long-lived Node.js process, create Unix socket at `~/.codecorral/daemon.sock`, write PID to `daemon.pid`
- [ ] 4.2 Implement JSON-RPC server over the Unix socket with Content-Length framing (LSP wire format) — register handlers for status, history, transition, workspaces, daemon commands. Use `vscode-jsonrpc` for transport.
- [ ] 4.3 Implement graceful shutdown: handle SIGTERM/SIGINT, persist all actor snapshots, close socket, remove PID file, exit 0
- [ ] 4.4 Implement daemon logging to `~/.codecorral/daemon.log` — startup, shutdown, rehydration, event processing, errors
- [ ] 4.5 Implement stale socket detection and cleanup (socket exists but connection refused → remove and restart)

## 5. CLI

- [ ] 5.1 Implement CLI entry point with commander: `codecorral` binary with subcommands
- [ ] 5.2 Implement client-only read path: `status`, `history`, `workspaces` read persisted files directly without daemon. Handle ENOENT gracefully (skip missing files).
- [ ] 5.3 Implement daemon auto-start logic for mutating commands: check socket → connect or spawn daemon → wait for socket → connect. Warn if running via npx.
- [ ] 5.4 Implement `codecorral status [id]` — list all instances or show detailed status for one (reads files directly, no daemon needed)
- [ ] 5.5 Implement `codecorral history <id>` — display event log in reverse chronological order (reads files directly)
- [ ] 5.6 Implement `codecorral transition <event> --instance <id> [--payload '{}'] [--definition <defId>]` — fire transition, create instance if needed (requires daemon)
- [ ] 5.7 Implement `codecorral workspaces` — enumerate configured workspaces from config.yaml (reads files directly)
- [ ] 5.8 Implement `codecorral daemon start [--foreground]`, `codecorral daemon stop`, `codecorral daemon status`
- [ ] 5.9 Implement `codecorral gc [--older-than 30d]` — remove completed instances older than threshold

## 6. MCP Server

- [ ] 6.1 Implement MCP server as a thin per-session process using @modelcontextprotocol/sdk with stdio transport. Each MCP process connects to the daemon via Unix socket (JSON-RPC with Content-Length framing). Architecture: Agent ↔ stdio ↔ MCP process ↔ Unix socket ↔ Daemon
- [ ] 6.2 Register `workflow.transition` tool: read `WFE_INSTANCE_ID` from env or explicit param, translate event, send to actor, return TransitionResult
- [ ] 6.3 Register `workflow.status` tool: return instanceId, definitionId, currentState, phase, availableTransitions (via `snapshot.can()`)
- [ ] 6.4 Register `workflow.context` tool: return the XState context object for the instance
- [ ] 6.5 Register `workflow.setBrowserUrl` tool: store URL in instance context under `browserUrl`
- [ ] 6.6 Wire MCP process to daemon via Unix socket JSON-RPC client (each MCP process is a socket client, daemon is the multiplexer)

## 7. Workspace Configuration

- [ ] 7.1 Define config file schema: YAML structure for workspaces with path, workflows, agentDeck, claudeCode, openspec sections
- [ ] 7.2 Implement config loader: read `~/.codecorral/config.yaml`, parse YAML, validate structure, return typed config object
- [ ] 7.3 Implement config merging: user-level (`~/.codecorral/config.yaml`) + project-level (`.codecorral/config.yaml`) with project precedence
- [ ] 7.4 Wire config into `codecorral workspaces` command output

## 8. Nix Distribution

- [ ] 8.1 Update `flake.nix`: add `codecorral` package output that builds the TypeScript CLI into a standalone binary (via esbuild or nix buildNpmPackage)
- [ ] 8.2 Implement Home Manager module: `programs.codecorral.enable` guard, `programs.codecorral.workspaces` option with `lib.types.submodule` for workspace schema (path, workflows, agentDeck, claudeCode, openspec)
- [ ] 8.3 Implement HM module config generation: serialize workspace options to `~/.codecorral/config.yaml` (CodeCorral-specific fields only — profile names, workflow assignments)
- [ ] 8.4 Implement HM module upstream delegation: set `programs.agent-deck.profiles`, `programs.claude-code.profiles`, `programs.openspec.schemas` from workspace config. Guard each with `lib.mkIf` for upstream module availability. Add `lib.assertMsg` for duplicate profile names.
- [ ] 8.5 Implement HM module schema integration: collect union of all workspace `openspec.schemas` lists and set `programs.openspec.schemas`
- [ ] 8.6 Add `nix flake check` validation for the new package and module

## 9. Integration Testing

- [ ] 9.1 Test full lifecycle: create instance → transition through all states → verify persistence → restart daemon → verify rehydration
- [ ] 9.2 Test MCP tools: start instance via CLI, call workflow.transition/status/context via MCP, verify results
- [ ] 9.3 Test CLI commands: status, history, transition, workspaces against a running daemon
- [ ] 9.4 Test guard rejection: attempt `review.approved` without `hasWork` → verify rejection. Also test review loop: submit → approve fails after revised (hasWork reset)
- [ ] 9.5 Test concurrent instances: create two instances, transition independently, verify no cross-contamination
- [ ] 9.6 Test stale socket recovery: kill daemon, verify CLI auto-restarts and recovers
- [ ] 9.7 Test config loading: valid config, missing config, malformed config, config merging
- [ ] 9.8 Test snapshot versioning: persist with schemaVersion, rehydrate with matching version succeeds, mismatched version with no migration skips with warning
- [ ] 9.9 Test orphaned tmp cleanup: create `.json.tmp` files, restart daemon, verify they are deleted
- [ ] 9.10 Test client-only CLI: stop daemon, run `codecorral status` and `codecorral history`, verify they work by reading files directly
- [ ] 9.11 Test subscribe deduplication: send rejected event, verify no persistence write occurs
- [ ] 9.12 Test MCP per-session spawning: two concurrent MCP processes connect to same daemon, verify independent operation
