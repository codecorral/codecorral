## Context

mob-forge uses OpenSpec for change management and Ralph-TUI for autonomous construction loops. The construction phase is well-automated — Ralph-TUI spawns Claude Code sessions that implement tasks against OpenSpec changes. However, the inception and elaboration phases remain manual single-agent work.

The AI-DLC methodology separates the lifecycle into three phases with distinct rhythms:
- **Phase 1 (Inception):** Intent → requirements + system context → unit decomposition → bolt planning. Broad, architectural, benefits from mob elaboration.
- **Phase 2 (Bolt Elaboration):** Per-unit detailed specs. Bolt-type-specific flow (simple vs DDD). Produces beads that drive Phase 3.
- **Phase 3 (Construction):** Coding against specs, one bead at a time. Existing Ralph-TUI flow.

Each phase has its own Ralph loop. Phase 2 and 3 use Ralph-TUI's standard `--print` mode. Phase 1 (inception with agent teams) requires interactive mode, handled via AgentDeck or direct `claude` invocation.

This is a greenfield repo. All artifacts (agent personas, schemas, templates, conductor) will be created by this change.

## Goals / Non-Goals

**Goals:**
- Define reusable agent personas for mob elaboration roles
- Create custom OpenSpec **inception** and **bolt** schemas
- Design concrete Ralph-TUI configurations and Handlebars prompt templates for each loop
- Phase 2 produces **one separate OpenSpec change per unit** (bolt schema) with beads as final artifact
- Build three Ralph-TUI loops: inception (one bead, mob team), bolt elaboration (one bead per unit), construction (many beads per unit)
- Bridge agent team sessions to AgentDeck for Phase 1 interaction
- All artifacts are installable as a **DevEnv module** into consuming projects — mob-forge is the source, consuming projects install the personas, schemas, templates, and conductor via DevEnv

**Non-Goals:**
- Modifying Ralph-TUI's core agent spawn mechanism
- Real-time conversational debate between agents
- Automated intent signal detection
- Multiple beads per loop for internal phasing

## Decisions

### D1: Agent personas as `.claude/agents/*.md` files

Define each mob role as a Claude Code custom agent file. The `agentType` and `model` fields propagate to teammates as of v2.1.47+. Tool restrictions and hooks do NOT propagate yet, so personas rely on system prompt shaping.

**Alternative considered:** Inline prompts in the team lead's spawn message. Rejected — not version-controlled, can't be reused, drift over time.

### D2: Inception schema for Phase 1

Create `openspec/schemas/inception/` with 5 artifact types:

```
intent-brief
  ├── requirements    (mob: Analyst + Critic)
  ├── system-context  (mob: Architect + Domain Modeler)
  │
  └── units           (depends on requirements + system-context)
       └── bolt-plan  (depends on units)
```

The `requirements` and `system-context` artifacts are produced in parallel during mob elaboration. The `units` artifact depends on both.

### D3: Bolt schema for Phase 2 with beads as final artifact

Create `openspec/schemas/bolt/` with 4 artifact types:

```
proposal
  ├── design  (optional for simple bolts)
  ├── specs
  │
  └── beads   (depends on design + specs, created via br)
```

The `beads` artifact creates construction tasks via `br` AND generates a `Tasks.md` containing:
- A text-tree rendering of the bead hierarchy (epic → child beads with dependencies)
- EPIK pull instructions for each bead (how to pull context from the bolt change's specs into the construction session)

Each bead becomes a construction task for Loop 3. `Tasks.md` provides a human-readable index of what was created and how to consume it.

### D4: Separate OpenSpec change per unit in Phase 2

After Phase 1, each unit becomes its own OpenSpec change using the bolt schema: `openspec/changes/<intent>-<unit-name>/`.

### D5: One bead per loop, agent teams absorb internal phasing

```
Loop 1: ONE bead (inception) → agent team handles internal phases
Loop 2: ONE bead PER UNIT (bolt elaboration) → single session handles phases
Loop 3: MANY beads PER UNIT (construction) → beads created by Loop 2
```

### D6: Loop 1 uses pool model with AgentDeck sessions

**Critical constraint:** Ralph-TUI spawns Claude with `--print --dangerously-skip-permissions` (non-interactive, single prompt, exits after response). Agent teams require a persistent interactive session where the lead stays alive to coordinate teammates.

**Resolution:** Loop 1 (inception) uses the pool model — pre-created long-lived AgentDeck sessions that persist across work items.

**Pool model flow:**
1. **Pool setup:** The conductor pre-creates AgentDeck sessions for inception work. Pool size is developer-controlled (e.g., 1-3 concurrent inception sessions).
2. **Bead creation:** The conductor creates an inception bead via `br` for each incoming intent.
3. **Dispatch:** The conductor dispatches the inception task into an available pool session via `agent-deck session send <session-id> "<inception prompt>"`. `session send` handles readiness detection — it waits for the agent to be available before sending and verifies processing starts.
4. **Mob elaboration:** The pool session (running Claude with agent teams) handles the interactive mob elaboration. The team lead coordinates teammates through inter-agent messaging.
5. **Bead close (belt-and-suspenders):** The lead agent closes the inception bead via `br close` when elaboration completes. The Ralph-TUI engine also detects `<promise>COMPLETE</promise>` and closes the bead. `br close` is idempotent so the duplicate is harmless.
6. **Completion detection:** The conductor monitors bead status (polling `br show`) to detect completion and trigger the Loop 2 transition.

For Loops 2 and 3, Ralph's standard `--print` mode works perfectly — these are single-agent sessions that process a prompt and exit. Construction (Loop 3) uses Ralph's existing `--parallel` mode, NOT the pool model.

**Alternative considered:** Custom Ralph command wrapper that launches Claude interactively. Rejected — fighting Ralph's architecture. Ralph is designed for autonomous single-prompt sessions. Inception is inherently interactive (human gates between phases). Let each tool do what it's good at.

**Alternative considered:** Using subagents (Agent tool) instead of agent teams for Loop 1. This works within `--print` mode since subagents report back to the calling session. However, it loses inter-agent messaging (the cross-review benefit). Keep as a fallback option for simpler intents (signal: `simple` or `moderate`) where a single session with subagents is sufficient.

**Open question:** Can Ralph be configured to pick up new beads automatically as they arrive? If so, Ralph becomes the dispatcher for the pool model. If not, the conductor fills this role using `agent-deck session send`.

### D7: AgentDeck session organization by AI-DLC phase

Sessions in AgentDeck are organized into named phase groups so the developer sees a dashboard-like view of work by lifecycle phase:

| Group | Contents | Source |
|---|---|---|
| **Ideation** | Inception pool sessions (mob elaboration) | Conductor creates for pool model |
| **Elaboration** | Bolt elaboration sessions (per-unit) | Ralph `run` for Loop 2 |
| **Review** | TuiCR review sessions | Created dynamically at phase boundaries |
| **Construction** | Bead-driven coding sessions | Ralph `run --parallel` for Loop 3 |

When the conductor creates sessions for the inception pool or launches Ralph for an epic, it places the resulting sessions into the appropriate phase group. The developer navigates between groups to understand lifecycle state at a glance.

**TuiCR integration:** At the end of each Ralph run or pool session completion, a TuiCR session is dynamically created in the Review group. The developer reviews the agent's output and provides feedback. This feedback either gates progression to the next phase or feeds back into a refinement iteration.

**Ralph session management:** When the conductor launches Ralph for an epic (Loop 2 or 3), the resulting session(s) go into the appropriate phase group. The conductor tears down sessions when the epic's beads are all closed.

**Ralph-TUI configuration per loop:**

Ralph is loop-agnostic — differentiation comes from **epic scoping**, **prompt templates**, and **CLI flags**. Each loop is a separate Ralph invocation:

```toml
# .ralph-tui/config.toml (shared base)
configVersion = "2.1"
tracker = "beads-rust"
agent = "claude"
autoCommit = true

[trackerOptions]
[agentOptions]
```

**Loop 2 (Bolt Elaboration) invocation:**
```bash
ralph-tui run \
  --epic "bolt-{intent-name}" \
  --prompt .ralph-tui/templates/bolt-elaboration.hbs \
  --iterations 10
```

**Loop 3 (Construction) invocation:**
```bash
ralph-tui run \
  --epic "construction-{intent-name}-{unit-name}" \
  --prompt .ralph-tui/templates/construction.hbs \
  --iterations 20 \
  --parallel 3
```

Loop 3 uses parallel mode with worktrees for independent beads.

### D8: Handlebars prompt templates per loop

Three custom templates in `.ralph-tui/templates/`:

**`inception-monitor.hbs`** (used only if Ralph monitors inception status):
```
Minimal — just checks bead status and signals completion.
```

**`bolt-elaboration.hbs`** (Loop 2 — team orchestration prompt for per-unit spec elaboration):

This template is the **team orchestration prompt** — it designs and instructs the agent team, assigning roles, sequencing work, and wiring dependencies between team members.

```handlebars
# Bolt Elaboration: {{taskTitle}}

## Context
You are the lead agent for elaborating unit "{{taskTitle}}" as part of intent "{{epicTitle}}".

## Unit Definition
{{taskDescription}}

## Team

You will coordinate the following agent team. Reference their persona files for full role definitions:

- **Product Analyst** (`.claude/agents/mob-analyst.md`) — Owns the proposal. Analyzes intent, user impact, and acceptance criteria.
- **System Architect** (`.claude/agents/mob-architect.md`) — Owns the design. Defines technical architecture, component boundaries, and integration patterns.
{{#if (eq labels "ddd")}}
- **Domain Modeler** (`.claude/agents/mob-domain-modeler.md`) — Assists on design. Models entities, aggregates, and bounded contexts.
{{/if}}
- **QA Strategist** (`.claude/agents/mob-qa-strategist.md`) — Owns specs. Writes BDD scenarios and acceptance criteria.
- **Devil's Advocate** (`.claude/agents/mob-critic.md`) — Cross-reviews all artifacts. Challenges assumptions, identifies gaps.

## Task Sequence

### Phase 1: Proposal (Analyst leads)
1. Analyst reads the inception change's `requirements.md` and `system-context.md` for context
2. Analyst creates `proposal.md` scoped to this unit — what changes and why
3. Critic reviews proposal for gaps, missing edge cases, or scope creep

### Phase 2: Design (Architect leads)
_Depends on: Phase 1 complete_
{{#if (eq labels "ddd")}}
4. Architect + Domain Modeler create `design.md` — domain model (entities, aggregates, bounded contexts), ADRs, and technical architecture
{{else}}
4. Skip design.md (simple bolt — proceed directly to Phase 3)
{{/if}}
5. Critic reviews design for feasibility and consistency with proposal

### Phase 3: Specs (QA Strategist leads)
_Depends on: Phase 2 complete (or Phase 1 if design skipped)_
6. QA Strategist creates specs with BDD Given/When/Then scenarios derived from proposal and design
7. Critic reviews specs for coverage gaps

### Phase 4: Beads (Lead agent)
_Depends on: Phase 3 complete_
8. Create bolt schema change:
   ```bash
   openspec new change "{{epicId}}-{{taskId}}" --schema bolt
   ```
9. Create beads via `br`:
   ```bash
   br create --type=epic --title="{{epicTitle}} / {{taskTitle}}" \
     --external-ref="openspec:openspec/changes/{{epicId}}-{{taskId}}/specs"
   ```
   Create child beads for each implementable task with dependencies.
10. Generate `Tasks.md` with bead hierarchy tree and EPIK pull instructions.

### Phase 5: Close
11. Close this bead when all bolt artifacts are complete:
    ```bash
    br close {{taskId}} --reason "Bolt elaboration complete. Beads created for construction."
    br sync --flush-only
    ```
12. Document progress — append to `.ralph-tui/progress.md`:
    - Unit name and bolt type
    - Number of beads created
    - Key design decisions made
    - Any open concerns for construction

<promise>COMPLETE</promise>
```

> **Bead close — belt-and-suspenders:** The bead is closed by two mechanisms: (1) the agent executes `br close` explicitly in step 11, and (2) the Ralph-TUI engine detects `<promise>COMPLETE</promise>` and closes the bead automatically. Both paths converge — `br close` is idempotent, so the duplicate close is harmless. This ensures the bead closes even if one mechanism fails.

**`construction.hbs`** (Loop 3 — bead-driven coding):
```handlebars
# Construction: {{taskTitle}}

## Bead
- **ID:** {{taskId}}
- **Epic:** {{epicTitle}}
- **Priority:** {{priority}}
{{#if dependsOn}}- **Depends on:** {{dependsOn}}{{/if}}
{{#if blocks}}- **Blocks:** {{blocks}}{{/if}}

## Task Description
{{taskDescription}}

{{#if acceptanceCriteria}}
## Acceptance Criteria
{{acceptanceCriteria}}
{{/if}}

{{#if prdContent}}
## Spec Context
{{prdContent}}
{{/if}}

{{#if recentProgress}}
## Recent Progress
{{recentProgress}}
{{/if}}

## Workflow

1. **Review specs:** Read the bolt change's spec files referenced in the epic's external-ref for BDD scenarios this bead must satisfy.

2. **Review codebase:** Understand existing code patterns before implementing.

3. **Implement:** Write production-ready code following project conventions (see CLAUDE.md).

4. **Test:** Verify acceptance criteria. Run relevant tests.

5. **Close bead:**
   ```bash
   br close {{taskId}} --reason "Implementation complete. All acceptance criteria satisfied."
   br sync --flush-only
   ```

6. **Document:**
   Append to `.ralph-tui/progress.md`:
   - What was implemented
   - Key patterns or decisions
   - Any issues for dependent beads

<promise>COMPLETE</promise>
```

### D9: Bead structure across loops

**Loop 1 beads (created by conductor):**
```bash
# One epic, one bead
br create --type=epic --title="Inception: {intent-name}" \
  --description="Phase 1 inception for {intent}"
br create --type=task --parent=EPIC-ID \
  --title="{intent-name}" \
  --description="$(cat inception-brief.md)" \
  --label="inception"
```

**Loop 2 beads (created by conductor from units.md):**
```bash
# One epic, N beads (one per unit)
br create --type=epic --title="Bolt: {intent-name}"
for unit in units; do
  br create --type=task --parent=EPIC-ID \
    --title="{unit-name}" \
    --description="$(cat unit-definition.md)" \
    --label="{bolt-type}" \
    --priority={from-bolt-plan}
done
# Wire dependencies between units per bolt-plan
br dep add UNIT-B UNIT-A  # if unit B depends on unit A
```

**Loop 3 beads (created by Loop 2's beads artifact):**
```bash
# One epic per unit, M beads per epic
br create --type=epic --title="{intent-name} / {unit-name}" \
  --external-ref="openspec:openspec/changes/{intent}-{unit}/specs"
for task in spec-derived-tasks; do
  br create --type=task --parent=EPIC-ID \
    --title="{task-title}" \
    --description="{task-description with spec references}" \
    --priority={priority}
done
# Wire dependencies between construction tasks
br dep add TASK-B TASK-A
```

### D10: Intent signal for team sizing

The human annotates the intent brief with a `signal` field. The conductor maps:
- `trivial` → skip inception, create bolt change directly
- `simple` → single Claude session with subagents (Ralph `--print` mode works)
- `moderate` → 3-agent lean mob via interactive session / AgentDeck
- `complex`/`architectural` → 5-agent full mob via interactive session / AgentDeck

### D11: Mob elaboration produces requirements AND system context in Phase 1

Two parallel tracks:
- **Requirements track:** Analyst (lead) + Critic (review) → `requirements.md`
- **System context track:** Architect (lead) + Domain Modeler (review) → `system-context.md`

In lean mob (3 agents): Analyst → requirements, Architect → system context, Critic reviews both.

**Human gates:**

A human review gate sits between the parallel tracks (requirements + system-context) and unit decomposition. The developer reviews both artifacts before the mob proceeds to break the intent into units. Gate mechanisms:
- **Sentinel tasks:** A bead with `--label="human-gate"` blocks downstream beads until the developer closes it after review
- **AgentDeck interaction prompts:** The lead agent pauses and surfaces a review request in the AgentDeck session

**Information-gathering pause:** The Analyst agent may pause during requirements elaboration to request user clarification on ambiguous intent. It surfaces questions via inter-agent messaging (shared with the team) and through AgentDeck interaction prompts to the developer.

**Post-run review via TuiCR:** At the end of mob elaboration runs, a dynamic TuiCR session is created for the developer to review the inception output (requirements, system-context, units, bolt-plan) and provide feedback. This feedback either gates progression to Loop 2 or feeds back into a refinement iteration of Loop 1.

## Risks / Trade-offs

**[Agent teams incompatible with Ralph `--print` mode]** → Loop 1 cannot use Ralph's standard agent spawn. Mitigation: Loop 1 uses interactive Claude / AgentDeck. Ralph monitors bead status for loop transition. This is actually a clean separation — inception IS interactive (human gates), construction IS autonomous.

**[Agent teams is experimental]** → Feature may change. Mitigation: agent personas work as standalone agents and subagents too.

**[No global pause for human gates]** → Mitigation: task dependencies create structural gates. Human-review sentinel tasks block the next phase.

**[Separate changes per unit adds management overhead]** → Mitigation: inception change's `units.md` serves as index.

**[Token cost for mob elaboration]** → 5-agent team uses ~5x tokens. Mitigation: intent signals route most work to 3-agent or solo.

**[Two new schemas]** → Mitigation: bolt schema is structurally similar to spec-driven. Start with inception schema, add bolt once validated.

**[Beads as OpenSpec artifact is novel]** → The beads artifact runs `br` commands rather than producing Markdown. Mitigation: artifact instructions describe the br commands, output is bead IDs.

**[Three separate Ralph invocations per intent]** → Adds orchestration overhead. Mitigation: a conductor script chains the invocations. Long-term, could become a Ralph plugin or CLI wrapper.

## Open Questions

- **Q1:** Should the conductor be a shell script, a Ralph plugin, or a Claude Code skill?
- **Q2:** When running bolt elaboration in parallel for multiple units, should there be a coordination mechanism to avoid architectural drift?
- **Q3:** Should Loop 1 for `simple` signals use subagents (within Ralph `--print` mode) rather than agent teams, avoiding the interactive mode requirement entirely?
