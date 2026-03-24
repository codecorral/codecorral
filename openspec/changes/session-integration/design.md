## Context

The engine-core (Unit 1) provides an XState actor runtime, snapshot persistence, MCP server, CLI, and daemon — but all workflow definitions are pure state machines with synchronous guards and actions. The `test-v0.1` workflow has no `invoke` calls, no external I/O, and no session management. To drive real agent workflows, the engine needs to call agent-deck's CLI for session lifecycle operations.

Agent-deck v0.8.x exposes session management via CLI commands (`launch`, `session send`, `session stop`, `remove`, `session show --json`, `list --json`, `mcp attach`, `session restart`, `session set-parent`). These are the C1 contract operations. The engine wraps each as a `fromPromise` service actor — XState's mechanism for async, fallible operations that report results via `onDone`/`onError`.

The existing codebase uses:
- `src/actors/definition-registry.ts` for registering workflow definitions
- `src/actors/actor-registry.ts` for runtime actor lifecycle
- `src/actors/test-workflow.ts` for the `test-v0.1` machine
- Bun as runtime, `Bun.spawn` for child processes

## Goals / Non-Goals

**Goals:**
- Wrap all C1 agent-deck CLI operations as typed `fromPromise` service actors reusable by any workflow definition
- Implement deterministic session naming (`cc-{workflowId}-{phase}`) with sanitization
- Implement recursive child session teardown (`stopSessionTree`)
- Provide a composable session prompt template system
- Deliver `test-v0.2` as a concrete proof that the engine can create, interact with, and tear down agent-deck sessions
- Inject `WFE_INSTANCE_ID` so agents can call workflow MCP tools without explicit instance IDs

**Non-Goals:**
- Conductor sessions (Unit 3 — uses `agent-deck conductor setup`, not `launch`)
- View engine / cmux integration (Unit 5)
- Production workflow definitions (Units 4, 6, 7)
- Worktree management beyond passing branch name to `launch` (agent-deck owns worktrees per D2)
- Schema-specific session prompts (generic prompt injection here; schema content comes in Unit 4)

## Decisions

### SD1: Shell out via `Bun.spawn`, not a Node.js SDK

Wrap agent-deck CLI commands via `Bun.spawn` with JSON parsing of stdout. Agent-deck has no programmatic SDK — CLI is the stable contract (C1). Using `Bun.spawn` is consistent with the existing runtime.

**Alternative considered:** Importing agent-deck internals directly. Rejected — couples to implementation, violates the customer-supplier boundary.

### SD2: One `fromPromise` per CLI operation, composed in workflow definitions

Each C1 operation gets its own `fromPromise` actor creator (e.g., `createSessionActor`, `sendMessageActor`, `stopSessionActor`). Workflow definitions compose these in their `invoke` fields. This keeps service actors single-responsibility and independently testable.

**Alternative considered:** A single "session manager" actor that handles all operations via messages. Rejected — XState's `invoke` + `onDone`/`onError` pattern is the idiomatic way to model async I/O, and it gives each state clear success/failure handling.

### SD3: Session naming — `cc-{sanitizedId}-{phase}` with truncation

Title format: `cc-{workflowId}-{phase}` where:
- `workflowId` is the instance ID portion after the definition prefix (e.g., `test-v0.2-abc12345` → `abc12345`)
- `phase` is the workflow phase tag (e.g., `setup`, `agent`, `elab`, `impl`)
- Total max 60 characters (leaves room for agent-deck's `agentdeck_` prefix + 9-char suffix within tmux's limits)
- Characters restricted to `[a-z0-9-]` — anything else replaced with `-`, consecutive hyphens collapsed

The engine extracts the short ID by splitting on the first `-` after the definition prefix. This keeps titles readable while staying within tmux constraints.

**Alternative considered:** Using the full instance ID. Rejected — instance IDs like `test-v0.2-abc12345` are already long; adding phase would exceed limits for real workflows with longer definition names.

### SD4: `WFE_INSTANCE_ID` injection via initial message, not environment variable

Agent-deck's `launch` command doesn't support arbitrary env var injection into the Claude Code session. Instead, the initial message (`-m` flag) includes an instruction block:

```
Your workflow instance ID is: {instanceId}
Set this in your environment: export WFE_INSTANCE_ID="{instanceId}"
```

The MCP server already resolves `WFE_INSTANCE_ID` from `process.env` (see `src/mcp/server.ts:22-24`). The agent reads the initial message and sets the env var, making all subsequent `workflow.*` MCP tool calls resolve automatically.

**Alternative considered:** Writing a `.env` file to the worktree. Rejected — pollutes the working tree and requires cleanup. The initial message approach is ephemeral and self-documenting.

### SD5: Recursive `stopSessionTree` with list-filter-recurse

Agent-deck has no atomic recursive stop. The engine implements:

```
stopSessionTree(title):
  sessions = exec("agent-deck list --json")
  children = sessions.filter(s => s.parent === title)
  for child in children:
    await stopSessionTree(child.title)   // depth-first
  await exec("agent-deck session stop {title}")
```

This is a standalone async function (not a `fromPromise` actor) because it's a composite operation used within other service actors. It's exposed as a helper that `stopSessionActor` calls internally when `recursive: true` is passed.

### SD6: Prompt templates as composable builder functions

Session prompts are built from composable segments:

```typescript
buildSessionPrompt({
  instanceId: string,
  phase: string,
  workflowTools: string[],    // MCP tool names available
  commitGuidance?: string,    // e.g., "Use conventional commits with scope"
  additionalContext?: string,  // Extension point for Unit 4+
}): string
```

Each segment is a pure function returning a string block. The builder concatenates them. This keeps prompts testable without agent-deck and extensible for later units that add schema-specific content.

### SD7: `test-v0.2` state machine design

```
idle --[start]--> setup --[invoke:createSession onDone]--> agent_working
agent_working --[impl.complete]--> teardown
teardown --[invoke:stopSession onDone]--> cleanup
cleanup --[invoke:removeSession onDone]--> done

Error paths:
setup --[invoke:createSession onError]--> setup_failed (final)
teardown --[invoke:stopSession onError]--> done  (best-effort cleanup)
```

Context extends `test-v0.1`:
- `sessionTitle: string | null` — set by `createSession` onDone
- `sessionError: string | null` — set on any service error

The machine uses `setup()` with actors registered via the `actors` field — XState v5's way to declare invoked service actors that can be overridden via `.provide()` for testing.

### SD8: Service actor error handling — exit codes + stderr

All service actors interpret agent-deck exit codes per C1 guarantees:
- Exit 0 = success, parse stdout as JSON
- Exit 1 = error, capture stderr as error message
- Exit 2 = not found (session doesn't exist)

Errors are surfaced as rejected promises, which XState routes to `onError` transitions. The error object includes `{ exitCode, stderr, command }` for debuggability.

### SD9: Migration from test-v0.1 to test-v0.2

Register a migration `test-v0.1 → test-v0.2` that:
1. Maps `idle` → `idle`, `working` → `agent_working`, `reviewing` → `agent_working`, `done` → `done`
2. Adds new context fields (`sessionTitle: null`, `sessionError: null`)
3. Preserves existing context fields

This uses the migration registry already in `src/actors/definition-registry.ts`.

## Risks / Trade-offs

**[Agent-deck CLI not on PATH]** → Service actors check for `agent-deck` availability at daemon startup and log a warning. `test-v0.2` workflows will fail at `SETUP` with a clear error message. The engine itself remains functional for workflows that don't use sessions.

**[Tmux not running]** → Agent-deck requires tmux. Same mitigation — clear error at session creation time, not at engine startup.

**[Race condition in stopSessionTree]** → Between listing children and stopping them, new children could spawn. Mitigation: `stopSessionTree` is called during teardown states where no new sessions should be created. Document this ordering constraint.

**[Initial message parsing for WFE_INSTANCE_ID]** → Relies on the agent correctly parsing and setting the env var. If the agent doesn't set it, MCP tools still work with explicit `instanceId` parameter. The prompt template makes the instruction prominent and unambiguous.

**[Session title collisions across concurrent workflows]** → Titles include the instance ID (8 random chars). Collision probability is negligible for expected concurrency levels. If it becomes an issue, the instance ID length can be increased.
