## Unit: intent-workflow

**Description:** The `dev.codecorral.intent` XState machine paired with the existing `dev.codecorral.intent@2026-03-11.0` OpenSpec schema. Implements the AI-DLC inception workflow: a raw idea flows through intent-brief, requirements, system-context, unit decomposition, and bolt-plan, then unit briefs are published to the task board for the unit workflow to consume.

**Deliverable:** `intent-v1.0` workflow definition. Pairing with the existing intent schema (artifact IDs, dependency graph, output paths already defined). Board publishing action — conductor writes unit briefs to the configured board (GitHub Issues, local filesystem, etc.). View configs for intent workflow phases. The complete two-workflow composition: intent publishes → board → conductor pulls → unit workflow consumes.

**Dependencies:** unit-workflow

## Relevant Requirements

- Intent (`dev.codecorral.intent`) — Inception workflow. Takes a raw idea through intent-brief, requirements, system-context, unit decomposition, and bolt-plan. Already exists as a schema; needs a paired workflow definition. Publishes unit briefs to the task board.
- Three built-in OpenSpec schemas with paired workflow definitions: **intent**, unit, and t2d
- Two composable workflow definitions loosely coupled through the task board anti-corruption layer

## System Context

**Existing schema:** `dev.codecorral.intent@2026-03-11.0` is already defined with five artifacts:
1. `intent-brief` (requires: none) — normalizes raw idea into five-section format
2. `requirements` (requires: intent-brief) — user stories, use cases, NFRs, scope boundaries
3. `system-context` (requires: intent-brief) — C4-framed system landscape positioning
4. `units` (requires: requirements, system-context) — decomposition into independently deliverable units with per-unit briefs
5. `bolt-plan` (requires: units) — wave-based execution plan organizing units for dispatch

**State machine structure:**
```
IDLE
  → workflow.pull → PULLED
    → (invoke: createElaborationSession) → ELABORATING
      → context.loaded → ELABORATING_ARTIFACTS
        → artifact.ready("intent-brief") → CHECKING → REVIEWING
          → review.approved → next artifact
          → review.revised → ELABORATING_ARTIFACTS
        → (repeat for requirements, system-context)
        → artifact.ready("units") → CHECKING → REVIEWING
          → review.approved → ELABORATING_BOLT_PLAN
        → artifact.ready("bolt-plan") → CHECKING → REVIEWING
          → review.approved → PUBLISHING
    → PUBLISHING
      → (invoke: instructConductor to publish unit briefs to board)
      → COMPLETING → CLEANUP → COMPLETE
```

**Composition through the task board:**
```
Intent Workflow → publishes unit briefs → Task Board → Conductor polls → Unit Workflow
```

No runtime coupling. Different machines, different schemas, different schedules. The board is the interface. The conductor handles the publishing action — the engine instructs the conductor to write unit briefs to the configured board (e.g., create GitHub Issues with `unit-brief` label).

**View configs for intent phases:**
- Elaboration: agent terminal (main), change directory watcher (right)
- Review: artifact viewer (main), system-context diagram (right, browser pane if rendered)
- Publishing: status view showing published unit briefs and their board destinations

## Scope Boundaries

**In scope:**
- `intent-v1.0` XState machine definition
- Pairing with existing `dev.codecorral.intent@2026-03-11.0` schema (read artifact graph, wire preconditions)
- Precondition services: `checkArtifactExists` for each intent artifact
- Review gates between artifacts (same pattern as unit workflow)
- Board publishing via conductor instruction ("publish these unit briefs to the configured board")
- Session prompts referencing intent schema artifact instructions
- View configs for intent workflow phases
- End-to-end two-workflow composition test (intent → board → unit)

**Out of scope:**
- Modifying the existing intent schema — it's upstream and already works
- Building the task board system — the conductor handles board interaction (Unit 3)
- Unit workflow changes — composition is through the board, not runtime coupling
- T2D workflow (Unit 7) — independent workflow
