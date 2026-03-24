## 1. Session Service Actors

- [ ] 1.1 Create `src/services/agent-deck.ts` with shared `execAgentDeck` helper that runs agent-deck CLI commands via `Bun.spawn`, captures stdout/stderr, and returns `{ exitCode, stdout, stderr }` — rejecting with `{ exitCode, stderr, command }` on non-zero exit
- [ ] 1.2 Implement `createSessionActor` (`fromPromise`) wrapping `agent-deck launch` with typed `CreateSessionInput` and `SessionRef` output, handling all launch flags (`-t`, `-c`, `-p`, `-w`, `-b`, `--location`, `--mcp`, `-m`, `--json`)
- [ ] 1.3 Implement `sendMessageActor` (`fromPromise`) wrapping `agent-deck session send`
- [ ] 1.4 Implement `stopSessionActor` (`fromPromise`) wrapping `agent-deck session stop` with optional `recursive` flag that delegates to `stopSessionTree`
- [ ] 1.5 Implement `removeSessionActor` (`fromPromise`) wrapping `agent-deck remove`
- [ ] 1.6 Implement `showSessionActor` (`fromPromise`) wrapping `agent-deck session show --json` with typed `SessionInfo` return
- [ ] 1.7 Implement `attachMcpActor` (`fromPromise`) wrapping `agent-deck mcp attach` + `agent-deck session restart`
- [ ] 1.8 Implement `setParentActor` (`fromPromise`) wrapping `agent-deck session set-parent`
- [ ] 1.9 Implement `listSessionsActor` (`fromPromise`) wrapping `agent-deck list --json` with optional title prefix filter

## 2. Session Naming

- [ ] 2.1 Create `src/services/session-naming.ts` with `extractShortId(instanceId)` — extracts last 8 characters of instance ID
- [ ] 2.2 Implement `sanitizeTitle(raw)` — lowercase, replace non-`[a-z0-9-]` with `-`, collapse consecutive hyphens, trim leading/trailing hyphens
- [ ] 2.3 Implement `generateSessionTitle(instanceId, phase)` — produces `cc-{shortId}-{phase}` with sanitization and 60-char truncation
- [ ] 2.4 Implement `getSessionPrefix(instanceId)` — returns `cc-{shortId}` for discovery filtering

## 3. Session Lifecycle

- [ ] 3.1 Create `src/services/session-lifecycle.ts` with `stopSessionTree(title)` — lists sessions, filters children by parent field, recurses depth-first, then stops target
- [ ] 3.2 Implement `discoverWorkflowSessions(instanceId)` — calls `listSessionsActor` with prefix from `getSessionPrefix`

## 4. Session Prompts

- [ ] 4.1 Create `src/services/session-prompts.ts` with `renderInstanceIdBlock(instanceId)` — returns instruction text for setting `WFE_INSTANCE_ID`
- [ ] 4.2 Implement `renderPhaseContext(phase)` — returns phase description section
- [ ] 4.3 Implement `renderToolReference(workflowTools)` — returns MCP tool listing section
- [ ] 4.4 Implement `renderCommitGuidance(guidance)` — returns commit section (empty string if null)
- [ ] 4.5 Implement `buildSessionPrompt({ instanceId, phase, workflowTools, commitGuidance?, additionalContext? })` — composes all segments

## 5. test-v0.2 Workflow Definition

- [ ] 5.1 Create `src/actors/test-workflow-v02.ts` with `testWorkflowV02` XState machine — states: `idle`, `setup`, `agent_working`, `teardown`, `done` (final), `setup_failed` (final) — using `setup({ actors: { createSession, stopSession, removeSession } })`
- [ ] 5.2 Implement `setup` state with `invoke: createSession` — input derives session params from context, `onDone` assigns `sessionTitle`, `onError` assigns `sessionError` and transitions to `setup_failed`
- [ ] 5.3 Implement `agent_working` state with `impl.complete` event transitioning to `teardown`
- [ ] 5.4 Implement `teardown` as compound state or sequential invocations — `stopSession` (recursive) then `removeSession`, with error fallthrough to `done`
- [ ] 5.5 Wire initial message via `buildSessionPrompt` in `createSession` input derivation

## 6. Definition Registry Integration

- [ ] 6.1 Update `src/actors/definition-registry.ts` `loadEmbeddedDefinitions()` to register `test-v0.2` alongside `test-v0.1`
- [ ] 6.2 Register migration `test-v0.1 → test-v0.2` — map states (`idle`→`idle`, `working`→`agent_working`, `reviewing`→`agent_working`, `done`→`done`), add `sessionTitle: null` and `sessionError: null` to context

## 7. Tests

- [ ] 7.1 Unit tests for session naming: `extractShortId`, `sanitizeTitle`, `generateSessionTitle`, `getSessionPrefix` — covering edge cases (long titles, special chars, consecutive hyphens)
- [ ] 7.2 Unit tests for session prompts: each `render*` function and `buildSessionPrompt` composition — verify segments present/absent based on optional params
- [ ] 7.3 Unit tests for `test-v0.2` machine using `.provide()` to mock service actors — verify happy path, setup failure, and teardown error fallthrough
- [ ] 7.4 Unit test for `test-v0.1 → test-v0.2` migration — verify state mapping and context extension
