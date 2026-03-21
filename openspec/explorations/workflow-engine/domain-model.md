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
│  Mapping:               │   │   │    workspace = workflow instance│
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
| **Workflow Definition** | An immutable template describing states, transitions, guards, and actions. Created via `setup().createMachine()` — frozen after creation (XState enforces this). Versioned. Distributed via Nix and npm. |
| **Workflow Instance** | A running XState actor bound to a specific unit brief. Persisted via `actor.getPersistedSnapshot()` as JSON. Rehydrated via `createActor(machine, { snapshot })`. The single source of truth for where a unit of work stands. |
| **Phase** | A top-level grouping of states (Elaboration, Implementation, Review, Verification). Phases determine which view configuration is active and which sessions are surfaced. |
| **Transition** | A directed edge between states, triggered by an event, optionally guarded. |
| **Event** | Something that happened — from an agent, human, hook, or the engine itself. Events are either **framework events** (always active, core to the workflow) or **custom events** (user-defined, toggleable, extensible via composition or forking the workflow definition). |
| **Guard** | A synchronous predicate evaluated before a transition fires. Guards read from the workflow instance context — they cannot perform I/O. Async preconditions (git checks, filesystem checks) are modeled as **invoked precondition services** that cache results in context, with guards reading the cached values. |
| **Precondition** | An async check that must pass before a transition fires. Unlike guards (which are synchronous context reads), preconditions invoke external services (git, openspec CLI) and report results as events. The engine models these as intermediate "checking" states with invoked services. Examples: "worktree is clean," "artifact file exists on disk," "tests pass." |
| **Action** | A synchronous, infallible side effect executed during a transition or on state entry/exit. Actions update context (`assign`), raise internal events, or send messages to other actors. Actions must **not** perform I/O or async work — those are modeled as **invoked services**. |
| **Invoked Service** | An async, fallible operation executed by entering a state that `invoke`s it. Used for all external I/O: creating sessions, applying views, running CLI commands. Invoked services report completion via `onDone`/`onError` transitions, enabling proper error handling. |
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
| **Workspace** | A tab within a window representing a workflow instance. One workspace per workflow for its entire lifetime — phase transitions rename and reconcile the workspace contents, they do not create new workspaces. Only active/attention-needed workflows are visible — the rest run headless in Session Management. |
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

Events use XState's `type` property as the discriminant, with payload fields flattened into the event object (not nested under `payload`).

```
Source: Agent (via MCP)
──────────────────────
  { type: "context.loaded" }
  { type: "route.decided", route: "incremental" | "fast-forward", reasoning: string }
  { type: "artifact.ready", artifactType: "proposal" | "design" | "spec" | "tasks" }
  { type: "impl.complete" }
  { type: "verification.result", passed: boolean, issues: string[] }
  { type: "learnings.captured" }

Source: Human (via CLI or conductor bridge)
──────────────────────────────────────────
  { type: "review.approved", ff?: boolean }
  { type: "review.revised", feedback: string }
  { type: "workflow.pull", unitBriefRef: UnitBriefRef }
  { type: "workflow.abort" }
  { type: "workflow.skip" }

Source: Deterministic (Claude Code hooks, git hooks)
────────────────────────────────────────────────────
  { type: "tests.passed" } / { type: "tests.failed" }
  { type: "pr.created", url: string }
  { type: "pr.merged" }
  { type: "code-review.passed" }
  { type: "code-review.failed", issues: string[] }
```

> **XState note:** The MCP/CLI external interface uses `{ event: string, payload?: {} }` for ergonomics. The engine translates to XState's `{ type: event, ...payload }` shape before sending to the actor. This translation is a thin adapter layer, not a separate system.

### Custom Events (user-extensible)

Users can define additional events in the workflow definition or via plugins. Examples:
- `docs.updated` — documentation was regenerated
- `benchmark.regressed` — performance test shows regression
- `security.flagged` — security scan found issues

Custom events can be added by:
1. **Build-time composition** — merging configuration objects before calling `setup().createMachine()`. XState machines are frozen after creation, so structural changes (adding states/transitions) must happen at build time, not runtime.
2. **Implementation overrides** — providing different action/guard/actor implementations at actor creation time via `.provide()`. This allows swapping behavior without changing machine structure.
3. **Forking** — creating a user-level copy of the workflow definition
4. **Subscription handlers** — the engine subscribes to actor state changes and calls external plugin handlers. This is an engine-level concern, not native XState functionality.

### Outbound Side Effects

XState v5 distinguishes between **actions** (synchronous, infallible, fire-and-forget) and **invoked services** (async, fallible, with error handling). All external I/O must use invoked services.

```
Synchronous Actions (assign, raise, sendTo — execute during transitions):
──────────────────────────────────────────────────────────────────────────
  assign context       — update workflow context (worktreePath, changeName, etc.)
  raise event          — fire an internal event (e.g., auto-advance)
  sendTo actor         — message another XState actor (e.g., conductor actor)
  log                  — record event to history

Invoked Services (async — entered via state `invoke`, report onDone/onError):
──────────────────────────────────────────────────────────────────────────────
  Target: Session Management
    session.create        — agent-deck launch (returns session info)
    session.instruct      — agent-deck session send
    session.close         — agent-deck session stop + remove
    conductor.instruct    — agent-deck session send to conductor

  Target: Developer Surface
    view.reconcile        — cmux socket commands to reconcile view state
    view.teardown         — close engine-owned panes
    view.setBrowserUrl    — cmux browser navigate
    notification.send     — cmux notification.create

  Target: Change Management
    schema.new            — openspec new change
    schema.status         — openspec status --json
    schema.instructions   — openspec instructions --json
    schema.archive        — openspec archive -y

  Target: Precondition Checks
    check.worktreeClean   — git status --porcelain
    check.hasNewCommits   — git rev-list count
    check.artifactExists  — openspec status --json
    check.tasksComplete   — openspec instructions apply --json
```

Each invoked service produces `onDone` (success → assign results to context, advance) or `onError` (failure → handle gracefully, notify, or retry). This means the machine has intermediate "checking" and "setting up" states between the major phases — e.g., `review.approved` → `checkingPreconditions` → `implementing.setup` → `implementing.working`.

Note: **Git operations are not engine actions.** Git commits are the agent's responsibility, guided by the session prompt and schema artifact instructions. The engine uses precondition checks to verify git state (e.g., "worktree is clean before entering review") but does not execute git commands. See "Git Commit Strategy" below.

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

### Preconditions that depend on external state

These checks require I/O (git, filesystem) and therefore cannot be XState guards (which must be synchronous). They are modeled as **invoked precondition services** that run in intermediate "checking" states.

```
Invoked Precondition Services:
  check.worktreeClean   — git status --porcelain → onDone/onError
  check.hasNewCommits   — git rev-list count → onDone/onError
  check.artifactExists  — openspec status --json → onDone/onError
  check.tasksComplete   — openspec instructions apply → onDone/onError

Synchronous Guards (read from context only):
  isIncremental         — context.route === "incremental"
  isFastForward         — context.route === "fast-forward"
  preconditionsPassed   — context.preconditionResults.allPassed === true
  hasReviewFeedback     — context.reviewFeedback !== null
```

The pattern: an event like `artifact.ready` transitions to a `checkingPreconditions` state that invokes the async checks. On success, it transitions to the target state. On failure, it bounces back to the source state with an error message.

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
│ Human        │ ────────────────────────▶  │   - XState actors    │
│              │  `codecorral approve`      │   - Actor mailboxes  │
└─────────────┘                            │   - Snapshot persist  │
                                           │   - Invoked services  │
┌─────────────┐     Claude Code hooks      │                      │
│ Hooks        │ ────────────────────────▶  │                      │
│ (git, CC)   │  `codecorral transition`   │                      │
└─────────────┘                            └────────┬─────────────┘
                                                    │
                            invoked services        │
                    ┌───────────────┬───────────────┤
                    │               │               │
                    ▼               ▼               ▼
              ┌──────────┐  ┌──────────────┐  ┌──────────┐
              │ Session   │  │  Developer   │  │  Change  │
              │ Mgmt CLI  │  │  Surface     │  │  Mgmt    │
              │(agent-deck)│  │ (cmux sock) │  │(openspec)│
              └──────────┘  └──────────────┘  └──────────┘
```

### Concurrency Model

Multiple event sources (MCP from different agent sessions, CLI, hooks) can fire events concurrently. XState's actor model handles this:

1. Events arrive from any source and enter the actor's **mailbox** (FIFO queue)
2. Each actor processes one event at a time — sequential per workflow instance
3. Each event: validate → evaluate guards → transition → execute actions
4. If two events arrive for the same instance simultaneously, the second waits in the mailbox

This avoids state corruption without complex locking. XState's actor model naturally supports this — each workflow instance is an actor with its own mailbox.

**Important:** Sequential processing is **per-actor** (per-workflow-instance), not global. If the engine runs multiple workflow instances in the same Node.js process, events to *different* instances are processed concurrently. This is fine for correctness (they don't share XState state) but matters for resource contention — two instances shelling out to `agent-deck launch` or `git status` simultaneously. The engine should use a semaphore or queue for shared CLI resources if needed.

**Persistence** is not automatic in XState. The engine subscribes to each actor and persists on every state change:

```typescript
const actor = createActor(machine, { snapshot: rehydratedSnapshot })
actor.subscribe((snapshot) => {
  const persisted = actor.getPersistedSnapshot()
  writeFileSync(`~/.codecorral/instances/${id}.json`, JSON.stringify(persisted))
})
actor.start()
```

If persistence fails (disk full, permissions), in-memory and on-disk state diverge. The engine should treat persistence failure as a fatal error for the instance.

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

> **XState parallel states opportunity:** The elaboration phase has artifact dependency branches that could elaborate concurrently. In the `spec-driven` schema: `proposal` → (`specs` | `design`) → `tasks`. Since `specs` and `design` both depend only on `proposal`, they could run in parallel regions. XState v5 supports this via `type: "parallel"` states. Similarly, code review and implementation could overlap as parallel regions. For v1, linear flow is simpler. Parallel regions are a v2 optimization.

> **XState history states:** Review-revision loops (`review.revised` → rework → `artifact.ready` → review again) should use XState's `type: "history"` pseudo-state so that returning from review resumes the correct artifact substate rather than restarting the phase from the beginning.

The developer surface shows only the **currently relevant** session(s) in the workspace panes. The rest run headless in Session Management. The engine decides which sessions to surface based on the current phase and any attention signals.

---

## State-to-View Mapping

Each phase maps to a view config that describes the **desired state** of the workflow's single workspace. Phase transitions apply a new view config to the same workspace — renaming it and reconciling surfaces. No new workspaces are created per phase. Browser panes support dynamic URLs — the agent or conductor can update them via MCP without requiring a view config change.

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

View transitions use **own-state reconciliation**: the engine diffs its previous engine-managed `ViewState` against the new desired state — it never queries cmux to discover what actually exists. This ensures user-created tabs and customizations are invisible to the engine and never get closed. Persistent managed sessions survive phase transitions; non-persistent ones are cleaned up on phase exit. View reconciliation is an invoked service (`reconcileView`) that runs in a transitional state between phases.

---

## Task Board Interaction

The task board is a **loose coupling mechanism** between the intent workflow (which produces unit briefs) and the proposal workflow (which consumes them). The two workflows are loosely coupled through the board.

Board interaction is the **conductor's responsibility**, not the engine's. The conductor uses standard tools (`gh`, API clients, filesystem) and LLM judgment to poll boards, evaluate suitability, and pull work items. There is no engine-side board adapter.

```
Conductor (LLM)
  ├── Polls:    gh issue list --label "unit-brief" --state open --json
  │             Linear API, Jira API, local filesystem glob
  ├── Decides:  which item to pull (LLM judgment)
  ├── Pulls:    gh issue edit N --add-label "in-progress"
  └── Starts:   workflow.transition("workflow.pull", { unitBriefRef: {...} })
```

| Source | How the Conductor Accesses It |
|--------|-------------------------------|
| GitHub Issues | `gh issue list`, `gh issue edit` |
| Linear | Linear API / MCP |
| Jira | Jira API / MCP |
| Local filesystem | `openspec/changes/*/units/*/unit-brief.md` glob |
| Manual | `codecorral pull ./path` → delegated to conductor |

Board polling behavior is configured in the conductor's **POLICY.md** (customizable per workspace via the Nix flake). The engine receives a `UnitBriefRef` when the conductor fires `workflow.pull` — it does not know or care which board the brief came from.

---

## Persistence Model

```
~/.codecorral/
├── definitions/                    # Workflow definitions (installed via Nix or npm)
│   ├── proposal-v1.json
│   └── intent-v1.json
├── instances/                      # Active workflow instances
│   ├── hm-agent-deployment.json   # Contains full XState persisted snapshot
│   └── linkding-backup.json
├── config.yaml                     # Engine configuration
│   ├── daemon.port
│   ├── surface.socketPath          # cmux socket
│   ├── sessions.profileDefault     # agent-deck default profile
│   ├── board.adapter               # which board adapter
│   └── board.config                # adapter-specific config
└── logs/                           # Event logs per instance
```

### Instance File Format

Instance files store the **full XState persisted snapshot** from `actor.getPersistedSnapshot()`, not a hand-rolled subset. The snapshot includes `status`, `context`, `value` (current state — may be nested for compound/parallel states), `historyValue` (for history state resolution), `children` (persisted child actor snapshots), and `error`.

```typescript
type PersistedInstanceFile = {
  id: string
  definitionId: string
  unitBriefRef: UnitBriefRef
  xstateSnapshot: unknown          // opaque — from actor.getPersistedSnapshot()
  // Engine-level metadata (not part of XState state):
  history: PersistedEvent[]
  createdAt: string                // ISO 8601
  updatedAt: string
}
```

The engine derives display values (`currentState`, `phase`, `context`) from the snapshot for CLI output and MCP responses, but **never stores them as separate top-level fields**. The snapshot is the single source of truth for rehydration via `createActor(machine, { snapshot: file.xstateSnapshot })`.

> **Why not flat fields?** XState's persisted snapshot includes `historyValue` (needed for review-revision loops that use history states) and nested state values (needed for parallel states). Storing only `currentState: string` loses this information and breaks rehydration.

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
| Beads as spine | XState actors as spine (beads optional as external board view) |
| Conductor drives pipeline | Engine drives pipeline; conductor is LLM bridge + board poller |
| Ralph TUI for execution | Agent-deck sessions for execution, multiple per workflow |
| Agent Deck as "tmux for TUIs" | Developer surface (cmux) for visual, session management (agent-deck) for headless |
| Three loops (ideation → spec → impl) | Two workflow definitions (intent → proposal) composing through task board |
| File scanning / bead queries for state | Explicit state machine with typed events and deterministic guards |
| Git commits as pipeline steps | Git commits as agent responsibility with guard-enforced checkpoints |

The key shift: **state is explicit and centralized** rather than inferred from distributed artifacts. The workflow engine knows exactly where every unit of work stands because it's the one tracking transitions. But it **delegates LLM judgment** to the conductor rather than trying to be smart itself.

---

## XState v5 Implementation Notes

The workflow engine uses XState v5 (not v4). Key API patterns:

### Machine Definition via `setup()`

```typescript
import { setup, assign, fromPromise } from "xstate"

const workflowMachine = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as
      | { type: "context.loaded" }
      | { type: "route.decided"; route: "incremental" | "fast-forward"; reasoning: string }
      | { type: "artifact.ready"; artifactType: string }
      // ... full event union
  },
  guards: {
    isIncremental: ({ context }) => context.route === "incremental",
    isFastForward: ({ context }) => context.route === "fast-forward",
    preconditionsPassed: ({ context }) => context.preconditionResults?.allPassed === true,
  },
  actors: {
    checkWorktreeClean: fromPromise(async ({ input }) => { /* shell out to git */ }),
    createAgentSession: fromPromise(async ({ input }) => { /* shell out to agent-deck */ }),
    reconcileView: fromPromise(async ({ input }) => { /* cmux socket commands */ }),
    // ... all async operations as named actors
  },
  actions: {
    // Only synchronous, infallible operations
    assignRoute: assign({ route: ({ event }) => event.route }),
    incrementReviewRound: assign({ reviewRound: ({ context }) => context.reviewRound + 1 }),
  }
}).createMachine({ /* states, transitions */ })
```

### Build-Time Composition

Machine structure is frozen after `createMachine()`. To compose:
- Merge config objects **before** calling `setup()` (structural changes)
- Use `.provide()` at actor creation to swap implementations (behavioral changes)

```typescript
// Override guard thresholds or action implementations per project
const actor = createActor(workflowMachine.provide({
  guards: {
    meetsComplexityThreshold: ({ context }) => context.complexity <= projectConfig.maxComplexity
  }
}))
```

### Persistence and Rehydration

```typescript
// Persist
const snapshot = actor.getPersistedSnapshot()  // includes value, context, historyValue, children
writeFileSync(path, JSON.stringify(snapshot))

// Rehydrate
const restored = JSON.parse(readFileSync(path))
const actor = createActor(workflowMachine, { snapshot: restored })
actor.start()
```

### Available Transitions via `snapshot.can()`

```typescript
// Check if an event would cause a transition (evaluates synchronous guards)
const canApprove = actor.getSnapshot().can({ type: "review.approved" })
```

This powers `workflow.status()` → `availableTransitions`. Note: it only evaluates synchronous guards — async preconditions are not factored in.

### Event Broadcasting via `emit`

XState v5 actors can `emit` events to external subscribers. The engine uses this for SSE broadcasting to CLI clients:

```typescript
actor.on("stateChange", (event) => {
  sseClients.forEach(client => client.send(event))
})
```

---

## Open Questions

1. **Schema-to-definition mapping.** Is there a 1:1 relationship between an OpenSpec schema and a workflow definition? Or can multiple schemas share a workflow definition with different artifact configurations?

2. **Conductor scaling.** One conductor per profile works for moderate workloads. At high parallelism (20+ workflow instances), does the conductor become a bottleneck? Could we have conductor pools?

3. **View config authoring.** Who writes view configs — the workflow definition author, the project-level config, or both with merging? A default view config in the definition with project-level overrides seems right.

4. **Dynamic pane content.** Beyond browser URLs, should agents be able to request arbitrary pane changes (e.g., "show me the test output in the right pane")? Or is that over-engineering for now?

5. **Workflow instance cleanup.** When a workflow completes, the engine cleans up managed sessions. But what about the agent-deck sessions and worktree? Merge-then-delete? Keep for a cooldown period? Configurable?

6. **Offline / disconnected mode.** If the daemon crashes, agent sessions keep running (they're in tmux). On restart, the engine rehydrates from persisted state. But any events fired during downtime are lost. Is that acceptable, or do we need an event journal?
