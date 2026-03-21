## Unit: session-integration

**Description:** Integrates the workflow engine with agent-deck's session management CLI. The engine can create, message, stop, and remove agent-deck sessions with deterministic naming, child session lifecycle management, and MCP server attachment. Extends the test definition to `test-v0.2` with states that invoke session services.

**Deliverable:** Invoked service actors (`fromPromise`) wrapping agent-deck CLI operations: `createSession`, `sendMessage`, `stopSession`, `removeSession`, `showSession`. Deterministic session naming (`cc-{id}-{phase}`). Recursive child session teardown (D11). `WFE_INSTANCE_ID` injection into session environments. `test-v0.2` definition that creates an agent-deck session, sends an initial message, and tears it down on completion.

**Dependencies:** engine-core

## Relevant Requirements

- Contracts with session management (agent-deck) as defined in the contracts document (C1)
- Session prompt injection with phase-appropriate context and commit guidance
- Deterministic session naming (D1, D6) — sessions discovered by name pattern, not stored IDs

## System Context

**Contract exercised:** C1 (Engine → Session Management).

**Key interactions:**
- Engine calls agent-deck CLI: `launch`, `session send`, `session stop`, `remove`, `session show --json`
- Sessions are created as invoked services (`fromPromise`) — all I/O is async with `onDone`/`onError` handling
- Session titles follow `cc-{workflowId}-{phase}` convention (max 60 chars, `[a-z0-9-]` only)
- Engine queries session details via `session show --json` rather than caching (agent-deck is source of truth for session state)
- Agent-deck generates its own tmux session names (`agentdeck_{sanitized}_{hex}`) — the engine references sessions by title only

**Child session lifecycle (D11):**
- Agent-deck has no atomic recursive stop
- Engine implements `stopSessionTree(title)`: list children by parent, recurse, then stop parent
- Sessions go through `running → stopped → removed`. Remove only after workflow completion.

**`test-v0.2` definition:** Extends `test-v0.1` with `SETUP → AGENT_WORKING → TEARDOWN` states. `SETUP` invokes `createSession` (with worktree, MCP attachment, initial message). `AGENT_WORKING` waits for `workflow.transition("impl.complete")` from the agent. `TEARDOWN` invokes `stopSession` and `removeSession`.

## Scope Boundaries

**In scope:**
- `fromPromise` service actors wrapping all C1 operations (launch, send, stop, remove, show, mcp attach, set-parent)
- Deterministic session title generation from workflow ID + phase
- Title sanitization (length limit, character restrictions)
- Session discovery by title prefix pattern (`cc-{workflowId}-*`)
- Recursive child session teardown
- `WFE_INSTANCE_ID` environment injection (via initial message or CLAUDE.md — pending C1 open question #1)
- Session prompt template system (phase-appropriate context, commit guidance, workflow MCP tool reference)
- `test-v0.2` workflow definition

**Out of scope:**
- Conductor sessions — those use `agent-deck conductor setup`, not `launch` (Unit 3)
- View engine / cmux integration (Unit 5)
- OpenSpec-specific session prompts — generic prompt injection works; schema-specific content comes in Unit 4
- Worktree management — agent-deck owns worktrees (D2), engine just passes branch name to `launch`
