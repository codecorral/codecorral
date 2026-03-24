## 1. Session Service Actors

- [ ] 1.1 Create `src/services/agent-deck.ts` with shared `execAgentDeck` helper that runs agent-deck CLI commands via `node:child_process.spawn` (portable across Node and Bun) with configurable timeout (`AbortSignal.timeout()`), captures stdout/stderr, parses error JSON body for semantic `code` field (`AMBIGUOUS`, `ALREADY_EXISTS`, etc.), and returns `{ exitCode, stdout, stderr }` — rejecting with `{ exitCode, stderr, command, code? }` on non-zero exit
- [ ] 1.2 Implement `createSessionActor` (`fromPromise`) wrapping `agent-deck launch` with typed `CreateSessionInput` (including optional `group` for `-g` flag) and `SessionRef` output, handling all launch flags (`-t`, `-c`, `-p`, `-g`, `-w`, `-b`, `--location`, `--mcp`, `-m`, `--json`). Timeout: 60s.
- [ ] 1.3 Implement `sendMessageActor` (`fromPromise`) wrapping `agent-deck session send`
- [ ] 1.4 Implement `stopSessionActor` (`fromPromise`) wrapping `agent-deck session stop` with optional `recursive` flag that delegates to `stopSessionTree`
- [ ] 1.5 Implement `removeSessionActor` (`fromPromise`) wrapping `agent-deck remove`
- [ ] 1.6 Implement `showSessionActor` (`fromPromise`) wrapping `agent-deck session show --json` with typed `SessionInfo` return
- [ ] 1.7 Implement `attachMcpActor` (`fromPromise`) wrapping `agent-deck mcp attach` + `agent-deck session restart`
- [ ] 1.8 Implement `setParentActor` (`fromPromise`) wrapping `agent-deck session set-parent`
- [ ] 1.9 Implement `listSessionsActor` (`fromPromise`) wrapping `agent-deck list --json` with optional title prefix filter
- [ ] 1.10 Implement `getOutputActor` (`fromPromise`) wrapping `agent-deck session output --json` — returns last agent response text. Needed by Unit 3 (conductor) for polling agent completion.

## 2. Session Naming

- [ ] 2.1 Create `src/services/session-naming.ts` with `extractShortId(instanceId)` — extracts last 8 characters of instance ID
- [ ] 2.2 Implement `sanitizeTitle(raw)` — lowercase, replace non-`[a-z0-9-]` with `-`, collapse consecutive hyphens, trim leading/trailing hyphens
- [ ] 2.3 Implement `generateSessionTitle(instanceId, phase)` — produces `cc-{shortId}-{phase}` with sanitization and 60-char truncation
- [ ] 2.4 Implement `getSessionPrefix(instanceId)` — returns `cc-{shortId}` for discovery filtering

## 3. Session Lifecycle

- [ ] 3.1 Create `src/services/session-lifecycle.ts` with `stopSessionTree(title, prefix)` — lists sessions filtered by workflow prefix, calls `session show --json` per session to discover parent field (not available in `list --json`), recurses depth-first on children, then stops target. `stopSession` treats exit code 2 as success (idempotent).
- [ ] 3.2 Implement `discoverWorkflowSessions(instanceId)` — calls `listSessionsActor` with prefix from `getSessionPrefix`

## 4. Session Prompts

- [ ] 4.1 Create `src/services/session-prompts.ts` with `renderPreamble(instanceId, workflowTools)` — returns engine preamble string (instance ID export instruction + tool listing)
- [ ] 4.2 Implement `assembleSessionPrompt(instanceId, phasePrompt, workflowTools)` — prepends engine preamble to the definition-provided phase prompt. Thin formatter, not a prompt authoring system.
- [ ] 4.3 Define `context.prompts` structure for `test-v0.2`: minimal prompt for agent phase ("You are in a test workflow. Call `workflow.transition('impl.complete')` when done.")

## 5. test-v0.2 Workflow Definition

- [ ] 5.1 Create `src/actors/test-workflow-v02.ts` with `testWorkflowV02` XState machine — states: `idle`, `setup`, `agent_working`, `sending`, `teardown`, `done` (final), `setup_failed` (final) — using `setup({ actors: { createSession, sendMessage, stopSession, removeSession } })`
- [ ] 5.2 Implement `setup` state with `invoke: createSession` — input derives session params from context (including optional `group`), `onDone` assigns `sessionTitle`, `onError` assigns `sessionError` and transitions to `setup_failed`
- [ ] 5.3 Implement `agent_working` state with `impl.complete` → `teardown` and `send_message` → `sending` transitions
- [ ] 5.3a Implement `sending` state with `invoke: sendMessage` — `onDone` → `agent_working`, `onError` → `agent_working` (log error, continue)
- [ ] 5.4 Implement `teardown` as compound state or sequential invocations — `stopSession` (recursive) then `removeSession`, with error fallthrough to `done`
- [ ] 5.5 Wire initial message: `createSession` input derives `initialMessage` from `assembleSessionPrompt(context.instanceId, context.prompts.agent, workflowTools)`

## 6. Definition Registry Integration

- [ ] 6.1 Update `src/actors/definition-registry.ts` `loadEmbeddedDefinitions()` to register `test-v0.2` alongside `test-v0.1`
- [ ] 6.2 Register migration `test-v0.1 → test-v0.2` — map states (`idle`→`idle`, `working`→`agent_working`, `reviewing`→`agent_working`, `done`→`done`), add `sessionTitle: null` and `sessionError: null` to context

## 7. Tests

- [ ] 7.1 Unit tests for session naming: `extractShortId`, `sanitizeTitle`, `generateSessionTitle`, `getSessionPrefix` — covering edge cases (long titles, special chars, consecutive hyphens)
- [ ] 7.2 Unit tests for session prompts: `renderPreamble` (instance ID block + tool listing) and `assembleSessionPrompt` (preamble + phase prompt concatenation) — verify preamble always present, phase prompt appended as-is, empty phase prompt yields preamble only
- [ ] 7.3 Unit tests for `test-v0.2` machine using `.provide()` to mock service actors — verify happy path (including `send_message` → `sending` → `agent_working`), setup failure, sending error fallthrough, and teardown error fallthrough
- [ ] 7.4 Unit test for `test-v0.1 → test-v0.2` migration — verify state mapping and context extension
- [ ] 7.5 Unit tests for `execAgentDeck` error JSON parsing — verify `code` field extraction from stderr, timeout behavior, and `AMBIGUOUS`/`ALREADY_EXISTS` error codes
- [ ] 7.6 Unit tests for `stopSessionTree` with per-session `show` parent discovery — verify depth-first ordering and exit-code-2-as-success behavior
