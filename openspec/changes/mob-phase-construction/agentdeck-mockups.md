# AgentDeck UI/UX Mockups — Phase: Construction

ASCII mockup for the Construction group showing parallel bead execution.

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
