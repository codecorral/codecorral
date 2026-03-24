## Why

The engine-core (Unit 1) ships with a `test-v0.1` workflow that validates the actor lifecycle, persistence, and event processing — but it has no external I/O. Before any production workflow can manage agent sessions, the engine needs `fromPromise` service actors that wrap agent-deck's CLI operations, deterministic session naming so sessions are discoverable by convention rather than stored IDs, and recursive child session teardown since agent-deck has no atomic recursive stop. This unit bridges the engine to its primary external dependency — session management — and proves the integration with a `test-v0.2` workflow that creates a real agent-deck session, sends it a message, and tears it down.

## What Changes

- Add `fromPromise` service actors wrapping each C1 operation: `createSession` (agent-deck `launch`), `sendMessage` (`session send`), `stopSession` (`session stop`), `removeSession` (`remove`), `showSession` (`session show --json`), `attachMcp` (`mcp attach` + `session restart`), `setParent` (`session set-parent`)
- Add `listSessions` service for discovery: `agent-deck list --json` filtered by title prefix
- Implement deterministic session title generation: `cc-{workflowId}-{phase}` with sanitization (`[a-z0-9-]` only, max 60 chars)
- Implement `stopSessionTree(title)` — recursive child session teardown by listing children via `list --json`, recursing depth-first, then stopping the parent
- Implement session prompt template system — composable prompt builder that injects phase-appropriate context, commit guidance, and workflow MCP tool references into initial messages
- Inject `WFE_INSTANCE_ID` into sessions via the initial message (agent reads and sets env)
- Register `test-v0.2` workflow definition extending `test-v0.1` with `SETUP → AGENT_WORKING → TEARDOWN` states that invoke session service actors
- Register a `test-v0.1 → test-v0.2` migration in the definition registry

## Capabilities

### New Capabilities
- `session-services`: `fromPromise` service actors wrapping all C1 agent-deck CLI operations with typed inputs/outputs, exit code interpretation, and JSON parsing
- `session-naming`: Deterministic session title generation from workflow ID + phase, title sanitization, and prefix-based session discovery
- `session-lifecycle`: Recursive child session teardown (`stopSessionTree`), session state queries via `showSession`, and lifecycle sequencing (running → stopped → removed)
- `session-prompts`: Composable prompt template system for injecting phase context, commit guidance, workflow MCP tool reference, and `WFE_INSTANCE_ID` into initial session messages
- `test-workflow-v02`: `test-v0.2` workflow definition with `SETUP → AGENT_WORKING → TEARDOWN` states that invoke `createSession`, wait for agent completion, then invoke `stopSession` + `removeSession`

### Modified Capabilities
- `test-workflow`: `test-v0.2` registered alongside `test-v0.1`; migration added for `test-v0.1 → test-v0.2` snapshot evolution

## Impact

**New code:**
- `src/services/agent-deck.ts` — Service actor implementations wrapping agent-deck CLI
- `src/services/session-naming.ts` — Title generation and sanitization
- `src/services/session-lifecycle.ts` — `stopSessionTree` and discovery helpers
- `src/services/session-prompts.ts` — Prompt template builder
- `src/actors/test-workflow-v02.ts` — `test-v0.2` XState machine definition

**Modified code:**
- `src/actors/definition-registry.ts` — Register `test-v0.2`, add migration from `test-v0.1`

**Runtime dependencies:**
- agent-deck CLI v0.8.x must be installed and on PATH
- Sessions require a tmux server running

**Runtime artifacts:**
- agent-deck sessions with `cc-*` title prefix created/managed by the engine
- `WFE_INSTANCE_ID` environment variable injected into agent session conversations
