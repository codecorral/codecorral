> **Superseded.** This monolithic change has been split into 5 focused changes:
> - [mob-infrastructure](../../mob-infrastructure/proposal.md)
> - [mob-agent-team-prompting](../../mob-agent-team-prompting/proposal.md)
> - [mob-phase-inception](../../mob-phase-inception/proposal.md)
> - [mob-phase-bolt-elaboration](../../mob-phase-bolt-elaboration/proposal.md)
> - [mob-phase-construction](../../mob-phase-construction/proposal.md)

## Why

Construction-phase automation (Ralph-TUI + Claude Code) is well-understood, but inception and elaboration remain manual and sequential. A single agent session produces requirements that lack the perspective diversity of a real team. We need the full lifecycle — inception, elaboration, construction — to be consistently agentic through three distinct Ralph loops.

The AI-DLC methodology's separation of Phase 1 (inception: intent → units → bolt planning) from Phase 2 (construction bolts: per-unit detailed elaboration + implementation planning) maps cleanly to our toolchain. Mob elaboration is most valuable in Phase 1 where architectural decisions and unit boundaries are set. Phase 2 uses the existing OpenSpec proposal/design/specs flow, scoped to one unit at a time. Phase 3 is the existing construction loop.

## What Changes

- Create reusable Claude Code agent personas (`.claude/agents/`) for mob elaboration roles: Product Analyst, System Architect, Domain Modeler, QA Strategist, and Devil's Advocate
- Define a custom OpenSpec **inception schema** for Phase 1 — artifacts track intent capture, unit decomposition, and bolt planning as an auditable change
- Define a custom OpenSpec **bolt schema** for Phase 2 — replaces spec-driven schema for per-unit changes. Final artifact produces beads (via br) instead of tasks.md, directly driving the Phase 3 construction loop
- Each unit from Phase 1 becomes its own **separate OpenSpec change** (bolt schema) in Phase 2, enabling parallel bolt elaboration
- Define three Ralph-TUI loops: inception loop (mob elaboration → units), bolt elaboration loop (per-unit bolt schema), and construction loop (bead-driven coding sessions)
- Integrate with AgentDeck for human-in-the-loop interaction during mob elaboration sessions
- Provide conductor logic that routes intents to the appropriate team shape based on complexity signals

## Capabilities

### New Capabilities
- `mob-agent-personas`: Claude Code agent definition files (`.claude/agents/mob-*.md`) for the five elaboration roles, with system prompts, output format templates, and cross-review instructions
- `inception-schema`: Custom OpenSpec schema for Phase 1 — artifacts: intent-brief, requirements, system-context, units, bolt-plan. Tracks the full inception flow (intent → elaborated requirements and system boundaries → unit decomposition → bolt planning) as an auditable change with mob elaboration support
- `bolt-schema`: Custom OpenSpec schema for Phase 2 — artifacts: proposal, design, specs, beads. Replaces tasks.md with beads-rust (br) task creation as the final artifact, producing the beads that drive Phase 3 construction
- `ralph-three-loops`: Three Ralph-TUI loop definitions covering the full lifecycle — inception (one bead, mob team), bolt elaboration (one bead per unit, bolt schema), and construction (many beads per unit, bead-driven coding)
- `intent-routing`: Conductor logic that reads intent signal metadata and selects team configuration (3-agent lean mob vs 5-agent full mob) for the inception loop
- `session-orchestration`: AgentDeck session management covering pool model, phase-based organization, and TuiCR integration

  *Pool model (Phase I & II only, not construction):*
  Pre-created pool of long-lived AgentDeck sessions for inception and elaboration. The developer controls pool size (how many concurrent elaboration agents they can handle). The dispatcher sends work into idle sessions via `agent-deck session send`, which handles readiness detection and verifies processing starts. Ralph is the ideal dispatcher (it already loops over beads and dispatches), but open question: can Ralph be configured to pick up new beads automatically as they arrive? If not, the conductor fills this role using `session send`. Construction (Phase III) continues using Ralph's existing `--parallel` mode, NOT the pool model.

  *Phase-based session groups in AgentDeck:*
  Named groups/folders organize sessions by AI-DLC phase: Ideation, Elaboration, Review, Construction. The developer navigates between groups to see work by phase, providing a dashboard-like view of the overall lifecycle state.

  *TuiCR integration:*
  Dynamic TuiCR sessions are created at the end of agent runs for developer review. The developer reviews output and provides feedback via TuiCR. Feedback loops back into the next iteration or gates progression to the next phase.

### Modified Capabilities

## Impact

**Source artifacts in mob-forge:**
- `.claude/agents/` — agent persona definitions
- `openspec/schemas/inception/` — inception phase schema
- `openspec/schemas/bolt/` — bolt elaboration schema (beads as final artifact)
- `.ralph-tui/templates/` — Handlebars prompt templates for each loop
- Conductor orchestration logic

**Install targets in consuming projects (via DevEnv module):**
- Agent personas → `.claude/agents/mob-*.md`
- Schemas → `openspec/schemas/{inception,bolt}/`
- Ralph-TUI templates → `.ralph-tui/templates/`
- Conductor → project-local script or CLI wrapper

**Deliverable:** mob-forge is packaged as a **DevEnv module** — consuming projects install it to get the full mob elaboration toolchain without maintaining their own copies.

**Runtime dependencies:**
- AgentDeck session pool for mob elaboration sessions
- Each inception produces N OpenSpec changes (one per unit) in the changes directory
- Depends on: Claude Code agent teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), Ralph-TUI, AgentDeck, OpenSpec CLI, beads-rust (br)
