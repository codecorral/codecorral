## Context

The engine-core (Unit 1) provides an XState actor runtime, snapshot persistence, MCP server, CLI, and daemon — but all workflow definitions are pure state machines with synchronous guards and actions. The `test-v0.1` workflow has no `invoke` calls, no external I/O, and no session management. To drive real agent workflows, the engine needs to call agent-deck's CLI for session lifecycle operations.

Agent-deck (v0.26+) exposes session management via CLI commands (`launch`, `session send`, `session stop`, `remove`, `session show --json`, `list --json`, `mcp attach`, `session restart`, `session set-parent`). These are the C1 contract operations. The engine wraps each as a `fromPromise` service actor — XState's mechanism for async, fallible operations that report results via `onDone`/`onError`.

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

### SD1: Shell out via `node:child_process`, not a Bun-only API

Wrap agent-deck CLI commands via `child_process.spawn` with JSON parsing of stdout. Agent-deck has no programmatic SDK — CLI is the stable contract (C1).

Using `node:child_process` instead of `Bun.spawn` keeps the production code portable across Node.js and Bun runtimes. Bun is the dev runtime (fast startup, native TypeScript, `bun test`), but source code uses only `node:` APIs so the packaged CLI works for anyone with Node 20+ or Bun.

**Alternative considered:** `Bun.spawn`. Rejected — locks production code to Bun, means `npm install -g codecorral` fails under Node.js. The `node:child_process` API works identically under both runtimes.

**Alternative considered:** Importing agent-deck internals directly. Rejected — couples to implementation, violates the customer-supplier boundary.

### SD2: One `fromPromise` per CLI operation, composed in workflow definitions

Each C1 operation gets its own `fromPromise` actor creator (e.g., `createSessionActor`, `sendMessageActor`, `stopSessionActor`, `getOutputActor`). Workflow definitions compose these in their `invoke` fields. This keeps service actors single-responsibility and independently testable.

The full set of service actors: `createSession`, `sendMessage`, `stopSession`, `removeSession`, `showSession`, `getOutput`, `attachMcp`, `setParent`, `listSessions`.

Note: `getOutput` wraps `agent-deck session output --json` — needed by Unit 3 (conductor) for polling agent completion. Including it now avoids a gap downstream.

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

**Verification:** After session creation, the engine can verify `WFE_INSTANCE_ID` is set by having the agent call `workflow.status()` as part of its startup. If the call succeeds (returns instance data), the env var is working. If it fails (no instance context), the prompt injection didn't take effect. This verification is optional in `test-v0.2` but recommended for production workflows in Unit 4.

**Alternative considered:** Writing a `.env` file to the worktree. Rejected — pollutes the working tree and requires cleanup. The initial message approach is ephemeral and self-documenting.

### SD5: Recursive `stopSessionTree` with per-session parent discovery

Agent-deck has no atomic recursive stop. Additionally, `agent-deck list --json` does **not** include a `parent` field — parent information is only available via `session show --json` per session.

The engine discovers children by: (1) listing all sessions with `list --json`, (2) filtering by the workflow's title prefix (`cc-{shortId}-*`), (3) calling `session show --json` on each to get the parent field, (4) recursing depth-first on children.

```
stopSessionTree(title):
  sessions = exec("agent-deck list --json")
  workflowSessions = sessions.filter(s => s.title.startsWith(prefix))
  children = []
  for s in workflowSessions:
    info = exec("agent-deck session show {s.title} --json")
    if info.parent === title:
      children.push(s)
  for child in children:
    await stopSessionTree(child.title)   // depth-first
  await exec("agent-deck session stop {title}")
```

This is O(n) `show` calls where n = sessions matching the workflow prefix (typically 2-5, not all sessions). The prefix filter keeps it bounded.

Note: agent-deck limits parent-child to **two levels** (`set-parent` rejects if parent is itself a child). The recursion handles this correctly but never goes deeper than one level in practice.

This is a standalone async function (not a `fromPromise` actor) because it's a composite operation used within other service actors. It's exposed as a helper that `stopSessionActor` calls internally when `recursive: true` is passed.

### SD6: Phase prompts declared in the workflow definition, engine prepends preamble

Session prompts are **authored as part of the workflow definition**, not derived by a generic utility. Each phase that creates a session has a prompt in the machine's context that tells the agent what to do in that phase. The elaboration prompt is different from the implementation prompt is different from the review prompt — they're phase-specific documents, not computed strings.

```typescript
setup({
  // ...
}).createMachine({
  context: {
    prompts: {
      elaboration: `You are elaborating unit brief "{unitBrief.name}".
        Use /opsx:continue to generate each artifact.
        Commit cohesive changes as you work.
        Before signaling artifact.ready, ensure all changes are committed.`,
      implementation: `You are implementing tasks from the spec.
        Use /opsx:apply to get your task list.
        Use conventional commits. Create a PR when implementation is complete.`,
    },
    // ... other context
  },
  states: {
    elaboration_setup: {
      invoke: {
        src: 'createSession',
        input: ({ context }) => ({
          title: generateSessionTitle(context.instanceId, 'elab'),
          initialMessage: context.prompts.elaboration,  // phase prompt from definition
          // ...
        }),
      }
    }
  }
})
```

**The engine prepends a preamble** to whatever prompt the definition provides. The preamble contains engine-level concerns only:

```
[Engine Preamble — auto-injected, not part of the definition]
Your workflow instance ID is: {instanceId}
Set this in your environment: export WFE_INSTANCE_ID="{instanceId}"

Available workflow tools: workflow.transition, workflow.status, workflow.context

[Phase Prompt — from the workflow definition]
{context.prompts[phase]}
```

This means:
- **Workflow definitions own the phase prompts** — versioned with the definition, overridable via `.provide()` or definition precedence (D19)
- **The engine owns the preamble** — instance ID injection, tool listing. Always prepended, never authored by the definition.
- **OpenSpec-specific instructions live in the phase prompt**, written by the definition author — not injected by the engine. The engine has no knowledge of OpenSpec.
- **Custom workflows** (authoring skill, Unit 8) define their own phase prompts. The engine just prepends the preamble.

For `test-v0.2`, prompts are minimal: "You are in a test workflow. Call `workflow.transition('impl.complete')` when done." For `unit-v1.0` in Unit 4, they're rich with OpenSpec slash command guidance, artifact expectations, and review criteria.

The `assembleSessionPrompt(instanceId, phasePrompt, workflowTools)` function handles preamble + phase prompt concatenation. It's a thin formatter, not a prompt authoring system.

### SD7: `test-v0.2` state machine design

```
idle --[start]--> setup --[invoke:createSession onDone]--> agent_working
agent_working --[send_message]--> sending --[invoke:sendMessage onDone]--> agent_working
agent_working --[impl.complete]--> teardown
teardown --[invoke:stopSession onDone]--> cleanup
cleanup --[invoke:removeSession onDone]--> done

Error paths:
setup --[invoke:createSession onError]--> setup_failed (final)
sending --[invoke:sendMessage onError]--> agent_working (log error, continue)
teardown --[invoke:stopSession onError]--> done  (best-effort cleanup)
```

Context extends `test-v0.1`:
- `sessionTitle: string | null` — set by `createSession` onDone
- `sessionError: string | null` — set on any service error

The `sending` state exercises `sendMessageActor` — a mid-conversation message path that Unit 3 (conductor) and Unit 4 (unit-workflow) depend on. Without testing it here, the first consumer would be a production workflow with no prior integration proof.

The `createSession` input accepts an optional `group` parameter (`-g` flag) for organizing sessions by project. Not used by `test-v0.2` but exposed in the input type so Unit 3 doesn't need to change the interface.

The machine uses `setup()` with actors registered via the `actors` field — XState v5's way to declare invoked service actors that can be overridden via `.provide()` for testing.

### SD8: Service actor error handling — exit codes + error JSON + timeouts

All service actors interpret agent-deck exit codes per C1 guarantees:
- Exit 0 = success, parse stdout as JSON
- Exit 1 = error, parse stderr for JSON error envelope (`{ success, error, code }`)
- Exit 2 = not found (session doesn't exist)

Agent-deck returns semantic error codes in the JSON body: `NOT_FOUND`, `ALREADY_EXISTS`, `AMBIGUOUS`, `INVALID_OPERATION`. The error shape includes these:

```typescript
type AgentDeckError = {
  exitCode: number
  stderr: string
  command: string
  code?: string  // parsed from error JSON: "NOT_FOUND" | "ALREADY_EXISTS" | "AMBIGUOUS" | ...
}
```

**`AMBIGUOUS` handling:** If two sessions match the same title (possible at different paths), agent-deck returns `AMBIGUOUS`. Service actors surface this as a distinct error for workflow definitions to handle (e.g., fall back to session ID).

**Timeouts:** Each `fromPromise` actor wraps `Bun.spawn` with a configurable timeout via `AbortSignal.timeout()`. Defaults: `createSession` 60s, `sendMessage` 30s, `stopSession` 10s, `showSession` 5s. Timeout triggers process kill and rejects with `{ exitCode: -1, stderr: "timeout", command }`.

**`stopSession` treats exit code 2 as success** (idempotent — session already gone). This prevents teardown failures when a session was cleaned up by agent-deck's own timeouts.

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
