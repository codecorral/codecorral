## Unit: view-engine

**Description:** The developer surface integration layer. Implements the view engine that reconciles workflow phase transitions into cmux workspace layouts, notifications, status pills, and progress indicators. Uses own-state reconciliation — the engine tracks what it created and never queries cmux to discover existing state, so user-created workspaces and panes are never disturbed.

**Deliverable:** cmux JSON-RPC socket client, `ViewState` tracking per workflow instance, reconciliation algorithm (diff previous engine-owned state against desired state, issue only delta commands), view configs for each phase of the unit workflow, notification system, status pills, progress indicators, browser pane management with dynamic URLs, recovery after cmux restart. `codecorral workspaces` command for enumerating engine-managed workspaces.

**Dependencies:** unit-workflow

## Relevant Requirements

- Phase-driven developer surface where workspace layouts, panes, and notifications are automatically reconfigured as workflows transition between phases
- Declarative workspace configuration
- CLI can enumerate workspaces
- View engine must reconcile against own state, not cmux actual state, to avoid interfering with user customizations

## System Context

**Contract exercised:** C2 (Engine → Developer Surface — cmux JSON-RPC socket).

**cmux hierarchy mapping:**
| Engine Concept | cmux Primitive |
|---|---|
| Profile/Project | Window |
| Workflow instance | Workspace (one per workflow, persists across all phases) |
| Agent session view | Surface (terminal panel) |
| Ancillary view (git diff, tuicr) | Surface (terminal panel, split) |
| PR page, docs | Surface (browser panel) |
| Phase status | Sidebar status pill |

**Critical design: one workspace per workflow instance.** Phase transitions rename the workspace and reconcile its contents — they do NOT create new workspaces. The sidebar tab stays in the same position, user muscle memory is preserved, and user customizations survive phase transitions.

**Own-state reconciliation (D23, feedback memory):**
1. Engine maintains a `ViewState` record per workflow — the engine-managed subset of cmux
2. On transition, diff previous `ViewState` against new desired `ViewState`
3. Issue only create/close/navigate commands for the delta
4. User-created workspaces and surfaces are invisible to the engine — never touched

**Recovery after cmux restart:** cmux surface IDs are session-scoped (reset on restart). Engine detects stale IDs when cmux returns errors, sets all IDs to null, and re-runs reconciliation from scratch.

**View configs per unit workflow phase:**
- Elaboration: agent terminal (main), artifact watcher (right)
- Human Review: tuicr (main), sidecar (right-top), browser (right-bottom, dynamic URL)
- Implementation: agent terminal (main), git diff (right), git log (bottom)
- Code Review: tuicr (main), sidecar (right), browser (bottom, PR URL)
- Verification: agent terminal (main), diff against main (right)

## Scope Boundaries

**In scope:**
- cmux JSON-RPC socket client (connect per-request to `/tmp/cmux.sock`)
- `ViewState` data structure and persistence within workflow instance context
- Reconciliation algorithm: workspace lifecycle, surface diff by role, status pill updates, progress updates
- View configs for all unit workflow phases (elaboration, review, implementation, code review, verification, completion)
- `workflow.setBrowserUrl` MCP tool implementation (agent → engine → `browser.navigate`)
- Notification system: `notification.create` on phase transitions requiring attention
- Status pills: phase indicator, branch name, progress bar
- Recovery after cmux restart (stale ID detection, full rebuild)
- `codecorral workspaces` CLI command (enumerate engine-managed workspaces with status)
- `CMUX_SOCKET_MODE=allowAll` documentation for external daemon mode

**Out of scope:**
- Building cmux itself — the engine consumes its existing socket API
- Agent-controlled panes (D23) — agents use cmux directly for their own panes; engine doesn't track those
- View configs for intent workflow (Unit 6) and t2d workflow (Unit 7) — those units define their own configs
- Nix flake view config overrides (Unit 8)
