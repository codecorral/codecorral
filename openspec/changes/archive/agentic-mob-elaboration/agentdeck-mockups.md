# AgentDeck UI/UX Mockups

ASCII mockups for the AgentDeck experience supporting the three-loop AI-DLC lifecycle.
Covers phase-based session groups, pool model, TuiCR review gates, and conductor dispatch.

---

## 1. Phase Dashboard (Main View)

The top-level AgentDeck view. Four phase groups as panels showing session counts
and status summaries (D7). Shows an intent mid-lifecycle with sessions across
multiple phases.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgentDeck                                            ▸ Settings  ▸ Help   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Intent: user-auth-overhaul  Signal: complex  Conductor: running           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌─ Ideation ──────────────┐  ┌─ Elaboration ─────────────┐               ║
║  │  Loop 1 · Pool Model    │  │  Loop 2 · Ralph --print    │               ║
║  │                         │  │                            │               ║
║  │  Sessions: 2/3 pool     │  │  Sessions: 3 active        │               ║
║  │  ● active  1            │  │  ● active  2               │               ║
║  │  ○ idle    1            │  │  ✓ done    1               │               ║
║  │  ✓ done    1            │  │                            │               ║
║  │                         │  │  Units:                    │               ║
║  │  Working:               │  │   auth-core   ● design     │               ║
║  │   user-auth-overhaul    │  │   auth-oauth  ● proposal   │               ║
║  │   (mob: 5 agents)       │  │   auth-rbac   ✓ complete   │               ║
║  │                         │  │                            │               ║
║  └─────────────────────────┘  └────────────────────────────┘               ║
║                                                                            ║
║  ┌─ Review ────────────────┐  ┌─ Construction ─────────────┐               ║
║  │  TuiCR Gates            │  │  Loop 3 · Ralph --parallel  │               ║
║  │                         │  │                            │               ║
║  │  Sessions: 1 pending    │  │  Sessions: 4 active        │               ║
║  │  ⏳ pending 1           │  │  ● active  3               │               ║
║  │                         │  │  ■ blocked 1               │               ║
║  │  Awaiting review:       │  │                            │               ║
║  │   auth-rbac             │  │  Beads:                    │               ║
║  │   (bolt elaboration)    │  │   12 total · 4 done        │               ║
║  │                         │  │   3 active · 1 blocked     │               ║
║  │                         │  │   4 ready                  │               ║
║  └─────────────────────────┘  └────────────────────────────┘               ║
║                                                                            ║
║  [i] Ideation  [e] Elaboration  [r] Review  [c] Construction  [q] Quit     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Ideation Group — Pool Sessions

Drills into the Ideation group. Shows the pool model (D6): pre-created sessions
with idle/active status, which intent is being worked, and agent team size
(3 vs 5 per D10). Pool size is developer-controlled.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgentDeck ▸ Ideation                                    [←] Back to Dash  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Pool Model · Size: 3 sessions (developer-configured)                      ║
║  Conductor: active · Dispatch: agent-deck session send                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌─ Session pool-1 ─────────────────────────────────────────────────────┐   ║
║  │  Status: ● ACTIVE                                                   │   ║
║  │  Intent: user-auth-overhaul                                         │   ║
║  │  Signal: complex → 5-agent full mob                                 │   ║
║  │  Bead:   INCEP-7 (inception task)                                   │   ║
║  │  Phase:  requirements + system-context (parallel tracks)            │   ║
║  │                                                                     │   ║
║  │  Team:                                                              │   ║
║  │   👤 Lead           mob-lead.md          coordinating               │   ║
║  │   📋 Analyst        mob-analyst.md       ● writing requirements.md  │   ║
║  │   🏗  Architect      mob-architect.md     ● writing system-context   │   ║
║  │   🧩 Domain Modeler mob-domain-modeler.md  reviewing system-context │   ║
║  │   😈 Critic         mob-critic.md          waiting for artifacts    │   ║
║  │                                                                     │   ║
║  │  Duration: 12m 34s                             [Enter] Open session  │   ║
║  └─────────────────────────────────────────────────────────────────────┘   ║
║                                                                            ║
║  ┌─ Session pool-2 ─────────────────────────────────────────────────────┐   ║
║  │  Status: ○ IDLE                                                     │   ║
║  │  Intent: (none — awaiting dispatch)                                 │   ║
║  │  Ready for work via: session send pool-2 "<prompt>"                 │   ║
║  │                                                                     │   ║
║  │  Duration: idle 4m 12s                         [Enter] Open session  │   ║
║  └─────────────────────────────────────────────────────────────────────┘   ║
║                                                                            ║
║  ┌─ Session pool-3 ─────────────────────────────────────────────────────┐   ║
║  │  Status: ✓ DONE                                                     │   ║
║  │  Intent: payment-refactor                                           │   ║
║  │  Signal: moderate → 3-agent lean mob                                │   ║
║  │  Bead:   INCEP-5 ✓ closed                                          │   ║
║  │  Result: requirements.md ✓  system-context.md ✓  units.md ✓        │   ║
║  │          bolt-plan.md ✓  → TuiCR review pending                    │   ║
║  │                                                                     │   ║
║  │  Duration: 8m 51s (completed)                  [Enter] View output   │   ║
║  └─────────────────────────────────────────────────────────────────────┘   ║
║                                                                            ║
║  Pool controls:                                                            ║
║  [+] Add session to pool  [-] Remove idle session  [d] Dispatch intent     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Active Mob Elaboration Session

Inside one inception session. Shows the agent team roster, current phase
(requirements/system-context), inter-agent message feed, and human gate
prompt waiting for developer input (D11).

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgentDeck ▸ Ideation ▸ pool-1           Intent: user-auth-overhaul        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Bead: INCEP-7 · Phase: requirements + system-context · Signal: complex    ║
╠══════════════════════╦═══════════════════════════════════════════════════════╣
║  Agent Roster        ║  Inter-Agent Message Feed                           ║
║                      ║                                                     ║
║  👤 Lead          ●  ║  14:23:01 [Lead → Analyst]                          ║
║     coordinating     ║  Begin requirements elaboration for user-auth-      ║
║                      ║  overhaul. Read the intent-brief and produce        ║
║  📋 Analyst       ●  ║  requirements.md per inception schema.              ║
║     requirements.md  ║                                                     ║
║     ████████░░ 80%   ║  14:23:01 [Lead → Architect]                        ║
║                      ║  Begin system-context elaboration. Read intent-     ║
║  🏗  Architect     ●  ║  brief and map technical boundaries, integration   ║
║     system-context   ║  points, and domain model.                          ║
║     ██████░░░░ 60%   ║                                                     ║
║                      ║  14:25:14 [Analyst → Lead]                          ║
║  🧩 Domain M.    ●  ║  Question for developer: The intent mentions        ║
║     reviewing arch   ║  "SSO support" — does this include SAML or         ║
║                      ║  only OIDC providers?                               ║
║  😈 Critic       ○  ║                                                     ║
║     waiting          ║  14:26:30 [Architect → Domain Modeler]              ║
║                      ║  Review my bounded context boundaries for the       ║
║                      ║  auth domain. I've separated session management     ║
║                      ║  from identity providers.                           ║
║                      ║                                                     ║
║                      ║  14:27:45 [Domain Modeler → Architect]              ║
║                      ║  Looks good. Consider: should token refresh be      ║
║                      ║  in session-mgmt or a separate context?             ║
╠══════════════════════╩═══════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌─ HUMAN GATE ── Analyst needs clarification ───────────────────────────┐  ║
║  │                                                                       │  ║
║  │  The Analyst is pausing requirements elaboration to ask:              │  ║
║  │                                                                       │  ║
║  │  "The intent mentions SSO support — does this include SAML            │  ║
║  │   or only OIDC providers?"                                            │  ║
║  │                                                                       │  ║
║  │  ▸ Type your response: _                                              │  ║
║  │                                                                       │  ║
║  │  [Enter] Send response  [s] Skip (agent proceeds with best guess)     │  ║
║  └───────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Conductor Dispatch

Shows the conductor dispatching work into a pool session via `session send` (D6).
Visualizes: bead created → idle session selected → work dispatched → session
becomes active.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgentDeck ▸ Conductor Log                                                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Conductor: active · Monitoring: br show --epic inception                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌─ Dispatch: cache-layer-redesign ─────────────────────────────────────┐  ║
║  │                                                                      │  ║
║  │  Step 1: Bead Created                                    14:30:01    │  ║
║  │  ─────────────────────────────────────────────────────────────────── │  ║
║  │  $ br create --type=epic --title="Inception: cache-layer-redesign"   │  ║
║  │  → EPIC-12 created                                                   │  ║
║  │  $ br create --type=task --parent=EPIC-12 \                          │  ║
║  │      --title="cache-layer-redesign" --label="inception"              │  ║
║  │  → INCEP-9 created                                                   │  ║
║  │                                                                      │  ║
║  │  Step 2: Pool Session Selected                           14:30:02    │  ║
║  │  ─────────────────────────────────────────────────────────────────── │  ║
║  │  Pool status:                                                        │  ║
║  │    pool-1  ● active (user-auth-overhaul)                             │  ║
║  │    pool-2  ○ idle   ◄── selected                                     │  ║
║  │    pool-3  ✓ done   (payment-refactor)                               │  ║
║  │                                                                      │  ║
║  │  Step 3: Work Dispatched                                 14:30:03    │  ║
║  │  ─────────────────────────────────────────────────────────────────── │  ║
║  │  $ agent-deck session send pool-2 \                                  │  ║
║  │      "Inception elaboration for cache-layer-redesign.                │  ║
║  │       Signal: moderate. Team: 3-agent lean mob.                      │  ║
║  │       Bead: INCEP-9. Schema: inception."                             │  ║
║  │  → Readiness detected: pool-2 agent available                        │  ║
║  │  → Processing started: confirmed                                     │  ║
║  │                                                                      │  ║
║  │  Step 4: Session Active                                  14:30:04    │  ║
║  │  ─────────────────────────────────────────────────────────────────── │  ║
║  │  pool-2: ○ idle → ● active                                          │  ║
║  │  Intent: cache-layer-redesign                                        │  ║
║  │  Team: Analyst, Architect, Critic (lean mob)                         │  ║
║  │                                                                      │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  ┌─ Dispatch Timeline ──────────────────────────────────────────────────┐  ║
║  │                                                                      │  ║
║  │  14:20  payment-refactor    → pool-3  ✓ complete → TuiCR created    │  ║
║  │  14:22  user-auth-overhaul  → pool-1  ● in progress                 │  ║
║  │  14:30  cache-layer-redesign→ pool-2  ● dispatched                  │  ║
║  │                                                                      │  ║
║  │  Pending intents: (none)                                             │  ║
║  │  Pool utilization: 2/3 active · 0 idle · 1 done                     │  ║
║  │                                                                      │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  [r] Refresh  [p] Pool settings  [←] Back to Dash                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 5. Elaboration Group — Ralph Sessions

Bolt elaboration sessions driven by Ralph (D3, D8). Per-unit sessions showing
which bolt schema phase each is on (proposal → design → specs → beads). Shows
the team orchestration prompt in action — which agent owns which artifact.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgentDeck ▸ Elaboration                                 [←] Back to Dash  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Loop 2 · Ralph --print · Epic: bolt-user-auth-overhaul                    ║
║  Source: inception units.md → 3 units                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌─ auth-core (DDD bolt) ───────────────────────────────────────────────┐  ║
║  │  Bead: BOLT-14 · Status: ● active · Phase: design                   │  ║
║  │                                                                      │  ║
║  │  Bolt Phases:     ✓ proposal → ● design → ○ specs → ○ beads         │  ║
║  │                                                                      │  ║
║  │  Team Orchestration (bolt-elaboration.hbs):                          │  ║
║  │  ┌──────────────────┬───────────────┬──────────────────────────────┐ │  ║
║  │  │ Role             │ Artifact      │ Status                       │ │  ║
║  │  ├──────────────────┼───────────────┼──────────────────────────────┤ │  ║
║  │  │ Product Analyst  │ proposal.md   │ ✓ complete                   │ │  ║
║  │  │ System Architect │ design.md     │ ● writing (domain model)     │ │  ║
║  │  │ Domain Modeler   │ design.md     │ ● assisting (aggregates)     │ │  ║
║  │  │ QA Strategist    │ specs/        │ ○ waiting on design          │ │  ║
║  │  │ Devil's Advocate │ (all)         │ ● reviewing proposal.md      │ │  ║
║  │  └──────────────────┴───────────────┴──────────────────────────────┘ │  ║
║  │                                                                      │  ║
║  │  Change: openspec/changes/user-auth-overhaul-auth-core/              │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  ┌─ auth-oauth (simple bolt) ───────────────────────────────────────────┐  ║
║  │  Bead: BOLT-15 · Status: ● active · Phase: proposal                 │  ║
║  │                                                                      │  ║
║  │  Bolt Phases:     ● proposal → ░ design (skip) → ○ specs → ○ beads  │  ║
║  │                                                                      │  ║
║  │  Team Orchestration:                                                 │  ║
║  │   Product Analyst  ● writing proposal.md                             │  ║
║  │   QA Strategist    ○ waiting                                         │  ║
║  │   Devil's Advocate ○ waiting                                         │  ║
║  │   (no Architect/Domain Modeler — simple bolt, design skipped)        │  ║
║  │                                                                      │  ║
║  │  Change: openspec/changes/user-auth-overhaul-auth-oauth/             │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  ┌─ auth-rbac (DDD bolt) ───────────────────────────────────────────────┐  ║
║  │  Bead: BOLT-16 · Status: ✓ complete · All phases done               │  ║
║  │                                                                      │  ║
║  │  Bolt Phases:     ✓ proposal → ✓ design → ✓ specs → ✓ beads         │  ║
║  │                                                                      │  ║
║  │  Output: 5 beads created → EPIC-20 (construction ready)             │  ║
║  │  Tasks.md: bead hierarchy + EPIK pull instructions generated         │  ║
║  │  → TuiCR review session created in Review group                     │  ║
║  │                                                                      │  ║
║  │  Change: openspec/changes/user-auth-overhaul-auth-rbac/              │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 6. Review Group — TuiCR Sessions

TuiCR sessions created dynamically at phase boundaries (D11). Shows: the
artifacts being reviewed, developer feedback input, and the gate decision
(approve → next phase, or reject → re-iterate).

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgentDeck ▸ Review                                      [←] Back to Dash  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  TuiCR Review Gates · Phase boundary reviews                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌─ TuiCR: auth-rbac (bolt elaboration → construction) ── ⏳ PENDING ──┐  ║
║  │                                                                      │  ║
║  │  Source: Loop 2 completion · Bead: BOLT-16 ✓                         │  ║
║  │  Gate: Approve bolt elaboration → unlock Loop 3 construction         │  ║
║  │                                                                      │  ║
║  │  Artifacts for Review:                                               │  ║
║  │  ┌───────────────────────────────────────────────────────────────┐   │  ║
║  │  │  openspec/changes/user-auth-overhaul-auth-rbac/               │   ║
║  │  │                                                               │   ║
║  │  │  📄 proposal.md          Role-based access control for...     │   ║
║  │  │  📄 design.md            Domain model: Role, Permission,      │   ║
║  │  │                          RoleAssignment aggregates. ADR:...   │   ║
║  │  │  📄 specs/rbac.spec.md   12 BDD scenarios covering grant,     │   ║
║  │  │                          revoke, inheritance, conflict...     │   ║
║  │  │  📄 Tasks.md             5 beads · dependency tree rendered   │   ║
║  │  │                                                               │   ║
║  │  │  [1] View proposal  [2] View design  [3] View specs           │   ║
║  │  │  [4] View Tasks.md  [5] View full diff                        │   ║
║  │  └───────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                      │  ║
║  │  Developer Feedback:                                                 │  ║
║  │  ┌───────────────────────────────────────────────────────────────┐   │  ║
║  │  │  ▸ _                                                          │   ║
║  │  │                                                               │   ║
║  │  └───────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                      │  ║
║  │  Decision:                                                           │  ║
║  │  [a] Approve → proceed to construction (Loop 3)                     │  ║
║  │  [r] Reject  → re-iterate bolt elaboration with feedback            │  ║
║  │  [p] Partial → approve with inline comments (re-iterate subset)     │  ║
║  │                                                                      │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  ┌─ TuiCR: payment-refactor (inception → elaboration) ── ✓ APPROVED ──┐  ║
║  │                                                                      │  ║
║  │  Source: Loop 1 completion · Bead: INCEP-5 ✓                         │  ║
║  │  Gate: Approve inception → unlock Loop 2 bolt elaboration            │  ║
║  │  Reviewed: requirements.md, system-context.md, units.md, bolt-plan   │  ║
║  │  Feedback: "LGTM. Proceed with 2 units as planned."                 │  ║
║  │  Decision: ✓ Approved at 14:18                                      │  ║
║  │  → Loop 2 triggered: bolt-payment-refactor epic created             │  ║
║  │                                                                      │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  History: 3 reviews total · 2 approved · 0 rejected · 1 pending           ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 7. Construction Group — Parallel Beads

Ralph `--parallel` mode (D8, Loop 3). Multiple bead sessions running concurrently
in worktrees. Shows bead IDs, progress, dependencies (blocked/ready/complete).

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgentDeck ▸ Construction                                [←] Back to Dash  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Loop 3 · Ralph --parallel 3 · Epic: construction-user-auth-auth-rbac      ║
║  Worktrees: 3 active · Source: EPIC-20 (5 beads)                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Bead Dependency Graph:                                                    ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                      │  ║
║  │   TASK-41 ──────► TASK-43 ──────► TASK-45                            │  ║
║  │   Role model       Role API        Role UI                           │  ║
║  │   ✓ complete       ● active        ○ ready                           │  ║
║  │                                                                      │  ║
║  │   TASK-42 ──────► TASK-44                                            │  ║
║  │   Permission svc   RBAC middleware                                   │  ║
║  │   ● active         ■ blocked (by 42)                                 │  ║
║  │                                                                      │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  Active Sessions (parallel worktrees):                                     ║
║                                                                            ║
║  ┌─ Worktree 1 ─────────────────────────────────────────────────────────┐  ║
║  │  Bead: TASK-43 · Role API endpoints                                  │  ║
║  │  Branch: wt/construction-auth-rbac-task-43                           │  ║
║  │  Template: construction.hbs                                          │  ║
║  │  Status: ● implementing (tests passing: 4/7)                         │  ║
║  │  Depends on: TASK-41 ✓                                               │  ║
║  │  Duration: 6m 22s                                                    │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  ┌─ Worktree 2 ─────────────────────────────────────────────────────────┐  ║
║  │  Bead: TASK-42 · Permission service                                  │  ║
║  │  Branch: wt/construction-auth-rbac-task-42                           │  ║
║  │  Template: construction.hbs                                          │  ║
║  │  Status: ● implementing (tests passing: 2/5)                         │  ║
║  │  Depends on: (none)                                                  │  ║
║  │  Blocks: TASK-44                                                     │  ║
║  │  Duration: 8m 10s                                                    │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  ┌─ Worktree 3 ─────────────────────────────────────────────────────────┐  ║
║  │  Bead: TASK-41 · Role domain model  ✓ COMPLETE                       │  ║
║  │  Branch: wt/construction-auth-rbac-task-41 (merged)                  │  ║
║  │  Result: br close TASK-41 ✓ · <promise>COMPLETE</promise>            │  ║
║  │  Duration: 5m 03s · Freed for next ready bead                        │  ║
║  │  → Next: TASK-45 (Role UI) now ready, queued for dispatch            │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  Summary: 5 beads · 1 complete · 2 active · 1 ready · 1 blocked           ║
║  [Enter] Open session  [g] Dependency graph  [l] Ralph log                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 8. Lifecycle Flow — Intent Journey

A timeline/flow view showing one intent traversing all four phases. Ties the
other mockups together — shows where human gates sit, where TuiCR reviews
happen, and how sessions move between groups.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgentDeck ▸ Lifecycle Flow                              [←] Back to Dash  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Intent: user-auth-overhaul · Signal: complex                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  LOOP 1: INCEPTION                                                         ║
║  ═══════════════════════════════════════════════════════                    ║
║                                                                            ║
║  Conductor                   Ideation Pool                                 ║
║  ┌────────────┐              ┌──────────────────────────────┐              ║
║  │ br create  │──dispatch──▸ │ pool-1: 5-agent full mob     │              ║
║  │ INCEP-7    │  session     │                              │              ║
║  │            │  send        │ ┌──────────┐ ┌────────────┐  │              ║
║  └────────────┘              │ │Analyst   │ │Architect   │  │              ║
║                              │ │ require- │ │ system-    │  │              ║
║                              │ │ ments.md │ │ context.md │  │              ║
║                              │ └────┬─────┘ └─────┬──────┘  │              ║
║                              │      │  parallel    │         │              ║
║                              │      ▼  tracks      ▼         │              ║
║                              │   ┌──────────────────────┐    │              ║
║                              │   │  HUMAN GATE          │    │              ║
║                              │   │  Developer reviews    │◄── you are here ║
║                              │   └──────────┬───────────┘    │              ║
║                              │              ▼                │              ║
║                              │   ┌──────────────────────┐    │              ║
║                              │   │ units.md + bolt-plan │    │              ║
║                              │   └──────────┬───────────┘    │              ║
║                              │              ▼                │              ║
║                              │   br close INCEP-7            │              ║
║                              └──────────────┬───────────────┘              ║
║                                             ▼                              ║
║  ┌─ Review ─────────────────────────────────────────────────────────────┐  ║
║  │  TuiCR: inception review                                             │  ║
║  │  Artifacts: requirements, system-context, units, bolt-plan           │  ║
║  │  Decision: [approve] → Loop 2  ·  [reject] → re-iterate Loop 1      │  ║
║  └──────────────────────────────────────────┬────────────────────────────┘  ║
║                                             ▼                              ║
║  LOOP 2: BOLT ELABORATION                                                  ║
║  ═══════════════════════════════════════════════════════                    ║
║                                                                            ║
║  Conductor creates 1 change per unit (D4):                                 ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │  user-auth-overhaul-auth-core/   (DDD bolt, ralph --print)           │  ║
║  │    proposal → design → specs → beads ──► EPIC-20 (5 beads)          │  ║
║  │                                                                      │  ║
║  │  user-auth-overhaul-auth-oauth/  (simple bolt, ralph --print)        │  ║
║  │    proposal → specs → beads ──────────► EPIC-21 (3 beads)           │  ║
║  │                                                                      │  ║
║  │  user-auth-overhaul-auth-rbac/   (DDD bolt, ralph --print)           │  ║
║  │    proposal → design → specs → beads ──► EPIC-22 (5 beads)          │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║       │              │              │                                       ║
║       ▼              ▼              ▼                                       ║
║  ┌─ Review ─────────────────────────────────────────────────────────────┐  ║
║  │  TuiCR: per-unit bolt review (one session per completed unit)        │  ║
║  │  Decision: [approve] → beads unlock for Loop 3                       │  ║
║  └──────────────────────────────────────────┬────────────────────────────┘  ║
║                                             ▼                              ║
║  LOOP 3: CONSTRUCTION                                                      ║
║  ═══════════════════════════════════════════════════════                    ║
║                                                                            ║
║  Ralph --parallel per unit:                                                ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                      │  ║
║  │  EPIC-20 (auth-core)     EPIC-21 (auth-oauth)  EPIC-22 (auth-rbac)  │  ║
║  │  ┌──┐ ┌──┐ ┌──┐ ...    ┌──┐ ┌──┐ ┌──┐        ┌──┐ ┌──┐ ┌──┐ ...  │  ║
║  │  │✓ │ │● │ │○ │        │● │ │○ │ │○ │        │✓ │ │● │ │■ │      │  ║
║  │  └──┘ └──┘ └──┘        └──┘ └──┘ └──┘        └──┘ └──┘ └──┘      │  ║
║  │  5 beads · worktrees    3 beads · worktrees    5 beads · worktrees  │  ║
║  │                                                                      │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║  Legend: ✓ complete  ● active  ○ ready  ■ blocked  ⏳ review pending       ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Terminology Reference

| Term | Source | Meaning |
|------|--------|---------|
| Pool model | D6 | Pre-created long-lived AgentDeck sessions for inception |
| Phase groups | D7 | Ideation, Elaboration, Review, Construction |
| Session send | D6 | `agent-deck session send <id> "<prompt>"` dispatches work |
| Sentinel tasks | D11 | Beads with `--label="human-gate"` that block downstream |
| TuiCR | D11 | Dynamic review sessions at phase boundaries |
| Signal | D10 | Intent complexity annotation (trivial/simple/moderate/complex) |
| Lean mob | D10 | 3-agent team (Analyst, Architect, Critic) |
| Full mob | D10 | 5-agent team (+ Domain Modeler, QA Strategist) |
| Belt-and-suspenders | D5/D6 | Dual bead-close: `br close` + `<promise>COMPLETE</promise>` |
| Bolt schema | D3 | Per-unit change: proposal → design → specs → beads |
| Inception schema | D2 | Intent change: intent-brief → requirements → system-context → units → bolt-plan |
