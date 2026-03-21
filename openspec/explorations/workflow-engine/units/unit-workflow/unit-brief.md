## Unit: unit-workflow

**Description:** The `dev.codecorral.unit` XState machine — the core elaboration-to-implementation workflow that consumes a unit brief and drives it through the complete AI-DLC construction lifecycle. Includes all states, transitions, guards, async precondition services, session prompts, and OpenSpec conformist integration. This is the workflow previously referred to as "proposal" in the domain model.

**Deliverable:** `unit-v1.0` workflow definition (XState machine config via `setup().createMachine()`). OpenSpec conformist integration (C3/C4 — read schema YAML, `checkArtifactExists` and `checkTasksComplete` precondition services). Phase-specific session prompts with commit guidance. The full event catalog. CLI commands for review gates: `codecorral approve [--ff]`, `codecorral revise --feedback "..."`, `codecorral abort <id>`, `codecorral skip <id>`.

**Dependencies:** conductor-and-board

## Relevant Requirements

- Three built-in OpenSpec schemas with paired workflow definitions: intent, **unit**, and t2d
- Unit workflow consumes a unit brief from the task board, drives through proposal, design, spec, review, implementation, code review, verification, and completion
- Guard system for git state verification (worktree clean, artifact exists, tests passed)
- Session prompt injection with phase-appropriate context and commit guidance
- OpenSpec schemas are upstream (conformist relationship)

## System Context

**Contracts exercised:** C3 (OpenSpec conformist — read schema YAML, precondition checks via `openspec status --json`), C4 (Schema Context — parse schema definitions for artifact dependency graph).

**State machine structure:**
```
IDLE
  → workflow.pull → PULLED
    → (invoke: createElaborationSession) → ELABORATING
      → context.loaded → ROUTING
        → (invoke: instructConductor for route decision) → WAITING_ROUTE
          → route.decided → ELABORATING_ARTIFACTS
            → artifact.ready → CHECKING_ARTIFACT (invoke: checkArtifactExists)
              → onDone → REVIEWING (if incremental) or next artifact (if fast-forward)
              → onError → ELABORATING_ARTIFACTS (bounce back)
            → REVIEWING
              → review.approved → CHECKING_REVIEW_PRECONDITIONS (invoke: checkWorktreeClean)
                → onDone → next artifact or IMPLEMENTING
                → onError → REVIEWING (bounce back)
              → review.revised → ELABORATING_ARTIFACTS (with feedback in context)
    → IMPLEMENTING
      → (invoke: createImplementationSession) → IMPLEMENTING_WORKING
        → impl.complete → CHECKING_IMPL (invoke: checkTasksComplete)
          → onDone → CODE_REVIEW or VERIFYING
          → onError → IMPLEMENTING_WORKING
        → pr.created → (assign PR URL to context)
    → CODE_REVIEW (optional, if review agent configured)
      → code-review.passed → VERIFYING
      → code-review.failed → IMPLEMENTING_WORKING
    → VERIFYING
      → verification.result(passed: true) → COMPLETING
      → verification.result(passed: false) → IMPLEMENTING_WORKING
    → COMPLETING
      → learnings.captured → RETROSPECTIVE
        → CLEANUP (invoke: stopSessions, removeSession after cooldown)
          → COMPLETE (final)
```

**Async precondition services (not sync guards):**
- `checkWorktreeClean` — `git status --porcelain` in worktree
- `checkHasNewCommits` — `git rev-list` since last phase entry
- `checkArtifactExists` — `openspec status --change X --json`
- `checkTasksComplete` — `openspec instructions apply --change X --json`

All modeled as `fromPromise` invoked services in intermediate checking states. XState v5 guards are sync-only — external checks cannot be guards (D21 update).

**Session prompts:** Phase-specific instructions injected at session creation:
- Elaboration: schema artifact instructions, commit guidance, workflow MCP tool reference
- Implementation: task list from `openspec instructions apply`, commit guidance, PR creation instructions
- Review: code review criteria, approval/revision format

**Review cycles:** The machine supports multiple review rounds per artifact. `reviewRound` counter in context tracks iterations. Fast-forward (`review.approved --ff`) skips remaining artifacts.

## Scope Boundaries

**In scope:**
- `unit-v1.0` XState machine definition with all states, transitions, guards, and invoked services
- OpenSpec conformist integration (C3): `checkArtifactExists`, `checkTasksComplete` precondition services
- Schema metadata reading (C4): parse artifact IDs, dependency graph, output paths from schema YAML
- Parallel precondition checking pattern (multiple `fromPromise` services in parallel states)
- Session prompt templates for elaboration, implementation, and review phases
- Commit guidance in session prompts (routine, checkpoint, post-review)
- Git state guards as invoked services (`checkWorktreeClean`, `checkHasNewCommits`)
- Full event catalog from C6 (agent, human, hook sources)
- CLI review commands: `codecorral approve`, `codecorral revise`, `codecorral abort`, `codecorral skip`
- Review round tracking, fast-forward support
- RETROSPECTIVE → CLEANUP → COMPLETE state sequence (D24)
- Schema-to-definition mapping (D22): multiple schemas can use this workflow definition

**Out of scope:**
- View engine / developer surface (Unit 5) — workflows run headless; view configs are defined here but the view engine consumes them
- Intent workflow (Unit 6) — separate machine, separate schema
- T2D workflow (Unit 7) — separate machine, separate schema
- Nix flake `.provide()` overrides for guard thresholds (Unit 8)
- Runtime structural composition of the machine (D21 — v2)
- Board adapter — conductor handles boards (Unit 3)
