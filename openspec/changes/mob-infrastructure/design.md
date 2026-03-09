## Context

mob-forge uses OpenSpec for change management and Ralph-TUI for autonomous construction loops. The construction phase is well-automated — Ralph-TUI spawns Claude Code sessions that implement tasks against OpenSpec changes. However, the inception and elaboration phases remain manual single-agent work.

The AI-DLC methodology separates the lifecycle into three phases with distinct rhythms:
- **Phase 1 (Inception):** Intent → requirements + system context → unit decomposition → bolt planning. Broad, architectural, benefits from mob elaboration.
- **Phase 2 (Bolt Elaboration):** Per-unit detailed specs. Bolt-type-specific flow (simple vs DDD). Produces beads that drive Phase 3.
- **Phase 3 (Construction):** Coding against specs, one bead at a time. Existing Ralph-TUI flow.

Each phase has its own Ralph loop. Phase 2 and 3 use Ralph-TUI's standard `--print` mode. Phase 1 (inception with agent teams) requires interactive mode, handled via AgentDeck or direct `claude` invocation.

This is a greenfield repo. All artifacts (agent personas, schemas, templates, conductor) will be created by this change and its siblings.

## Goals / Non-Goals

**Goals:**
- Define conductor orchestration for bead creation, loop transitions, and completion monitoring
- Define intent signal routing mechanics (signal classification + signal-to-action mapping)
- Define AgentDeck session management: pool model, phase groups, TuiCR lifecycle
- Define loop orchestration: three distinct invocations, sequencing enforcement
- Provide Ralph base configuration

**Non-Goals:**
- Agent persona definitions (see [mob-agent-team-prompting](../mob-agent-team-prompting/design.md))
- Team configuration content (see [mob-agent-team-prompting](../mob-agent-team-prompting/design.md))
- Handlebars prompt templates (see [mob-agent-team-prompting](../mob-agent-team-prompting/design.md))
- Phase-specific schemas (see [mob-phase-inception](../mob-phase-inception/design.md), [mob-phase-bolt-elaboration](../mob-phase-bolt-elaboration/design.md))

## Decisions

### D5: One bead per loop, agent teams absorb internal phasing (pattern)

```
Loop 1: ONE bead (inception) → agent team handles internal phases
Loop 2: ONE bead PER UNIT (bolt elaboration) → single session handles phases
Loop 3: MANY beads PER UNIT (construction) → beads created by Loop 2
```

This is the structural pattern. Phase-specific details of what happens within each bead are defined in the respective phase changes.

### D6: Loop 1 uses pool model with AgentDeck sessions (mechanism)

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

**TuiCR integration:** At the end of each Ralph run or pool session completion, a TuiCR session is dynamically created in the Review group. The session presents the `REVIEW-SUMMARY.md` produced by the AI mob's review curation phase (see [mob-agent-team-prompting D12](../mob-agent-team-prompting/design.md#d12-two-phase-automatic-mob-with-verification-and-confidence-scoring)) — a focused list of items that survived automated verification but still need human judgment. The developer reviews only what was flagged, not the full artifact set. This feedback either gates progression to the next phase or feeds back into a refinement iteration.

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

### D9: Bead structure across loops (pattern)

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

### D10: Intent signal for team sizing (routing mechanism)

The human annotates the intent brief with a `signal` field. The conductor maps:
- `trivial` → skip inception, create bolt change directly
- `simple` → single Claude session with subagents (Ralph `--print` mode works)
- `moderate` → 3-agent lean mob via interactive session / AgentDeck
- `complex`/`architectural` → 5-agent full mob via interactive session / AgentDeck

The team configurations themselves (which agents, task templates, token budgets) are defined in [mob-agent-team-prompting](../mob-agent-team-prompting/design.md#d10-team-sizing).

## Risks / Trade-offs

**[Agent teams incompatible with Ralph `--print` mode]** → Loop 1 cannot use Ralph's standard agent spawn. Mitigation: Loop 1 uses interactive Claude / AgentDeck. Ralph monitors bead status for loop transition. This is actually a clean separation — inception IS interactive (human gates), construction IS autonomous.

**[Three separate Ralph invocations per intent]** → Adds orchestration overhead. Mitigation: a conductor script chains the invocations. Long-term, could become a Ralph plugin or CLI wrapper.

**[No global pause for human gates]** → Mitigation: task dependencies create structural gates. Human-review sentinel tasks block the next phase.

## Open Questions

- **Q1:** Should the conductor be a shell script, a Ralph plugin, or a Claude Code skill?
