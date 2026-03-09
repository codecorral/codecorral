# AgentDeck UI/UX Mockups — Infrastructure

ASCII mockups for AgentDeck orchestration infrastructure: phase dashboard, conductor dispatch, TuiCR review gates, and lifecycle flow.

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
║  │  │  proposal.md          Role-based access control for...        │   ║
║  │  │  design.md            Domain model: Role, Permission,         │   ║
║  │  │                       RoleAssignment aggregates. ADR:...      │   ║
║  │  │  specs/rbac.spec.md   12 BDD scenarios covering grant,        │   ║
║  │  │                       revoke, inheritance, conflict...        │   ║
║  │  │  Tasks.md             5 beads · dependency tree rendered      │   ║
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
| TuiCR | D7 | Dynamic review sessions at phase boundaries |
| Signal | D10 | Intent complexity annotation (trivial/simple/moderate/complex) |
| Belt-and-suspenders | D5/D6 | Dual bead-close: `br close` + `<promise>COMPLETE</promise>` |
