## Unit: conductor-and-board

**Description:** Integrates the workflow engine with agent-deck's conductor subsystem. The conductor becomes the LLM bridge for the engine — handling board polling, brief evaluation, route decisions, agent auto-response, and external notification relay. `codecorral pull` delegates to the conductor rather than creating workflows directly. Board interaction is entirely the conductor's domain via LLM judgment and standard tools.

**Deliverable:** Conductor lifecycle management (`agent-deck conductor setup/teardown/status`), engine-specific CLAUDE.md and POLICY.md generation, structured instruction templates, `codecorral pull` delegation flow, awareness of agent-deck's transition notifier daemon (two feedback paths), bridge daemon config guidance. `test-v0.3` definition with a `PULLING` state that delegates to the conductor. CLI commands: `codecorral pull <brief-ref>`, `codecorral pull --next`.

**Dependencies:** session-integration

## Relevant Requirements

- Conductor as LLM bridge — retains role for judgment calls, board polling, and notification bridging, but does not track workflow state
- `codecorral pull` delegates to the conductor — conductor is the single entry point for all new workflows
- Board interaction is conductor's domain (C5) — no engine-side board adapter

## System Context

**Contracts exercised:** C5 (Task Board — via conductor, not engine), C7 (Engine ↔ Conductor lifecycle + delegation).

**The conductor is NOT a regular session.** It uses `agent-deck conductor setup/teardown/status`, not `launch/remove`. Agent-deck's conductor subsystem creates supporting infrastructure:
- Heartbeat daemon (periodic status pings)
- Bridge daemon (Telegram/Slack/Discord ↔ `session send`)
- Transition notifier daemon (child session status changes → parent notification)

**Two feedback paths:**
1. **Engine → Conductor (explicit):** `agent-deck session send "conductor-X" "evaluate this brief..."` → conductor performs LLM work → calls `workflow.transition()` via MCP
2. **Child Sessions → Conductor (automatic):** Transition notifier detects child status change → sends notification to parent conductor → conductor auto-responds per POLICY.md

**`codecorral pull` delegation:**
```
Human: codecorral pull ./brief.md
  → Engine: session send "conductor-X" "Developer wants to start workflow for brief at ./brief.md..."
  → Conductor: reads brief, evaluates suitability, calls workflow.transition("workflow.pull", {...})
  → Engine: creates workflow instance
```

**Board is conductor's domain:** The conductor polls GitHub Issues (`gh issue list`), Linear, Jira, or local filesystem using LLM judgment. Board configuration lives in the conductor's POLICY.md, not engine config. No engine-side `BoardAdapter` interface.

**Instruction templates:** Structured natural-language templates for engine → conductor communication:
- Route evaluation ("evaluate brief, decide incremental or fast-forward")
- Brief evaluation ("developer wants to start workflow, evaluate suitability")
- Pull next ("check task board for available work items matching labels")
- Notification ("review needed for workflow X, notify developer")
- Auto-response ("session X has a question, review context and respond")

**Timeout and escalation:** If no `workflow.transition()` arrives within configurable timeout after instruction: check conductor health → send reminder → fall back to human-only mode.

## Scope Boundaries

**In scope:**
- Conductor lifecycle: `agent-deck conductor setup/teardown/status` integration
- Engine-specific CLAUDE.md generation (MCP tool reference, board polling instructions, auto-response rules, escalation guidelines)
- Engine-specific POLICY.md generation (auto-response scope, notification rules)
- `codecorral pull <brief-ref>` and `codecorral pull --next` CLI commands
- Instruction template system (structured messages for engine → conductor)
- Timeout and escalation logic (health check → reminder → human fallback)
- `test-v0.3` workflow definition with conductor delegation
- Workflow sessions created as conductor children (`--parent "conductor-{name}"`)
- Understanding (not building) the transition notifier's automatic feedback path

**Out of scope:**
- Building agent-deck's conductor subsystem, heartbeat daemon, bridge daemon, or transition notifier — these are agent-deck's responsibility
- Board adapter interface — there is none; the conductor uses tools directly
- Nix flake conductor policy customization (Unit 8) — this unit ships hardcoded defaults
- View engine integration (Unit 5)
- Production workflow definitions (Units 4, 6, 7)
