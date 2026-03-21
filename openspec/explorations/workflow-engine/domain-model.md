# CodeCorral Workflow Engine — Domain Model

A domain-driven design document for the orchestration system that guides AI agent workflows through structured development lifecycles. This is the CodeCorral project's core contribution — the workflow engine, its schemas, and the integration patterns that connect session management, developer surfaces, and change management tooling.

## Strategic Design

### Bounded Contexts

```
┌─────────────────────────────────────────────────────────────────┐
│                     WORKFLOW ENGINE                              │
│                     (orchestration context)                      │
│                                                                 │
│  Owns: workflow definitions, state machines, transitions,       │
│        guards, actions, view mappings, board adapters            │
│                                                                 │
│  Sends commands to ──▶ Session Management + Developer Surface   │
│  Receives events from ──▶ Session Management + Change Mgmt      │
│                                                                 │
└──────────┬──────────────────┬─────────────────┬─────────────────┘
           │                  │                 │
           │ events +         │ commands        │ commands
           │ commands         │                 │
           │                  │                 │
┌──────────┴──────────────┐   │   ┌─────────────┴─────────────────┐
│  SESSION MANAGEMENT     │   │   │  DEVELOPER SURFACE             │
│                         │   │   │                                │
│  Owns: sessions,        │   │   │  Owns: windows, workspaces,   │
│        groups, profiles,│   │   │        panes, surfaces,        │
│        worktrees,       │   │   │        notifications, browser  │
│        conductors,      │   │   │                                │
│        MCP pools        │   │   │  Mapping:                      │
│                         │   │   │    window = project = profile  │
│  Mapping:               │   │   │    workspace = workflow phase  │
│    profile = project    │   │   │    pane = contextual view      │
│    session = agent task │   │   │                                │
│    conductor = LLM      │   │   └────────────────────────────────┘
│      bridge for engine  │   │
└─────────────────────────┘   │
                              │
                    ┌─────────┴───────────┐
                    │  CHANGE MANAGEMENT   │
                    │                      │
                    │  Owns: schemas,      │
                    │    changes,          │
                    │    artifacts, specs  │
                    │                      │
                    │  Provides:           │
                    │    artifact          │
                    │    instructions,     │
                    │    session prompts,  │
                    │    commit guidance   │
                    └──────────────────────┘

                    ┌─────────────────────┐
                    │  TASK BOARD          │
                    │  (anti-corruption    │
                    │   layer)             │
                    │                      │
                    │  Adapters:           │
                    │    GitHub Issues     │
                    │    Linear            │
                    │    Jira              │
                    │    Local filesystem  │
                    └─────────────────────┘
```

### Context Relationships

| Upstream | Downstream | Relationship |
|----------|------------|--------------|
| Change Management | Workflow Engine | **Conformist** — engine conforms to schema artifact structure |
| Workflow Engine | Developer Surface | **Customer-Supplier** — engine tells surface what to display |
| Workflow Engine | Session Management | **Customer-Supplier** — engine creates/manages sessions |
| Session Management | Workflow Engine | **Event Publisher** — sessions emit status events |
| Task Board | Workflow Engine | **Anti-Corruption Layer** — board adapter normalizes external systems |

The Workflow Engine is the **only component that understands workflow semantics**. Session Management and Developer Surface are general-purpose tools that receive commands. Change Management provides the schema and artifact structure but doesn't drive the lifecycle.

---

## Ubiquitous Language

These terms belong to CodeCorral's domain — they are **not** the vocabulary of the underlying tools (agent-deck, cmux, OpenSpec, XState). Those tools are implementation details.

### Workflow Domain

| Term | Definition |
|------|------------|
| **Workflow** | A stateful process that guides a unit of work from brief through implementation to completion. One instance per unit brief. |
| **Workflow Definition** | An immutable template describing states, transitions, guards, and actions. Versioned. Distributed via Nix and npm. |
| **Workflow Instance** | A running instance bound to a specific unit brief. Persisted as JSON. The single source of truth for where a unit of work stands. |
| **Phase** | A top-level grouping of states (Elaboration, Implementation, Review, Verification). Phases determine which view configuration is active and which sessions are surfaced. |
| **Transition** | A directed edge between states, triggered by an event, optionally guarded. |
| **Event** | Something that happened — from an agent, human, hook, or the engine itself. Events are either **framework events** (always active, core to the workflow) or **custom events** (user-defined, toggleable, extensible via composition or forking the workflow definition). |
| **Guard** | A deterministic predicate evaluated before a transition fires. Enforces preconditions that the event source (often an LLM) cannot be trusted to verify alone. Examples: "worktree is clean," "artifact file exists on disk," "tests pass." |
| **Action** | A side effect executed during a transition or on state entry/exit. Actions target Session Management (create/close sessions), Developer Surface (reconfigure views), or Change Management (run schema commands). |
| **Route** | A decision point where the workflow forks. Determined by unit brief attributes (explicit `route: fast-forward` field) with fallback to agent judgment. |
| **View Config** | A declarative description of what the developer surface should look like for a given phase. Maps phases to window layouts, pane contents, and active surfaces. |
| **Board Adapter** | A pluggable interface for reading/writing unit briefs from external systems (GitHub Issues, Linear, Jira, local filesystem). The adapter normalizes the external system into a common `UnitBrief` shape. |

### Session Domain

| Term | Definition |
|------|------------|
| **Session** | An isolated agent workspace with its own worktree, tool (Claude Code, etc.), and session prompt. Multiple sessions may serve a single workflow instance at different phases. |
| **Session Prompt** | Instructions injected into a session at creation time. Includes workflow context, commit guidance, and phase-specific behavior. Provided by the workflow engine, not hard-coded in the session manager. |
| **Conductor** | A persistent LLM session that serves as the workflow engine's bridge to LLM capabilities. One conductor per profile. Handles: polling the task board, auto-responding to agent questions, notification bridging (Telegram/Discord), and executing LLM-dependent actions on behalf of the engine. |
| **Profile** | Runtime context for a project: config directory, API keys, identities. One profile = one project = one developer surface window. |
| **Worktree** | A git worktree providing branch isolation. Owned by the session, shared across phases of the same workflow instance. |

### Surface Domain

| Term | Definition |
|------|------------|
| **Window** | Top-level container in the developer surface. One window per profile/project. Contains workspaces. |
| **Workspace** | A tab within a window representing the currently surfaced workflow phase. Only the active/attention-needed workflows are visible — the rest run headless in Session Management. |
| **Pane** | A region within a workspace showing a contextual view: agent terminal, git diff, browser, review TUI, etc. |
| **Managed Session** | A tmux session created and owned by the workflow engine for ancillary panes (git diff, sidecar, file explorer). Named with a convention prefix (e.g., `wfe-<workflow-id>-<role>`) for reliable cleanup. Some managed sessions persist across phases; others are phase-specific. Convention-based naming with fallback: `wfe-{id}-{phase}-{role}` for phase-specific, `wfe-{id}-{role}` for workflow-wide. |
| **Notification** | Attention signal surfaced in the developer surface when a workflow needs human input. Levels: info, attention, urgent. |

### Change Domain

| Term | Definition |
|------|------------|
| **Schema** | Defines which artifacts are produced and in what order. Each schema corresponds to a workflow definition. Currently: `spec-driven` (proposal workflow). Future: `intent` (elaboration + decomposition workflow). |
| **Artifact** | A document produced during a change. Schema instructions tell the agent *how* to generate it. The workflow engine tracks *which* artifact is current. |
| **Unit Brief** | The atomic work item. Entry point to a workflow instance. Published to a task board by the intent workflow (or by a human directly). |
| **Task Board** | External system holding unit briefs available for pull. The conductor polls the board via the board adapter. |

---

## Aggregates

### Workflow Instance (Aggregate Root)

```
WorkflowInstance
├── id: string (e.g., "hm-agent-deployment-2026-03-20")
├── definitionId: string (e.g., "proposal-v1")  // the schema + version
├── unitBriefRef: {
│     source: "github-issues" | "linear" | "local" | ...
│     externalId: string | null     (issue number, etc.)
│     path: string                  (local path to brief content)
│   }
├── currentState: string (state machine node ID)
├── context: {
│     profileId: string             (session management profile)
│     sessions: {                   (multiple sessions per workflow)
│       elaboration: string | null  (session ID)
│       implementation: string | null
│       review: string | null
│     }
│     worktreePath: string | null
│     changeName: string | null     (openspec change name)
│     windowId: string | null       (developer surface window)
│     cmuxWorkspaceId: string | null
│     managedSessions: string[]     (tmux session names for ancillary panes)
│     route: "incremental" | "fast-forward" | null
│     currentArtifact: string | null
│     reviewRound: number
│   }
├── history: Event[]                (audit log)
└── createdAt / updatedAt: timestamp
```

### View Config (Value Object)

```
ViewConfig
├── workspace: {
│     title: string (templated)
│     sidebar: { status: string, branch: string }
│   }
├── panes: [
│     {
│       position: "main" | "right" | "bottom" | "right-top" | "right-bottom"
│       type: "session" | "managed" | "browser"
│       // for type "session": attach to an agent-deck session
│       attach: "{sessions.elaboration}"
│       // for type "managed": run command in a managed tmux session
│       command: "cd {worktreePath} && git diff --stat"
│       sessionName: "wfe-{id}-gitdiff"    // convention-based name
│       persistent: true | false            // survives phase changes?
│       // for type "browser": navigate to URL
│       url: string (templated — can be set dynamically by LLM)
│     }
│   ]
├── notifications: [
│     { level: "info" | "attention" | "urgent", message: string }
│   ]
└── cleanup: string[]  // managed session names to kill on phase exit
```

The `url` field for browser panes can be set statically in the view config or dynamically by the agent via MCP. This allows agents to surface relevant URLs (docs, PR pages, dev servers) without the workflow definition needing to anticipate them.

---

## Domain Events

### Framework Events (always active)

These are core to the workflow and cannot be disabled.

```
Source: Agent (via MCP)
──────────────────────
  context.loaded        — agent has read brief + searched memory
  route.decided         — agent chose incremental or fast-forward
    { route: "incremental" | "fast-forward", reasoning: string }
  artifact.ready        — agent finished generating an artifact
    { artifactType: "proposal" | "design" | "spec" | "tasks" }
  impl.complete         — agent believes implementation is done
  verification.result   — opsx:verify output
    { passed: boolean, issues: string[] }
  learnings.captured    — claude-md-improver + memory storage done

Source: Human (via CLI or conductor bridge)
──────────────────────────────────────────
  review.approved       — human approves current artifact(s)
    { ff: boolean }     — if true, fast-forward remaining artifacts
  review.revised        — human requests changes
    { feedback: string }
  workflow.pull         — conductor or human pulls a unit brief
    { unitBriefRef: UnitBriefRef }
  workflow.abort        — cancel the workflow
  workflow.skip         — skip current phase

Source: Deterministic (Claude Code hooks, git hooks)
────────────────────────────────────────────────────
  tests.passed / tests.failed    — guard input
  pr.created { url }             — PR opened
  pr.merged                      — PR merged
  code-review.passed             — review agent approves
  code-review.failed { issues }  — review agent finds issues
```

### Custom Events (user-extensible)

Users can define additional events in the workflow definition or via plugins. Examples:
- `docs.updated` — documentation was regenerated
- `benchmark.regressed` — performance test shows regression
- `security.flagged` — security scan found issues

Custom events can be added by:
1. **Composition** — extending a workflow definition with additional states/transitions
2. **Forking** — creating a user-level copy of the workflow definition
3. **Plugins** — registering event handlers that fire on state entry/exit

### Outbound Actions (Side Effects)

```
Target: Session Management
──────────────────────────
  session.create        — create agent session with worktree + session prompt
  session.instruct      — send instruction to an active session
  session.close         — tear down session (worktree may persist)
  conductor.instruct    — ask the conductor to perform an LLM-dependent task

Target: Developer Surface
─────────────────────────
  view.apply            — materialize a ViewConfig (diff-based, not recreate)
  view.teardown         — close ancillary panes, return to default
  view.setBrowserUrl    — dynamically update a browser pane URL
  notification.send     — surface attention indicator

Target: Change Management
─────────────────────────
  schema.command        — run opsx:new, opsx:continue, opsx:ff, opsx:verify, opsx:archive

Target: Managed Sessions (tmux)
───────────────────────────────
  managed.create        — create named tmux session for ancillary pane
  managed.sendCommand   — update running managed session with new command
  managed.destroy       — kill managed session by name
  managed.destroyAll    — kill all wfe-{workflowId}-* sessions (cleanup)
```

Note: **Git operations are not engine actions.** Git commits are the agent's responsibility, guided by the session prompt and schema artifact instructions. The engine uses guards to verify git state (e.g., "worktree is clean before entering review") but does not execute git commands. See "Git Commit Strategy" below.

---

## Git Commit Strategy

Git commits are a **hybrid responsibility** — not purely engine-driven, not purely ad-hoc.

### Three commit contexts

| Context | Who commits | How |
|---------|-------------|-----|
| **Routine work** | Agent, autonomously | Session prompt says: "commit cohesive changes as you work using conventional commits" |
| **Checkpoint (before review)** | Agent, prompted by schema | Schema artifact instructions include: "after generating this artifact, commit your work." Engine guard verifies worktree is clean before entering review state. |
| **Post-review rework** | Agent, after incorporating feedback | Agent receives review feedback, makes changes, commits. Engine guard verifies clean worktree before accepting `artifact.ready` again. |

### Why hybrid?

- **Routine commits**: The agent has the best context for what constitutes a cohesive change. The engine shouldn't micromanage.
- **Checkpoint commits**: These matter for review tooling (tuicr, sidecar). Having clean commits at phase boundaries means `tuicr` can launch directly against a commit or commit range. The engine doesn't *make* the commit — it *expects* one and uses a guard to enforce it.
- **Post-review commits**: Same as routine — the agent knows what changed.

### Session prompt guidance

The workflow engine injects commit guidance into the session prompt at session creation:

```
You are working on unit "{unitBrief.name}" in the {phase} phase.

Commit guidelines:
- Commit cohesive changes as you work. Use conventional commits.
- Before signaling that an artifact is ready (workflow.transition("artifact.ready")),
  ensure all changes are committed. The workflow will check for a clean worktree.
- After receiving review feedback and making changes, commit before
  signaling readiness again.
```

This keeps commit behavior in the agent's natural flow rather than requiring engine-orchestrated git operations.

### Guards that depend on git state

```
Guards:
  worktreeClean        — no uncommitted changes in worktree
  hasNewCommits        — at least one new commit since last phase entry
  artifactExists       — the expected artifact file exists on disk
```

---

## Event Mechanism Design

### Architecture: SSE Daemon + CLI Client

The engine runs as a **long-running daemon** exposing both MCP (for agents) and SSE (for external clients). The CLI connects to the daemon over stdio/SSE.

```
┌─────────────┐     MCP (stdio via pool)   ┌──────────────────────┐
│ Agent        │ ────────────────────────▶  │                      │
│ (in session) │                            │                      │
└─────────────┘                            │   Workflow Engine     │
                                           │   Daemon              │
┌─────────────┐     CLI → SSE/stdio        │                      │
│ Human        │ ────────────────────────▶  │   - XState instances │
│              │  `wfe transition ...`      │   - Event bus         │
└─────────────┘                            │   - State persistence │
                                           │   - Guard evaluation  │
┌─────────────┐     Claude Code hooks      │                      │
│ Hooks        │ ────────────────────────▶  │                      │
│ (git, CC)   │  `wfe transition ...`      │                      │
└─────────────┘                            └────────┬─────────────┘
                                                    │
                              actions               │
                    ┌───────────────┬───────────────┤
                    │               │               │
                    ▼               ▼               ▼
              ┌──────────┐  ┌──────────────┐  ┌──────────┐
              │ Session   │  │  Developer   │  │  Change  │
              │ Mgmt CLI  │  │  Surface     │  │  Mgmt    │
              │           │  │  socket API  │  │  CLI     │
              └──────────┘  └──────────────┘  └──────────┘
```

### Concurrency Model

Multiple event sources (MCP from different agent sessions, CLI, hooks) can fire events concurrently. The engine uses a **single-threaded event loop with a queue**:

1. Events arrive from any source and are enqueued
2. The engine processes one event at a time per workflow instance
3. Each event: validate → evaluate guards → transition → execute actions → persist state
4. If two events arrive for the same instance simultaneously, the second waits

This avoids state corruption without complex locking. XState's actor model naturally supports this — each workflow instance is an actor that processes messages sequentially.

### MCP Interface (Agent → Engine)

```
Tools:
  workflow.transition(event, payload?)
    — fire a named event with optional data
    — engine validates event is legal in current state
    — returns: { accepted: bool, newState: string, message: string }

  workflow.status()
    — returns current state, phase, context, available transitions
    — agents use this to understand where they are

  workflow.context()
    — returns the full workflow instance context
    — worktree path, change name, current artifact, etc.

  workflow.setBrowserUrl(url, paneRole?)
    — dynamically update a browser pane in the current view
    — allows agents to surface relevant URLs without engine changes

Resources:
  workflow://instance/{id}/state.json
    — read-only access to persisted state
  workflow://definition/{id}/machine.json
    — read-only access to the state machine definition
```

### CLI Interface (Human → Engine)

```bash
wfe status                          # show all active workflow instances
wfe status <id>                     # show specific instance state
wfe pull <unit-brief-ref>           # start a workflow (or conductor does this)
wfe approve [--ff]                  # approve current review
wfe revise --feedback "..."         # request changes
wfe abort <id>                      # cancel a workflow
wfe skip <id>                       # skip current phase
wfe history <id>                    # show event log
wfe view <id>                       # show current view config
```

The CLI connects to the running daemon. If the daemon isn't running, it starts it. Events from CLI and MCP are processed identically — the CLI is a convenience interface, not a separate system.

### Claude Code Hooks (Deterministic → Engine)

The most prominent deterministic event source. Claude Code hooks fire on tool use, session events, etc., and can trigger workflow transitions:

```json
// .claude/hooks/post-tool-use.sh (conceptual)
// After a test run completes, fire tests.passed/failed
wfe transition tests.passed --instance $WFE_INSTANCE_ID
```

The hook approach is preferred over file watching or git hooks because Claude Code hooks are already part of the agent's environment and don't require additional infrastructure.

---

## The Conductor's Role

The conductor is **not** replaced by the workflow engine. It serves a distinct role as the engine's **LLM bridge**:

```
┌─────────────────────────────────────────┐
│  Workflow Engine (deterministic)         │
│                                         │
│  Can: transition states, evaluate       │
│       guards, fire actions, persist     │
│                                         │
│  Cannot: make judgment calls,           │
│          interpret natural language,     │
│          auto-respond to agents,        │
│          compose commit messages         │
│                                         │
│  Delegates LLM work to ──▶ Conductor   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Conductor (LLM, one per profile)       │
│                                         │
│  Responsibilities:                      │
│  - Poll task board via board adapter    │
│  - Pull unit briefs → wfe pull          │
│  - Auto-respond to agent questions      │
│  - Notification bridge (Telegram/Discord)│
│  - Execute LLM-dependent actions when   │
│    the engine requests via              │
│    conductor.instruct                   │
│                                         │
│  Does NOT: track workflow state         │
│  (that's the engine's job)             │
└─────────────────────────────────────────┘
```

One conductor per profile. The conductor is an agent-deck session running Claude Code with a CLAUDE.md that includes the workflow engine MCP tools. It can call `workflow.status()` to understand what's happening and `workflow.transition()` to advance workflows based on its judgment.

---

## Multi-Session Workflows

A single workflow instance may use **multiple agent-deck sessions** at different phases:

```
Workflow: hm-agent-deployment
├── elaboration session    — generates artifacts (opsx:new, opsx:continue)
├── implementation session — writes code (opsx:apply)
├── review session         — code review agent
└── (shared worktree across all sessions)
```

Each session gets a **phase-appropriate session prompt** injected by the engine. The sessions may run concurrently (review agent checking completed work while implementation continues on next task) or sequentially.

The developer surface shows only the **currently relevant** session(s) in the workspace panes. The rest run headless in Session Management. The engine decides which sessions to surface based on the current phase and any attention signals.

---

## State-to-View Mapping

Each phase maps to a view config. Browser panes support dynamic URLs — the agent or conductor can update them via MCP without requiring a view config change.

```yaml
phases:
  elaboration:
    workspace:
      title: "{unitBrief.name} — Elaborating"
    panes:
      main:
        type: session
        attach: "{sessions.elaboration}"
      right:
        type: managed
        command: "watch -n2 ls -la {changePath}/"
        sessionName: "wfe-{id}-artifacts"
        persistent: false
    on_enter:
      - notification: "Elaboration started for {unitBrief.name}"

  human-review:
    workspace:
      title: "{unitBrief.name} — Review"
    panes:
      main:
        type: managed
        command: "tuicr {worktreePath}"
        sessionName: "wfe-{id}-review-tuicr"
        persistent: false
      right-top:
        type: managed
        command: "sidecar"
        sessionName: "wfe-{id}-sidecar"
        persistent: true          # sidecar persists across phases
      right-bottom:
        type: browser
        url: null                 # set dynamically by agent or conductor
    on_enter:
      - notification: "Review needed: {currentArtifact}"
        level: attention

  implementing:
    workspace:
      title: "{unitBrief.name} — Implementing"
    panes:
      main:
        type: session
        attach: "{sessions.implementation}"
      right:
        type: managed
        command: "cd {worktreePath} && watch -n5 git diff --stat"
        sessionName: "wfe-{id}-gitdiff"
        persistent: true          # git diff view persists
      bottom:
        type: managed
        command: "cd {worktreePath} && watch -n5 git log --oneline -20"
        sessionName: "wfe-{id}-gitlog"
        persistent: true
    on_enter: []

  code-review:
    workspace:
      title: "{unitBrief.name} — Code Review"
    panes:
      main:
        type: managed
        command: "tuicr {worktreePath}"
        sessionName: "wfe-{id}-codereview-tuicr"
        persistent: false
      right:
        type: managed
        command: "sidecar"
        sessionName: "wfe-{id}-sidecar"    # reuses existing if persistent
        persistent: true
      bottom:
        type: browser
        url: null                 # PR URL set dynamically
    on_enter:
      - notification: "Code review ready"
        level: attention

  verifying:
    workspace:
      title: "{unitBrief.name} — Verifying"
    panes:
      main:
        type: session
        attach: "{sessions.implementation}"
      right:
        type: managed
        command: "cd {worktreePath} && git diff main...HEAD --stat"
        sessionName: "wfe-{id}-verify-diff"
        persistent: false
    on_enter: []
```

View transitions are **diff-based**: the engine compares the current view config with the target and only creates/destroys panes that changed. Persistent managed sessions survive phase transitions; non-persistent ones are cleaned up on phase exit.

---

## Board Adapter Interface

The task board is an **anti-corruption layer** between the intent workflow (which produces unit briefs) and the proposal workflow (which consumes them). The two workflows are loosely coupled through the board.

```
BoardAdapter
  listAvailable(filter?) → UnitBrief[]
  pull(id) → UnitBrief        // marks in-progress on the board
  complete(id) → void          // marks done on the board
  fail(id, reason) → void      // marks failed on the board
```

| Strategy | Source | Implementation |
|----------|--------|----------------|
| `github-issues` | GitHub Issues with label | `gh` CLI via adapter |
| `linear` | Linear project | Linear API |
| `jira` | Jira board | Jira API |
| `local` | `openspec/changes/*/units/*/unit-brief.md` | File glob |
| `manual` | CLI argument | `wfe pull --brief ./path` |

Configured per-profile in the engine config. The conductor polls the board and decides when to pull briefs — the engine itself doesn't poll.

---

## Persistence Model

```
~/.codecorral/
├── definitions/                    # Workflow definitions (installed via Nix or npm)
│   ├── proposal-v1.json
│   └── intent-v1.json
├── instances/                      # Active workflow instances
│   ├── hm-agent-deployment.json
│   └── linkding-backup.json
├── config.yaml                     # Engine configuration
│   ├── daemon.port
│   ├── surface.socketPath          # cmux socket
│   ├── sessions.profileDefault     # agent-deck default profile
│   ├── board.adapter               # which board adapter
│   └── board.config                # adapter-specific config
└── logs/                           # Event logs per instance
```

Distributed via **Nix** (flake + home-manager module) and **npm** (npx for non-Nix users).

---

## Composition of Workflows

The intent workflow and proposal workflow are **separate workflow definitions** that compose through the task board:

```
Intent Workflow                  Task Board              Proposal Workflow
═══════════════                  ══════════              ════════════════

  raw idea                          ┌──────┐
    ↓                               │ brief │◀── published by intent workflow
  intent-brief                      │ brief │◀── or created by human directly
    ↓                               │ brief │
  requirements                      └───┬──┘
    ↓                                   │
  system-context                        │ pulled by conductor
    ↓                                   │ via board adapter
  unit decomposition                    ▼
    ↓                             Proposal Workflow
  bolt-plan                       (one instance per brief)
    ↓
  publish to board ──────▶ board
```

No runtime coupling. Different machines, different schemas, different schedules. The board is the interface.

---

## Relationship to Dark Factory Exploration

This design evolves the dark factory concept:

| Dark Factory | CodeCorral Workflow Engine |
|---|---|
| Beads as spine | XState instances as spine (beads optional as external board view) |
| Conductor drives pipeline | Engine drives pipeline; conductor is LLM bridge + board poller |
| Ralph TUI for execution | Agent-deck sessions for execution, multiple per workflow |
| Agent Deck as "tmux for TUIs" | Developer surface (cmux) for visual, session management (agent-deck) for headless |
| Three loops (ideation → spec → impl) | Two workflow definitions (intent → proposal) composing through task board |
| File scanning / bead queries for state | Explicit state machine with typed events and deterministic guards |
| Git commits as pipeline steps | Git commits as agent responsibility with guard-enforced checkpoints |

The key shift: **state is explicit and centralized** rather than inferred from distributed artifacts. The workflow engine knows exactly where every unit of work stands because it's the one tracking transitions. But it **delegates LLM judgment** to the conductor rather than trying to be smart itself.

---

## Open Questions

1. **Schema-to-definition mapping.** Is there a 1:1 relationship between an OpenSpec schema and a workflow definition? Or can multiple schemas share a workflow definition with different artifact configurations?

2. **Conductor scaling.** One conductor per profile works for moderate workloads. At high parallelism (20+ workflow instances), does the conductor become a bottleneck? Could we have conductor pools?

3. **View config authoring.** Who writes view configs — the workflow definition author, the project-level config, or both with merging? A default view config in the definition with project-level overrides seems right.

4. **Dynamic pane content.** Beyond browser URLs, should agents be able to request arbitrary pane changes (e.g., "show me the test output in the right pane")? Or is that over-engineering for now?

5. **Workflow instance cleanup.** When a workflow completes, the engine cleans up managed sessions. But what about the agent-deck sessions and worktree? Merge-then-delete? Keep for a cooldown period? Configurable?

6. **Offline / disconnected mode.** If the daemon crashes, agent sessions keep running (they're in tmux). On restart, the engine rehydrates from persisted state. But any events fired during downtime are lost. Is that acceptable, or do we need an event journal?
