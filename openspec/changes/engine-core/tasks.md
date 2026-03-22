## 1. Project Scaffolding

- [ ] 1.1 Initialize TypeScript package with `package.json` (name: `codecorral`, bin entry for `codecorral` CLI), tsconfig, and build pipeline
- [ ] 1.2 Set up project structure: `src/` with subdirectories for `daemon/`, `cli/`, `mcp/`, `actors/`, `config/`, `persistence/`
- [ ] 1.3 Add dependencies: xstate v5, @modelcontextprotocol/sdk, yaml (config parsing), commander (CLI framework)

## 2. XState Actor Runtime

- [ ] 2.1 Implement definition registry — `Map<string, MachineConfig>` with registration API and CLI-embedded tier loading
- [ ] 2.2 Implement `test-v0.1` workflow definition: 4 states (idle, working, reviewing, done), events (start, submit, review.approved, review.revised), sync guard (`hasWork`), context assignments (hasWork, submitCount, workStartedAt)
- [ ] 2.3 Implement actor registry — `Map<string, ActorRef>` for tracking live actors by instance ID
- [ ] 2.4 Implement actor creation: look up definition, create actor with `createActor()`, subscribe for persistence, start, register in actor registry
- [ ] 2.5 Implement event translation layer: external `{ event, payload }` → internal `{ type, ...flatPayload }`
- [ ] 2.6 Implement transition result reporting: `TransitionResult` with accepted, newState, phase, message

## 3. Snapshot Persistence

- [ ] 3.1 Create `~/.codecorral/instances/` directory on first use (ensure parent dirs exist)
- [ ] 3.2 Implement atomic snapshot write: serialize `PersistedWorkflowInstance` (id, definitionId, xstateSnapshot, history, timestamps), write to `.tmp`, rename to `.json`
- [ ] 3.3 Implement `actor.subscribe()` callback that triggers atomic persistence on every state change
- [ ] 3.4 Implement event history tracking: append to history array on each event, enforce bounded size (default 1000)
- [ ] 3.5 Implement instance rehydration: read `*.json` from instances dir, `createActor(machine, { snapshot })`, re-subscribe, start — skip corrupted/unknown files with warnings
- [ ] 3.6 Implement instance ID generation: `{definitionId}-{random8chars}` format

## 4. Daemon Lifecycle

- [ ] 4.1 Implement daemon process: long-lived Node.js process, create Unix socket at `~/.codecorral/daemon.sock`, write PID to `daemon.pid`
- [ ] 4.2 Implement JSON-RPC server over the Unix socket — register handlers for status, history, transition, workspaces, daemon commands
- [ ] 4.3 Implement graceful shutdown: handle SIGTERM/SIGINT, persist all actor snapshots, close socket, remove PID file, exit 0
- [ ] 4.4 Implement daemon logging to `~/.codecorral/daemon.log` — startup, shutdown, rehydration, event processing, errors
- [ ] 4.5 Implement stale socket detection and cleanup (socket exists but connection refused → remove and restart)

## 5. CLI

- [ ] 5.1 Implement CLI entry point with commander: `codecorral` binary with subcommands
- [ ] 5.2 Implement daemon auto-start logic: check socket → connect or spawn daemon → wait for socket → connect
- [ ] 5.3 Implement `codecorral status [id]` — list all instances or show detailed status for one
- [ ] 5.4 Implement `codecorral history <id>` — display event log in reverse chronological order
- [ ] 5.5 Implement `codecorral transition <event> --instance <id> [--payload '{}'] [--definition <defId>]` — fire transition, create instance if needed
- [ ] 5.6 Implement `codecorral workspaces` — enumerate configured workspaces from config.yaml
- [ ] 5.7 Implement `codecorral daemon start [--foreground]`, `codecorral daemon stop`, `codecorral daemon status`

## 6. MCP Server

- [ ] 6.1 Implement MCP server using @modelcontextprotocol/sdk with stdio transport
- [ ] 6.2 Register `workflow.transition` tool: read `WFE_INSTANCE_ID` from env or explicit param, translate event, send to actor, return TransitionResult
- [ ] 6.3 Register `workflow.status` tool: return instanceId, definitionId, currentState, phase, availableTransitions (via `snapshot.can()`)
- [ ] 6.4 Register `workflow.context` tool: return the XState context object for the instance
- [ ] 6.5 Register `workflow.setBrowserUrl` tool: store URL in instance context under `browserUrl`
- [ ] 6.6 Wire MCP server to daemon's actor registry (shared process, internal API calls)

## 7. Workspace Configuration

- [ ] 7.1 Define config file schema: YAML structure for workspaces with path, workflows, agentDeck, claudeCode, openspec sections
- [ ] 7.2 Implement config loader: read `~/.codecorral/config.yaml`, parse YAML, validate structure, return typed config object
- [ ] 7.3 Implement config merging: user-level (`~/.codecorral/config.yaml`) + project-level (`.codecorral/config.yaml`) with project precedence
- [ ] 7.4 Wire config into `codecorral workspaces` command output

## 8. Nix Distribution

- [ ] 8.1 Update `flake.nix`: add `codecorral` package output that builds the TypeScript CLI into a standalone binary (via esbuild or nix buildNpmPackage)
- [ ] 8.2 Implement Home Manager module (`nix/hm-module.nix`): option declarations for `codecorral.workspaces` with full schema (path, workflows, agentDeck, claudeCode, openspec)
- [ ] 8.3 Implement HM module config generation: serialize workspace options to `~/.codecorral/config.yaml`
- [ ] 8.4 Implement HM module schema package integration: when `openspec.schemas` references built-in schemas, ensure the `openspec-schemas` package is in the user's profile
- [ ] 8.5 Add `nix flake check` validation for the new package and module

## 9. Integration Testing

- [ ] 9.1 Test full lifecycle: create instance → transition through all states → verify persistence → restart daemon → verify rehydration
- [ ] 9.2 Test MCP tools: start instance via CLI, call workflow.transition/status/context via MCP, verify results
- [ ] 9.3 Test CLI commands: status, history, transition, workspaces against a running daemon
- [ ] 9.4 Test guard rejection: attempt `review.approved` without `hasWork` → verify rejection
- [ ] 9.5 Test concurrent instances: create two instances, transition independently, verify no cross-contamination
- [ ] 9.6 Test stale socket recovery: kill daemon, verify CLI auto-restarts and recovers
- [ ] 9.7 Test config loading: valid config, missing config, malformed config, config merging
