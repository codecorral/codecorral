# CodeCorral Workflow Engine — System Contracts

Defines the interfaces between bounded contexts identified in the domain model. Each contract specifies the protocol, data shapes, and guarantees that both sides must honor. Contracts are the **stable seams** — internals can change freely as long as these hold.

All CLI commands and socket methods in this document have been validated against the actual tool interfaces as of 2026-03-20.

---

## Contract Map

```
                    ┌──────────────────────────────────────┐
                    │         WORKFLOW ENGINE               │
                    │                                       │
                    │  Runtime contracts:                   │
                    │    C1 (consumer)  — agent-deck        │
                    │    C2 (consumer)  — cmux              │
                    │    C6 (provider)  — MCP tools         │
                    │    C7 (bidirectional) — conductor     │
                    │    C8 (internal)  — daemon lifecycle  │
                    │                                       │
                    │  Conformist dependencies:             │
                    │    C3 (openspec — read schema only)   │
                    │    C4 (schema YAML — build time)      │
                    └──┬─────────┬──────────┬──────────────┘
                       │         │          │
              C1,C6,C7 │    C2   │   C3,C4
                       │         │  (read)
              ┌────────┴──┐  ┌───┴────┐  ┌───────────┐
              │ Session   │  │Developer│  │ Change    │
              │ Management│  │ Surface │  │ Mgmt      │
              │(agent-deck)│  │ (cmux)  │  │(openspec) │
              └─────┬─────┘  └────────┘  └───────────┘
                    │                         ↑
              ┌─────┴─────────┐               │ agents use
              │ Conductor     │               │ opsx cmds
              │ (agent-deck   │     ┌─────────┴──┐
              │  conductor    │     │ Agent       │
              │  subsystem)   │     │ Sessions    │
              └─────┬─────────┘     └────────────┘
                    │
                    │ C5: conductor talks
                    │     to board directly
              ┌─────┴─────────┐
              │ Task Board    │
              │ (GitHub, Linear│
              │  Jira, local) │
              └───────────────┘
```

---

## C1: Engine → Session Management (agent-deck)

**Relationship:** Customer-Supplier (engine is customer)
**Protocol:** agent-deck CLI v0.8.x
**Direction:** Engine sends commands, receives JSON responses + exit codes

### Operations Mapped to Actual CLI

```typescript
interface SessionManagementContract {
  // Create + start a session with worktree, initial message, and MCP
  launchSession(params: LaunchSessionParams): Promise<SessionRef>

  // Send a message to a running session's conversation
  sendMessage(params: SendMessageParams): Promise<void>

  // Stop a session (retain record for later removal)
  stopSession(title: string): Promise<void>

  // Remove a session record entirely (only after workflow completion)
  removeSession(title: string): Promise<void>

  // Query session details (worktree path, status, etc.)
  showSession(title: string): Promise<SessionInfo>

  // Get last response from a session
  getOutput(title: string): Promise<string>

  // Attach an MCP server to a session (then restart)
  attachMcp(title: string, mcpName: string): Promise<void>

  // Set parent-child relationship
  setParent(childTitle: string, parentTitle: string): Promise<void>
}
```

### Implementation — Actual CLI Commands

```bash
# Create + start + send initial message in one step
agent-deck launch "$WORK_PATH" \
  -t "$SESSION_TITLE" \
  -c claude \
  -p "$PARENT_SESSION" \
  -g "$GROUP_PATH" \
  -w "$BRANCH" -b \
  --location subdirectory \
  --mcp workflow-engine \
  -m "$INITIAL_MESSAGE" \
  --json

# Send a message to a running session
agent-deck session send "$SESSION_TITLE" "$MESSAGE" --json

# Get session details (worktree path, status, tool, MCPs)
agent-deck session show "$SESSION_TITLE" --json

# Get last response from session
agent-deck session output "$SESSION_TITLE" --json

# Stop a session (retains record)
agent-deck session stop "$SESSION_TITLE"

# Remove a session entirely
agent-deck remove "$SESSION_TITLE"

# Attach MCP server then restart to pick it up
agent-deck mcp attach "$SESSION_TITLE" "$MCP_NAME"
agent-deck session restart "$SESSION_TITLE"

# Set parent-child relationship manually
agent-deck session set-parent "$CHILD_TITLE" "$PARENT_TITLE"

# List all sessions (for discovery/cleanup)
agent-deck list --json

# Worktree info for a session
agent-deck worktree info "$SESSION_TITLE"

# Clean up orphaned worktrees
agent-deck worktree cleanup --force
```

### Data Shapes

```typescript
type LaunchSessionParams = {
  workPath: string             // project directory
  title: string                // deterministic name (see naming convention below)
  tool: "claude"               // agent-deck tool name
  group?: string               // group path (e.g., "codecorral/hm-agent-deploy")
  parentSession?: string       // parent session title (for conductor linking)
  worktreeBranch: string       // git branch for isolation
  newBranch: boolean           // true = create new branch (-b flag)
  worktreeLocation: "subdirectory" | "sibling" | string
  mcpServers: string[]         // MCP names to attach (repeatable --mcp flag)
  initialMessage: string       // message sent once agent is ready (-m flag)
}

// JSON output from `agent-deck session show --json`
type SessionInfo = {
  id: string                   // 8-char hex + timestamp
  title: string
  status: "waiting" | "running" | "idle" | "error" | "stopped"
  path: string                 // working directory
  tool: string
  group: string
  claudeSessionId?: string
  tmuxSessionName: string      // format: agentdeck_{sanitized_title}_{8hex}
  attachedMcps: McpAttachment[]
  worktree?: {
    branch: string
    path: string
  }
}

type McpAttachment = {
  name: string
  scope: "local" | "global" | "project"
}
```

### Session Naming Convention (D1, D6)

Session **titles** are deterministic — derived from workflow identity. Agent-deck generates its own internal tmux session names (`agentdeck_{sanitized}_{hex}`), but we reference sessions by title.

```
Title pattern:
  cc-{workflowId}-{phase}           (phase-specific agent session)
  cc-{workflowId}-conductor         (conductor, workflow-wide)

Examples:
  cc-hm-deploy-elaboration
  cc-hm-deploy-implementation
  cc-hm-deploy-review
  cc-hm-deploy-conductor

Constraints:
  - Max 60 characters (tmux limit safety with agentdeck_ prefix + 9-char suffix)
  - Characters: [a-z0-9-] only (agent-deck sanitizes others to hyphens)
  - workflowId must be pre-sanitized by the engine
```

Discovery: `agent-deck list --json | jq '.[] | select(.title | startswith("cc-{workflowId}"))'`

### Child Session Lifecycle (D11)

Agent-deck tracks parent-child via `--parent` / `set-parent` but has **no atomic recursive stop**. The engine must implement this:

```
engine.stopSessionTree(title):
  children = list --json | filter(parent == title)
  for child in children:
    engine.stopSessionTree(child.title)   // recursive
  agent-deck session stop title
```

### Guarantees

| Provider (agent-deck) | Consumer (Engine) |
|---|---|
| Session titles are unique per profile | Titles follow the `cc-{id}-{phase}` convention |
| `session show --json` returns worktree path and status | Engine queries rather than caching |
| `launch` with `-m` waits for agent readiness before sending | Engine relies on initial message delivery |
| Stopped sessions retain records until `remove` | Engine removes only after workflow completion |
| `AGENT_DECK_SESSION_ID` env var set inside sessions | Enables auto-parent linking when conductor creates sub-sessions |
| Exit code 0 = success, 1 = error, 2 = not found | Engine interprets exit codes for error handling |
| `--json` output is stable within minor versions | Engine parses JSON output |

### Conductor Sessions (D13)

The conductor is **not** a regular agent-deck session — it uses a dedicated `conductor` subsystem with substantially more infrastructure. See **C7** for the full conductor lifecycle contract.

Agent-deck's conductor subsystem creates:
- Two-tier CLAUDE.md / POLICY.md (shared + per-conductor)
- Heartbeat daemon, bridge daemon (Telegram/Slack/Discord), transition notification daemon
- LEARNINGS.md for persistent orchestration patterns
- Auto-parent linking for child sessions

The engine interacts with conductors via `agent-deck conductor setup/teardown/status` (not regular `launch`/`remove`), and communicates via `session send` (the same as regular sessions). The critical difference is the **transition notification daemon**, which provides a second feedback path — child sessions automatically notify the conductor of status changes without going through the engine.

---

## C2: Engine → Developer Surface (cmux)

**Relationship:** Customer-Supplier (engine is customer)
**Protocol:** Unix domain socket (JSON-RPC) + CLI
**Socket:** `/tmp/cmux.sock` (default), configurable via `CMUX_SOCKET_PATH`
**Direction:** Engine sends layout and notification commands

### cmux Hierarchy

```
Window → Workspace (sidebar tab) → Pane (split region) → Surface (tab within pane) → Panel (terminal | browser | markdown)
```

The engine maps its domain concepts to cmux's hierarchy:

| Engine Concept | cmux Primitive |
|---|---|
| Profile/Project | Window |
| **Workflow instance** | **Workspace** (one workspace per workflow, persists across all phases) |
| Agent session view | Surface (terminal panel) |
| Ancillary view (git diff, tuicr) | Surface (terminal panel, split) |
| PR page, docs | Surface (browser panel) |
| Review notification | Notification |
| Phase status | Sidebar status pill (updated on phase change, not recreated) |

**Critical:** A workflow instance maps to **one workspace** for its entire lifetime. Phase transitions update the workspace's contents (rename, reconcile surfaces, update status pills) — they do **not** create new workspaces. The workspace title, surfaces, and sidebar metadata change as the phase changes, but the workspace itself is stable.

```
Workflow: hm-deploy
  Phase: Elaboration    →  Workspace "hm-deploy — Elaborating" (workspace:3)
  Phase: Review         →  same workspace:3, renamed to "hm-deploy — Review", surfaces reconciled
  Phase: Implementation →  same workspace:3, renamed to "hm-deploy — Implementing", surfaces reconciled
  Phase: Complete       →  workspace:3 closed
```

This means the sidebar tab stays in the same position, the user's muscle memory for switching to it is preserved, and any user customizations to that workspace (additional splits they created) survive phase transitions.

### Operations — Actual cmux API

The engine uses cmux's **primitive operations** to compose views. There is no high-level `applyView` — the engine builds it from these primitives:

```typescript
interface DeveloperSurfaceContract {
  // --- Workspace lifecycle ---
  createWorkspace(): Promise<WorkspaceRef>
  selectWorkspace(workspaceId: string): Promise<void>
  renameWorkspace(workspaceId: string, name: string): Promise<void>
  closeWorkspace(workspaceId: string): Promise<void>
  listWorkspaces(): Promise<WorkspaceRef[]>

  // --- Pane/Surface management ---
  splitSurface(direction: "right" | "down" | "left" | "up"): Promise<SurfaceRef>
  sendText(surfaceId: string, text: string): Promise<void>
  focusSurface(surfaceId: string): Promise<void>
  listSurfaces(): Promise<SurfaceRef[]>

  // --- Browser panes ---
  openBrowserSplit(url?: string): Promise<SurfaceRef>
  navigateBrowser(surfaceId: string, url: string): Promise<void>
  getBrowserUrl(surfaceId: string): Promise<string>

  // --- Sidebar metadata ---
  setStatus(key: string, value: string, icon?: string, color?: string): Promise<void>
  clearStatus(key: string): Promise<void>
  setProgress(value: number, label?: string): Promise<void>
  clearProgress(): Promise<void>
  logMessage(message: string, level: LogLevel): Promise<void>

  // --- Notifications ---
  notify(title: string, body: string, subtitle?: string): Promise<void>
  clearNotifications(): Promise<void>

  // --- Introspection ---
  identify(): Promise<FocusedContext>
  sidebarState(workspaceId?: string): Promise<SidebarSnapshot>
}

type LogLevel = "info" | "progress" | "success" | "warning" | "error"
```

### Implementation — Socket JSON-RPC

```python
import json, socket, os

SOCKET_PATH = os.environ.get("CMUX_SOCKET_PATH", "/tmp/cmux.sock")

def cmux_rpc(method: str, params: dict = {}, req_id: int = 1) -> dict:
    payload = {"id": req_id, "method": method, "params": params}
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
        sock.connect(SOCKET_PATH)
        sock.sendall(json.dumps(payload).encode("utf-8") + b"\n")
        return json.loads(sock.recv(65536).decode("utf-8"))
```

```python
# Create a workspace for a workflow phase
cmux_rpc("workspace.create")
# Rename it
cmux_rpc("workspace.rename", {"workspace_id": "workspace:3", "name": "hm-deploy — Elaboration"})

# Split pane and send command to run tuicr
cmux_rpc("surface.split", {"direction": "right"})
cmux_rpc("surface.send_text", {"surface_id": "surface:5", "text": "tuicr /path/to/worktree\n"})

# Open browser pane for PR
cmux_rpc("browser.open_split", {"url": "https://github.com/org/repo/pull/42"})

# Navigate existing browser pane
cmux_rpc("browser.navigate", {"surface_id": "surface:7", "url": "https://new-url.com"})

# Set sidebar status pills
cmux_rpc("set_status", {"key": "phase", "value": "Elaborating", "icon": "pencil"})
cmux_rpc("set_status", {"key": "branch", "value": "feat/hm-deploy", "icon": "git-branch"})
cmux_rpc("set_progress", {"value": 0.4, "label": "2/5 artifacts"})

# Send notification
cmux_rpc("notification.create", {
    "title": "Review Needed",
    "subtitle": "hm-deploy",
    "body": "Proposal artifact ready for review"
})

# Log to sidebar
cmux_rpc("log", {"message": "Entered review phase", "level": "info"})

# Identify focused context
cmux_rpc("system.identify")
# Returns: { window_id, workspace_id, surface_id }
```

### Implementation — CLI Equivalent

```bash
SOCK="${CMUX_SOCKET_PATH:-/tmp/cmux.sock}"

# Workspace management
cmux new-workspace
cmux rename-workspace --workspace "$WS_ID" "hm-deploy — Elaboration"
cmux select-workspace --workspace "$WS_ID"
cmux close-workspace --workspace "$WS_ID"
cmux list-workspaces --json

# Surface/split management
cmux new-split right
cmux new-split down
cmux send-surface --surface "$SURFACE_ID" "tuicr /path/to/worktree"
cmux focus-surface --surface "$SURFACE_ID"
cmux list-surfaces --json

# Browser
cmux browser open-split "https://github.com/org/repo/pull/42"
cmux browser "$SURFACE_ID" goto "https://new-url.com"
cmux browser "$SURFACE_ID" url

# Sidebar metadata
cmux set-status phase "Elaborating" --icon pencil
cmux set-status branch "feat/hm-deploy" --icon git-branch
cmux set-progress 0.4 --label "2/5 artifacts"
cmux clear-progress
cmux log "Entered review phase" --level info

# Notifications
cmux notify --title "Review Needed" --subtitle "hm-deploy" --body "Proposal ready"
cmux clear-notifications
cmux list-notifications --json

# In-band notifications from terminal processes (OSC sequences)
printf '\e]777;notify;Review Needed;Proposal artifact ready\a'

# Introspection
cmux identify --json
cmux sidebar-state --json
```

### View Engine (Engine-Side Abstraction)

cmux provides primitives, not declarative views. The engine implements a **view engine** layer that reconciles against **its own last-applied state**, never against cmux's actual state.

#### Why: Own-State Reconciliation (D23)

The engine must not query cmux to discover what exists and then diff against that. If it did, any workspace, split, or browser tab the **user** created manually would appear as "unknown" and risk being closed on the next transition. Instead:

1. The engine maintains a `ViewState` record per workflow instance — the **engine-managed subset** of cmux
2. On transition, the engine diffs the **previous engine-managed state** against the **new desired state**
3. It issues only create/close/navigate commands for the delta
4. User-created workspaces, surfaces, and browser tabs are completely invisible to the engine — they exist in cmux but not in the engine's `ViewState`, so they're never touched

```
┌─────────────────────────────────────────────────┐
│                  cmux (actual)                   │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────┐ │
│  │ user's tab 1 │  │ ENGINE-OWNED │  │ user's │ │
│  │ (invisible   │  │ workspace    │  │ tab 2  │ │
│  │  to engine)  │  │              │  │        │ │
│  └──────────────┘  └──────────────┘  └────────┘ │
└─────────────────────────────────────────────────┘
                          ↑
                    engine only sees
                    and manages this
```

#### Data Shapes

```typescript
// Engine-internal, NOT a cmux API
type ViewState = {
  workspaceId: string | null   // cmux workspace ref (e.g., "workspace:3")
  workspaceName: string
  surfaces: ManagedSurface[]
  statusPills: Record<string, { value: string; icon?: string; color?: string }>
  progress?: { value: number; label: string }
}

type ManagedSurface = {
  role: string                 // engine-assigned role (e.g., "agent", "gitdiff", "browser")
  surfaceId: string | null     // cmux surface ref (e.g., "surface:5"), null = not yet created
  type: "terminal" | "browser"
  splitDirection: "right" | "down"
  // terminal:
  command?: string             // sent via send_text on creation
  // browser:
  url?: string
}
```

#### Reconciliation Algorithm

The workspace is created once (on workflow start) and reused for all phases. Phase transitions only rename and reconcile contents.

```
reconcile(previous: ViewState, desired: ViewState):

  // 1. Workspace: create once per workflow, rename on phase change
  if previous.workspaceId is null:
    create workspace → store workspaceId       ← only happens once per workflow
  if previous.workspaceName ≠ desired.workspaceName:
    rename workspace                           ← happens on every phase transition

  // 2. Surfaces: diff by role
  for role in previous.surfaces where role NOT in desired.surfaces:
    close surface (using stored surfaceId)      ← only closes engine-owned
  for role in desired.surfaces where role NOT in previous.surfaces:
    create split → store surfaceId
    if terminal: send_text(command)
    if browser: navigate(url)
  for role in BOTH:
    if browser and url changed: navigate(new url)
    if terminal and command changed: send_text(new command)

  // 3. Status pills: set changed, clear removed
  for key in previous.statusPills where key NOT in desired.statusPills:
    clear_status(key)
  for key in desired.statusPills where value ≠ previous:
    set_status(key, value, icon, color)

  // 4. Progress: update or clear
  if desired.progress ≠ previous.progress:
    set_progress or clear_progress

  // 5. Persist new ViewState to workflow instance context
  instance.viewState = desired (with resolved surfaceIds)
```

#### Recovery After cmux Restart

cmux surface IDs are session-scoped — they reset when cmux restarts. The engine detects this when a cmux command targeting a stored surfaceId returns an error. Recovery:

1. Set `viewState.workspaceId = null` and all `surfaceId = null`
2. Re-run reconciliation — this creates everything fresh
3. User-created tabs are unaffected (they're restored by cmux's own session persistence)

The engine does **not** attempt to match restored surfaces to its stored IDs. A clean rebuild is simpler and more reliable.

### Environment Variables

Processes inside cmux get `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` automatically. The engine uses these for self-identification when running inside cmux.

### Socket Access Mode

The engine needs `CMUX_SOCKET_MODE=allowAll` if the engine daemon runs outside cmux (likely). If the engine runs inside a cmux terminal, the default `cmuxOnly` mode suffices.

### Guarantees

| Provider (cmux) | Consumer (Engine) |
|---|---|
| Socket accepts JSON-RPC at `/tmp/cmux.sock` | Engine connects per-request (one request per connection) |
| Workspace/surface IDs (refs) are stable for the lifetime of the app session | Engine stores IDs in its own ViewState, never queries cmux to discover what exists |
| Commands targeting a non-existent ID return an error (not silent no-op) | Engine uses errors to detect cmux restart and trigger recovery |
| Notifications follow lifecycle: received → unread → read → cleared | Engine can query `list-notifications` |
| `CMUX_WORKSPACE_ID` / `CMUX_SURFACE_ID` env vars set in child processes | Agents can self-identify their surface |
| Browser panes support navigation without recreating the surface | Engine calls `browser.navigate` to update URLs |
| cmux never closes or modifies surfaces it didn't create | Engine never closes or modifies surfaces it didn't create — both sides respect ownership |

---

## C3: OpenSpec — Conformist Dependency (Not a Runtime Contract)

**Relationship:** Conformist — the engine reads OpenSpec's schema structure but does not command OpenSpec at runtime. All artifact operations (create, write, verify, archive) are performed by **agents** via opsx slash commands.

### What the Engine Does with OpenSpec

| When | What | How |
|---|---|---|
| Startup / definition load | Read schema metadata (artifact IDs, dependency graph, output paths) | Parse schema YAML files or `openspec schemas --json` |
| Precondition checks | Check if a specific artifact is done | Invoke `openspec status --change X --json` as a `fromPromise` precondition service |
| Precondition checks | Check if all tasks are complete | Invoke `openspec instructions apply --change X --json` |

### What the Engine Does NOT Do

The engine does not call `openspec new change`, `openspec instructions`, `openspec archive`, or write any artifact files. These are all agent operations via opsx slash commands. See the [system context document](system-context.md) for the full interaction diagram.

### Precondition Check Data Shapes

The engine only parses two `openspec` responses:

```typescript
// openspec status --change X --json (used by checkArtifactExists precondition)
type ChangeStatus = {
  changeName: string
  schemaName: string
  isComplete: boolean
  artifacts: { id: string; outputPath: string; status: "done" | "ready" | "blocked" }[]
}

// openspec instructions apply --change X --json (used by checkTasksComplete precondition)
type ApplyStatus = {
  progress: { total: number; complete: number; remaining: number }
  state: "ready" | "blocked" | "all_done"
}
```

### Schema Resolution Order (D19)

```
1. Project:  openspec/schemas/{name}/schema.yaml       (highest priority)
2. User:     ~/.local/share/openspec/schemas/{name}/schema.yaml
3. Package:  node_modules/@fission-ai/openspec/schemas/{name}/  (lowest priority)
```

### Guarantees

| Provider (openspec) | Consumer (Engine) |
|---|---|
| Schema YAML structure is stable within a named version | Engine caches schema metadata at startup |
| `status --json` accurately reflects artifact file existence | Engine uses as precondition input |
| `instructions apply --json` accurately reports task completion | Engine uses as precondition input |
| `--json` output shape is stable within minor versions | Engine parses JSON for precondition checks |
| Schema resolution order is deterministic | Engine can predict which schema wins |

---

## C4: Change Management → Engine (Schema Context)

**Relationship:** Published Language
**Protocol:** File system (schema YAML) + `openspec schemas --json`
**Direction:** Engine reads schema structure to know what artifacts to expect

### Data Shape

The engine reads schema metadata via CLI or directly from YAML:

```yaml
# openspec/schemas/{name}/schema.yaml (actual format)
name: spec-driven
version: "1.0"
description: "Default OpenSpec workflow"
artifacts:
  - id: proposal
    generates: proposal.md
    description: "Initial proposal document"
    template: templates/proposal.md
    instruction: instructions/proposal.md
    requires: []
  - id: specs
    generates: "specs/**/*.md"
    description: "Specification documents"
    template: templates/spec.md
    instruction: instructions/specs.md
    requires: [proposal]
  - id: design
    generates: design.md
    description: "Technical design document"
    template: templates/design.md
    instruction: instructions/design.md
    requires: [proposal]
  - id: tasks
    generates: tasks.md
    description: "Implementation task list"
    template: templates/tasks.md
    instruction: instructions/tasks.md
    requires: [specs, design]
apply:
  requires: [tasks]
```

```typescript
// TypeScript representation
type SchemaDefinition = {
  name: string
  version: string
  description: string
  artifacts: ArtifactDefinition[]
  apply: { requires: string[] }
}

type ArtifactDefinition = {
  id: string
  generates: string            // output path pattern (may include globs)
  description: string
  template: string             // relative path to template file
  instruction: string          // relative path to instruction file
  requires: string[]           // artifact IDs that must be "done" first
}
```

### Relationship to Workflow Definitions (D22)

Multiple schemas can share the same workflow definition. The schema defines **what artifacts exist and their dependencies**. The workflow definition defines **what states exist and their transitions**. The engine reads the schema to configure guards (`artifactExists`) and to know which `openspec instructions` call to make, but the schema does not know about the workflow.

### Guarantees

| Provider (openspec) | Consumer (Engine) |
|---|---|
| Schema YAML structure is stable within a named version | Engine caches per version |
| `generates` patterns match what `status` reports in `outputPath` | Engine uses them for `artifactExists` guard |
| `requires` graph is a DAG (no cycles) | Engine can topologically sort artifacts |
| `openspec schemas --json` lists all resolved schemas | Engine discovers available schemas at startup |

---

## C5: Task Board (Conductor's Domain, Not Engine's)

**Relationship:** The board is the **conductor's** responsibility, not the engine's. The conductor interacts with external boards (GitHub Issues, Linear, Jira) directly using LLM judgment and standard tools (`gh`, API clients, filesystem). The engine has no board adapter and no board concept at runtime.

### Why Not an Engine Contract

The original design had a `BoardAdapter` interface as an engine concept. This is wrong for two reasons:

1. **Board interaction requires judgment.** The conductor decides *when* to poll, *which* items are suitable, and *how* to interpret them. This is LLM work — exactly what the conductor exists for.
2. **The conductor already has the tools.** It runs Claude Code with access to `gh`, API tokens, and filesystem. Adding an engine-side adapter would duplicate capability and add a runtime contract that doesn't earn its complexity.

### How It Actually Works

```
Conductor (LLM)
  ├── Polls GitHub Issues:  gh issue list --label "unit-brief" --state open --json
  ├── Polls Linear:         Linear API / MCP
  ├── Polls local FS:       glob("openspec/changes/*/units/*/unit-brief.md")
  ├── Evaluates suitability (LLM judgment)
  ├── Pulls item:           gh issue edit N --add-label "in-progress" (or equivalent)
  └── Starts workflow:      workflow.transition("workflow.pull", { unitBriefRef: {...} })
                            ↓
                    Engine creates workflow instance
```

The conductor also updates board status on workflow completion:
- `workflow.complete` → conductor marks item done on the board
- `workflow.abort` → conductor marks item failed on the board

### What the Engine Knows

The engine receives a `unitBriefRef` in the `workflow.pull` event payload:

```typescript
type UnitBriefRef = {
  source: string               // "github-issues", "linear", "local", "manual", etc.
  externalId: string | null    // issue number, Linear ID, etc.
  path: string                 // local path to brief content
  title: string                // brief title (for display)
}
```

The engine stores this in the workflow instance context for display and traceability. It does **not** interact with the source system — that's the conductor's job.

### Board Configuration

Board configuration lives in the **conductor's CLAUDE.md/POLICY.md**, not in the engine config:

```markdown
# In conductor POLICY.md (or per-workspace override via Nix flake)

## Board Polling
- Poll GitHub Issues in `codecorral/hm-project` with label `unit-brief` every 10 minutes
- For Linear: check project "INGEST" for unassigned items
- Prefer items labeled `priority:high` over others
- Do not pull more than 2 items concurrently per profile
```

This is LLM-interpreted guidance, not a programmatic config file. Different workspaces can have different polling behavior by customizing the conductor's policy.

### `codecorral pull` Delegation

When a human runs `codecorral pull ./path/to/brief.md`, the engine delegates to the conductor:

```
Human: codecorral pull ./path/to/brief.md
  → Engine: agent-deck session send "conductor-X" "The developer wants to start a
      workflow for the brief at ./path/to/brief.md. Evaluate it and call
      workflow.transition('workflow.pull', {unitBriefRef: ...})."
  → Conductor: reads brief, evaluates, calls workflow.transition()
  → Engine: creates workflow instance, starts elaboration
```

This keeps the conductor as the **single entry point** for all new workflows, whether from CLI, board polling, or external messaging.

---

## C6: Agent Sessions → Engine (MCP Events)

**Relationship:** Event Publisher
**Protocol:** MCP tools exposed by the engine daemon
**Direction:** Agents in sessions call engine tools; hooks and CLI also fire events

### MCP Tools (Agent → Engine)

```typescript
interface WorkflowMcpTools {
  "workflow.transition"(params: {
    event: string
    payload?: Record<string, unknown>
  }): Promise<TransitionResult>

  "workflow.status"(): Promise<WorkflowStatus>

  "workflow.context"(): Promise<WorkflowContext>

  "workflow.setBrowserUrl"(params: {
    url: string
    paneRole?: string
  }): Promise<void>
}
```

### CLI Commands (Human → Engine)

```bash
# Status and inspection
codecorral status                          # all active instances
codecorral status <id>                     # specific instance
codecorral history <id>                    # show event log

# Review decisions
codecorral approve [--ff]                  # approve current review
codecorral revise --feedback "..."         # request changes
codecorral abort <id>                      # cancel workflow
codecorral skip <id>                       # skip current phase

# Pull — delegates to the conductor
codecorral pull <unit-brief-ref>           # instructs conductor to start a workflow
codecorral pull --next                     # instructs conductor to pull next from board
```

**`codecorral pull` delegates to the conductor** — it does not create the workflow instance directly. The conductor receives the instruction, evaluates the brief (LLM judgment), and calls `workflow.transition("workflow.pull", ...)` back to the engine. This keeps the conductor as the single entry point for new workflows, whether triggered by human CLI, board polling, or external messaging.

### Hook Events

Claude Code hooks and git hooks can fire transitions via CLI:

```bash
codecorral transition tests.passed --instance "$INSTANCE_ID"
codecorral transition pr.created --instance "$INSTANCE_ID" --payload '{"url":"..."}'
```

**Design note:** Hooks fire events regardless of the current workflow state. If the state machine has no transition defined for that event in the current state, the event is **rejected** (`accepted: false`) and nothing happens. This means hooks like `tests.passed` can fire freely — they're only meaningful when the machine is in a state that expects them. The hook doesn't need to know the workflow state; it just reports what happened.

### Data Shapes

```typescript
type TransitionResult = {
  accepted: boolean
  newState: string | null
  phase: string | null
  message: string
}

type WorkflowStatus = {
  instanceId: string
  definitionId: string
  currentState: string
  phase: string
  availableTransitions: AvailableTransition[]
}

type AvailableTransition = {
  event: string
  targetState: string
  guards: string[]             // sync guard names only
  preconditions: string[]      // async precondition names (not pre-evaluated)
  canFire: boolean             // from snapshot.can() — evaluates sync guards only
}

type WorkflowContext = {
  instanceId: string
  profileId: string
  worktreePath: string | null
  changeName: string | null
  currentArtifact: string | null
  route: "incremental" | "fast-forward" | null
  reviewRound: number
  sessionTitles: Record<string, string | null>  // role → agent-deck session title
}
```

### Instance Discovery (How Agents Know Their Instance)

The engine injects `WFE_INSTANCE_ID` as an environment variable when creating sessions via C1. The MCP server reads this to scope `workflow.status()` and `workflow.transition()` to the correct instance.

Additionally, the agent can derive its instance from its session title (`cc-{workflowId}-{phase}` → extract `workflowId`).

### Event Catalog

XState v5 uses `type` as the discriminant property with payload fields flattened (not nested under `payload`). The MCP/CLI external interface uses `{ event, payload }` for ergonomics — the engine translates.

```typescript
// Internal XState event shapes (used inside the machine)
type FrameworkEvent =
  // Agent-sourced (via MCP)
  | { type: "context.loaded" }
  | { type: "route.decided"; route: "incremental" | "fast-forward"; reasoning: string }
  | { type: "artifact.ready"; artifactType: string }
  | { type: "impl.complete" }
  | { type: "verification.result"; passed: boolean; issues: string[] }
  | { type: "learnings.captured" }
  // Human-sourced (via CLI)
  | { type: "review.approved"; ff?: boolean }
  | { type: "review.revised"; feedback: string }
  | { type: "workflow.pull"; unitBriefRef: UnitBriefRef }
  | { type: "workflow.abort" }
  | { type: "workflow.skip" }
  // Hook-sourced (via CLI, fired by Claude Code hooks or git hooks)
  | { type: "tests.passed" }
  | { type: "tests.failed" }
  | { type: "pr.created"; url: string }
  | { type: "pr.merged" }
  | { type: "code-review.passed" }
  | { type: "code-review.failed"; issues: string[] }
```

### Event Translation Layer

The MCP tool and CLI accept `{ event: string, payload?: {} }` and the engine translates before sending to XState:

```typescript
// MCP/CLI input:  { event: "route.decided", payload: { route: "incremental", reasoning: "..." } }
// XState event:   { type: "route.decided", route: "incremental", reasoning: "..." }

function translateEvent(external: { event: string; payload?: Record<string, unknown> }): FrameworkEvent {
  return { type: external.event, ...external.payload } as FrameworkEvent
}
```

This keeps the external API simple (two fields) while using XState's native event shape internally.

### Guarantees

| Provider (Engine) | Consumer (Agent/Human/Hook) |
|---|---|
| Rejected transitions return `accepted: false` with explanation | Callers check `accepted` before proceeding |
| `workflow.status` is always available regardless of state | Agents can orient at any time |
| Events processed sequentially **per instance** (XState actor mailbox) — different instances process concurrently | Concurrent events to the same instance are safe; cross-instance resource contention is the engine's concern |
| Unknown events are rejected, not silently dropped | Callers get explicit feedback |
| MCP and CLI events are processed identically | Source doesn't affect semantics |
| `availableTransitions` uses `snapshot.can()` for sync guards only — async preconditions are not pre-evaluated | Callers should not assume all listed transitions will succeed (preconditions may fail) |

---

## C7: Engine ↔ Conductor (Lifecycle + Delegation)

**Relationship:** Symbiotic — the engine delegates LLM work to the conductor; the conductor uses engine MCP tools for state transitions. Agent-deck's conductor subsystem provides the infrastructure.
**Protocol:** `agent-deck conductor setup/teardown/status` (lifecycle), `agent-deck session send` (instruction), MCP `workflow.transition` (feedback)
**Direction:** Bidirectional

### The Conductor Is Not a Regular Session

Agent-deck provides a first-class `conductor` subsystem that is architecturally different from regular sessions. The engine must use the conductor-specific CLI, not `launch`/`remove`.

| Aspect | Regular Session | Conductor |
|---|---|---|
| Create | `agent-deck launch` | `agent-deck conductor setup` |
| Destroy | `agent-deck remove` | `agent-deck conductor teardown` |
| Infrastructure | tmux session only | tmux + heartbeat daemon + bridge daemon + transition notifier |
| Instructions | None (engine injects via `-m`) | Two-tier CLAUDE.md + POLICY.md (shared + per-conductor) |
| State persistence | None beyond worktree | LEARNINGS.md survives `/clear` compaction |
| Parent-child | Optional via `--parent` | Automatic — child sessions inherit conductor as parent |
| Compaction | Default lossy summarization | `/clear` + rely on CLAUDE.md + state.json + LEARNINGS.md |

### Conductor Infrastructure (What `setup` Creates)

```
~/.agent-deck/conductor/
├── CLAUDE.md                          # Shared: CLI reference, protocols, formats
├── POLICY.md                          # Shared: auto-response rules, escalation guidelines
├── LEARNINGS.md                       # Shared: orchestration patterns
├── bridge.py                          # Bridge daemon (Telegram/Slack/Discord)
└── {conductor-name}/
    ├── CLAUDE.md                      # Per-conductor: identity, profile, startup checklist
    ├── POLICY.md                      # Per-conductor: optional override
    ├── LEARNINGS.md                   # Per-conductor: learned patterns
    ├── meta.json                      # Config: name, agent, profile, heartbeat, env
    └── heartbeat.sh                   # Heartbeat script (periodic status pings)
```

Three daemons run as system services (launchd on macOS, systemd on Linux):

| Daemon | Purpose | Managed By |
|---|---|---|
| **Heartbeat** | Periodic status pings to conductor session | Per-conductor launchd/systemd plist |
| **Bridge** | Translates Telegram/Slack/Discord ↔ `session send` | Shared across all conductors |
| **Transition Notifier** | Watches child session status changes, notifies parent | Global `agent-deck notify-daemon` |

### Lifecycle — Actual CLI Commands

```bash
# Set up conductor with engine-specific CLAUDE.md and POLICY.md
agent-deck conductor setup "$CONDUCTOR_NAME" \
  -agent claude \
  --instructions-md "$ENGINE_CLAUDE_MD_PATH" \
  --policy-md "$ENGINE_POLICY_MD_PATH" \
  --env "WFE_INSTANCE_SCOPE=profile" \
  --env "CMUX_SOCKET_PATH=/tmp/cmux.sock"

# Check conductor health (bridge, notifier, heartbeat)
agent-deck conductor status "$CONDUCTOR_NAME" --json
# Returns: { enabled, conductors: [{ name, running, heartbeat, session_id }],
#            daemon_running, notifier_daemon_running }

# Start the conductor session (after setup)
agent-deck session start "conductor-$CONDUCTOR_NAME"

# Tear down (stop session + remove daemons + optionally remove files)
agent-deck conductor teardown "$CONDUCTOR_NAME" --remove

# List all conductors
agent-deck conductor list --json
```

### Two Feedback Paths

The conductor receives information from two distinct paths. The engine must understand both:

```
Path 1: Engine → Conductor (explicit instruction)
────────────────────────────────────────────────
  agent-deck session send "conductor-X" "evaluate this brief..."
  ↓
  Conductor performs LLM work
  ↓
  Conductor calls workflow.transition() via MCP
  ↓
  Engine receives event

Path 2: Child Sessions → Conductor (automatic notification)
──────────────────────────────────────────────────────────
  Child session transitions: running → waiting/error/idle
  ↓
  Transition notifier daemon detects change
  ↓
  Notifier sends to parent (conductor):
    "[EVENT] Child 'cc-hm-deploy-elaboration' (abc123) is waiting.
     Check: agent-deck session output abc123 -q"
  ↓
  Conductor auto-responds or escalates per POLICY.md
  ↓
  Conductor may call workflow.transition() or session send
```

**Path 2 is critical.** The transition notification daemon provides the conductor with child session status changes *without* the engine being in the loop. The conductor's POLICY.md determines what happens:
- `waiting` → auto-respond (check output, send next instruction)
- `error` → escalate to human via bridge
- `idle` → check if work is done, potentially fire `workflow.transition()`

The engine does **not** need to duplicate this notification path. It should rely on the conductor + notifier to handle child session lifecycle, and receive the result as a `workflow.transition()` event.

### Instruction Protocol

The engine instructs the conductor via `agent-deck session send`. Instructions are natural language but follow structured templates to reduce interpretation risk:

```bash
# Evaluate route
agent-deck session send "conductor-$NAME" \
  "Evaluate the unit brief at $BRIEF_PATH for workflow $WORKFLOW_ID. \
   Decide the route (incremental or fast-forward) based on complexity. \
   Call workflow.transition('route.decided', {route: '<choice>', reasoning: '<why>'})."

# Pull next brief
agent-deck session send "conductor-$NAME" \
  "Check the task board for available work items matching labels: $LABELS. \
   If one is suitable, call workflow.transition('workflow.pull', {unitBriefRef: ...})."

# Respond to agent question
agent-deck session send "conductor-$NAME" \
  "Session $SESSION_TITLE has a question: '$QUESTION'. \
   Review workflow context via workflow.status() and respond via \
   agent-deck session send '$SESSION_TITLE' '<your-response>'."

# Notify external (uses bridge daemon, not direct API)
agent-deck session send "conductor-$NAME" \
  "Review is needed for workflow $WORKFLOW_ID. \
   Notify the developer with context about what needs review."
# The conductor's bridge daemon will forward to Telegram/Slack/Discord
```

### Engine-Specific CLAUDE.md Content

The engine provides a custom CLAUDE.md for the conductor that extends agent-deck's shared CLAUDE.md:

```markdown
# Workflow Engine Conductor Instructions

You have access to the CodeCorral workflow engine MCP tools:
- workflow.status() — check current state of any workflow instance
- workflow.context() — get full context (worktree path, change name, etc.)
- workflow.transition(event, payload) — advance workflow state
- workflow.setBrowserUrl(url) — update browser pane

## Board Polling
Periodically check the task board for available work items.
When a suitable item is found, call workflow.transition("workflow.pull", {unitBriefRef: ...}).

## Auto-Response Rules
When a child session transitions to "waiting":
1. Check its output: `agent-deck session output <title> -q`
2. If the output contains a question you can answer → respond via session send
3. If the output signals completion → check workflow.status() and fire appropriate transition
4. If unsure → escalate to human via bridge

## Escalation
Never auto-respond to:
- Destructive operations (force push, delete, etc.)
- Security-sensitive decisions
- Anything outside your POLICY.md scope
```

### LEARNINGS.md and Retrospective (D24)

The conductor's LEARNINGS.md survives `/clear` compaction and persists across sessions. The engine can leverage this for D24 (post-workflow retrospective):

1. After workflow completion, the engine instructs the conductor to capture learnings
2. The conductor writes to its per-conductor LEARNINGS.md
3. Patterns accumulate across workflows and inform future routing decisions, auto-response rules, and escalation thresholds

This is the conductor's **persistent memory** — separate from the engine's event history.

### Timeout and Escalation

If the engine sends an instruction and no `workflow.transition()` arrives within a configurable timeout:

```
1. Check conductor status: agent-deck conductor status "$NAME" --json
   - If not running → restart: agent-deck session restart "conductor-$NAME"
   - If running → send reminder instruction
2. If still no response after second timeout → log timeout event + notify human via cmux
3. Fall back to human-only mode for this workflow instance
```

### Bridge Daemon Configuration

The bridge daemon is configured in agent-deck's `config.toml`, not by the engine. The engine does **not** directly interface with Telegram/Slack/Discord — it instructs the conductor, and the bridge daemon handles the external messaging.

```toml
# In agent-deck config.toml
[conductor]
enabled = true
heartbeat_interval = 15          # minutes between heartbeat pings

[conductor.telegram]
token = "bot-token"
user_id = 123456789

[conductor.slack]
bot_token = "xoxb-..."
app_token = "xapp-..."
channel_id = "C01234..."
listen_mode = "mentions"         # or "all"
allowed_user_ids = ["U12345"]

[conductor.discord]
bot_token = "discord-bot-token"
guild_id = 123456789
channel_id = 987654321
user_id = 111222333
listen_mode = "all"
```

### Guarantees

| Provider (Conductor + agent-deck) | Consumer (Engine) |
|---|---|
| `conductor setup` creates all infrastructure (daemons, CLAUDE.md, meta.json) | Engine calls `conductor setup` once per profile, not per workflow |
| `conductor status --json` reports health of all daemons | Engine checks health before relying on conductor |
| Transition notifier routes child status changes to conductor automatically | Engine does not duplicate child session monitoring |
| Bridge daemon forwards conductor responses to external channels | Engine instructs conductor to notify; bridge handles delivery |
| Conductor sessions use `/clear` compaction — LEARNINGS.md persists | Engine can instruct conductor to capture retrospective learnings |
| `session send` with `--wait --timeout` returns response | Engine can synchronously wait for conductor acknowledgment when needed |
| One conductor per profile, session titled `conductor-{name}` | Engine references conductor by this title convention |
| Child sessions auto-link to conductor as parent via `AGENT_DECK_SESSION_ID` | Engine creates workflow sessions as conductor children |

### Resolved Design Decisions

**Sessions are conductor children.** When the engine creates a workflow session via `agent-deck launch`, the conductor is the parent (`--parent "conductor-$NAME"`). This means:
- The transition notifier automatically routes child status changes to the conductor
- The conductor can auto-respond to waiting children per POLICY.md
- Agent-deck organizes sessions under the conductor, not in arbitrary groups
- The developer surface is cmux — agent-deck's organization serves agents, not humans
- This naturally supports **conductor pools** in the future: each conductor manages its own children, and the engine assigns workflows to conductors based on load

**Board interaction is the conductor's domain, not the engine's.** The conductor accesses boards directly using `gh`, API clients, and filesystem tools. There is no engine-side board adapter. See C5 for details.

### Open Questions

1. **Multiple workflows, one conductor.** The conductor serves all workflows in a profile. When it receives a child session notification, how does it know which workflow instance it belongs to? By session title convention (`cc-{workflowId}-{phase}`)? Or should the engine set `WFE_INSTANCE_ID` in the session environment? *(Leaning: session title convention is sufficient — the conductor can parse `cc-{id}-{phase}` to identify the workflow.)*

### Policy Customization via Nix Flake

Agent-deck provides two tiers of conductor policy (shared + per-conductor). CodeCorral adds a **third tier** with engine-specific instructions. Users can further customize via the **Nix flake**.

```
Tier 1: agent-deck shared          (~/.agent-deck/conductor/CLAUDE.md, POLICY.md)
  ↑ inherited via directory walk-up
Tier 2: agent-deck per-conductor    (~/.agent-deck/conductor/{name}/CLAUDE.md, POLICY.md)
  ↑ overridden at conductor setup via --instructions-md, --policy-md
Tier 3: CodeCorral engine defaults  (shipped in the CodeCorral Nix package)
  ↑ customized per-workspace via Nix flake
Tier 4: User workspace overrides    (flake configuration per workspace/profile)
```

The Nix flake produces the CLAUDE.md and POLICY.md files that get passed to `agent-deck conductor setup --instructions-md` and `--policy-md`. Users customize by overriding the flake module:

```nix
# In the user's flake.nix or home-manager config
codecorral.conductors.main = {
  # Extend the default engine CLAUDE.md
  extraInstructions = ''
    ## Project-Specific Rules
    - When elaborating for the hm-project repo, always include accessibility specs
    - Use the "strict" review template for security-sensitive changes
  '';

  # Override or extend POLICY.md
  extraPolicy = ''
    ## Custom Escalation
    - Always notify via Telegram for priority:high items
    - Auto-approve formatting-only changes without human review
  '';

  # Board polling configuration (injected into conductor POLICY.md)
  boardConfig = {
    github = { repo = "codecorral/hm-project"; labels = ["unit-brief"]; };
    pollInterval = "10m";
    maxConcurrent = 3;
  };
};
```

The flake module generates the final CLAUDE.md and POLICY.md files by merging the CodeCorral defaults with user overrides. This keeps the Nix flake as the single source of truth for per-workspace conductor configuration.

> **Non-Nix users:** For non-Nix users, the same customization should be achievable via a configuration file (e.g., `.codecorral/conductor.yaml` in the project). This is a future UX improvement to track — the Nix flake is the primary mechanism for now.

---

## C8: Engine ↔ Engine (Daemon Lifecycle)

**Relationship:** Internal protocol
**Protocol:** Unix domain socket + PID file
**Direction:** CLI client ↔ Engine daemon

### Daemon Discovery

```
~/.codecorral/
├── daemon.pid                 # PID of running daemon
├── daemon.sock                # Unix domain socket for CLI → daemon
└── daemon.log                 # Daemon stderr log
```

### CLI → Daemon Protocol

```
1. CLI checks for daemon.sock existence
2. If socket exists → connect and send JSON-RPC command
3. If socket missing → auto-start daemon, wait for socket, then connect
4. If socket exists but connection refused → stale socket, restart daemon
```

### Daemon Commands

```bash
codecorral daemon start        # explicit start (foreground or --background)
codecorral daemon stop         # graceful shutdown
codecorral daemon status       # health check
```

### State Recovery

On daemon restart:
1. Read all instance files from `~/.codecorral/instances/*.json`
2. For each instance, rehydrate the XState actor from the persisted snapshot:
   ```typescript
   const file = JSON.parse(readFileSync(path))
   const actor = createActor(getMachine(file.definitionId), { snapshot: file.xstateSnapshot })
   actor.subscribe(/* re-attach persistence subscription */)
   actor.start()
   ```
   The full snapshot includes `value` (current state), `context`, `historyValue` (for review loops), and `children` — all restored automatically by XState.
3. Reconnect to cmux socket (re-apply current views via view engine reconciliation)
4. Events fired during downtime are **lost** (no write-ahead log in v1)
5. Agents keep running in their tmux sessions — they'll get `connection refused` on MCP calls and should retry

### Guarantees

| Provider (Daemon) | Consumer (CLI/MCP clients) |
|---|---|
| Socket at `~/.codecorral/daemon.sock` when running | Clients detect via socket existence |
| Graceful shutdown persists all instance state before exit | No data loss on clean shutdown |
| PID file cleaned up on exit | Stale PID = daemon crashed |
| JSON-RPC protocol matches C6 MCP tool schemas | CLI and MCP are interchangeable paths |

---

## Cross-Cutting: Guards and Preconditions

XState v5 guards are **strictly synchronous** — they receive `({ context, event })` and return `boolean`. They cannot perform I/O, await promises, or shell out to external commands. A guard that returns a Promise would be interpreted as truthy (since a Promise is an object), causing the guard to **always pass silently**.

This means all external checks (git, openspec CLI, filesystem) must be modeled as **invoked precondition services**, not guards.

### Synchronous Guards (read context only)

```typescript
// These are actual XState guards — used in transition `guard:` fields
const guards = {
  isIncremental: ({ context }) => context.route === "incremental",
  isFastForward: ({ context }) => context.route === "fast-forward",
  allPreconditionsPassed: ({ context }) => context.preconditions?.allPassed === true,
  hasReviewFeedback: ({ context }) => context.reviewFeedback !== null,
  setupSucceeded: ({ context }) => context.setupError === null,
}
```

### Invoked Precondition Services (async, used in intermediate states)

```typescript
// These are XState actors — used in state `invoke:` fields
const preconditionActors = {
  checkWorktreeClean: fromPromise(async ({ input }: { input: { path: string } }) => {
    const { stdout } = await exec(`cd "${input.path}" && git status --porcelain`)
    if (stdout.trim() !== "") throw new Error("Worktree has uncommitted changes")
    return true
  }),

  checkHasNewCommits: fromPromise(async ({ input }: { input: { path: string; since: string } }) => {
    const { stdout } = await exec(`cd "${input.path}" && git rev-list "${input.since}"..HEAD --count`)
    if (parseInt(stdout.trim()) === 0) throw new Error("No new commits")
    return true
  }),

  checkArtifactExists: fromPromise(async ({ input }: { input: { changeName: string; artifactId: string } }) => {
    const { stdout } = await exec(`openspec status --change "${input.changeName}" --json`)
    const status = JSON.parse(stdout)
    const artifact = status.artifacts.find(a => a.id === input.artifactId)
    if (!artifact || artifact.status !== "done") throw new Error(`Artifact ${input.artifactId} not done`)
    return true
  }),

  checkTasksComplete: fromPromise(async ({ input }: { input: { changeName: string } }) => {
    const { stdout } = await exec(`openspec instructions apply --change "${input.changeName}" --json`)
    const result = JSON.parse(stdout)
    if (result.state !== "all_done") throw new Error(`${result.progress.remaining} tasks remaining`)
    return true
  }),
}
```

### Pattern: Intermediate Checking State

Instead of guarding a transition directly, the machine routes through a checking state:

```typescript
states: {
  reviewing: {
    on: {
      "review.approved": "checkingPreconditions"  // NOT directly to implementing
    }
  },

  checkingPreconditions: {
    invoke: {
      src: "checkWorktreeClean",
      input: ({ context }) => ({ path: context.worktreePath }),
      onDone: {
        target: "implementing.setup",
        actions: assign({ preconditions: { allPassed: true } })
      },
      onError: {
        target: "reviewing",  // bounce back — precondition failed
        actions: [
          assign({ preconditions: { allPassed: false, error: ({ event }) => event.error.message } }),
          "notifyPreconditionFailed"
        ]
      }
    }
  },

  // For multiple preconditions, use parallel checking:
  checkingMultiplePreconditions: {
    type: "parallel",
    states: {
      worktree: {
        initial: "checking",
        states: {
          checking: {
            invoke: { src: "checkWorktreeClean", /* ... */ onDone: "passed", onError: "failed" }
          },
          passed: { type: "final" },
          failed: { type: "final" }
        }
      },
      artifact: {
        initial: "checking",
        states: {
          checking: {
            invoke: { src: "checkArtifactExists", /* ... */ onDone: "passed", onError: "failed" }
          },
          passed: { type: "final" },
          failed: { type: "final" }
        }
      }
    },
    onDone: [
      { target: "implementing.setup", guard: "allPreconditionsPassed" },
      { target: "reviewing" }  // fallback — something failed
    ]
  }
}
```

### TOCTOU Mitigation

Precondition checks have a time gap between check and transition (smaller than the old guard model since the check is inside the machine, but still present for external state like git). Mitigation:

1. **Accept the race for non-critical checks.** The worst case is a slightly dirty worktree at phase boundary — the agent will commit as guided by its session prompt.
2. **Checks are advisory, not locks.** They catch the common case. They are not a security boundary.
3. **The invoke model is naturally better** than the guard model for TOCTOU: the check and the transition are closer together (same state entry → invoke → onDone → transition), with no other events processed in between (actor mailbox is sequential).

---

## Cross-Cutting: Workflow Instance Persistence

Instance files store the **full XState persisted snapshot** — not a hand-rolled subset of fields.

```typescript
type PersistedWorkflowInstance = {
  id: string
  definitionId: string
  unitBriefRef: UnitBriefRef
  xstateSnapshot: unknown          // opaque — from actor.getPersistedSnapshot()
  // Engine-level metadata (not part of XState state):
  history: PersistedEvent[]
  createdAt: string                // ISO 8601
  updatedAt: string
}

type UnitBriefRef = {
  source: BoardSource
  externalId: string | null
  path: string
}

type PersistedEvent = {
  event: string
  payload?: Record<string, unknown>
  source: "agent" | "human" | "hook" | "engine"
  timestamp: string
  fromState: string
  toState: string
}
```

The `xstateSnapshot` includes: `status`, `value` (current state — may be nested for compound/parallel states), `context`, `historyValue` (for history state resolution in review loops), `children` (persisted child actor snapshots), and `error`. Storing the full snapshot ensures correct rehydration via `createActor(machine, { snapshot: file.xstateSnapshot })`.

The engine derives display values for CLI and MCP responses:
- `currentState` → extracted from `xstateSnapshot.value`
- `phase` → mapped from state to phase
- `context` → `xstateSnapshot.context`

### Persistence Mechanism

The engine subscribes to each actor and persists on every state change:

```typescript
actor.subscribe((snapshot) => {
  const persisted = actor.getPersistedSnapshot()
  const file: PersistedWorkflowInstance = {
    id, definitionId, unitBriefRef,
    xstateSnapshot: persisted,
    history: appendEvent(history, snapshot),
    createdAt, updatedAt: new Date().toISOString()
  }
  writeFileAtomically(`~/.codecorral/instances/${id}.json`, JSON.stringify(file))
})
```

Persistence failure (disk full, permissions) is treated as fatal for the instance — the engine logs an error and stops processing events for that instance.

Location: `~/.codecorral/instances/{id}.json`

The engine daemon is the **sole writer** (enforced by single-process architecture — only the daemon writes, CLI/MCP clients go through the daemon).

---

## Contract Versioning Strategy

| Contract | Versioning Mechanism |
|---|---|
| C1 (Session Mgmt) | agent-deck `--json` output shape, semver CLI compatibility |
| C2 (Dev Surface) | cmux JSON-RPC method names + param shapes |
| C3 (Change Mgmt) | openspec `--json` output shape, semver CLI compatibility |
| C4 (Schema Context) | Schema `version` field in YAML |
| C5 (Task Board) | `BoardAdapter` interface version (semver) |
| C6 (MCP Tools) | MCP tool JSON schema |
| C7 (Conductor) | agent-deck `conductor` CLI compatibility + instruction templates (versioned in engine) |
| C8 (Daemon) | JSON-RPC method catalog version |

---

## XState v5 Implementation Constraints

These constraints apply across all contracts and affect how the engine implements transitions.

### Actions vs Invoked Services

All contract operations that perform I/O (C1 session commands, C2 cmux socket calls, C3 openspec CLI) must be implemented as **XState invoked service actors** (`fromPromise`), not as transition/entry/exit actions. XState v5 actions are synchronous and fire-and-forget — they cannot await results or handle errors.

| XState Mechanism | Use For | Error Handling |
|---|---|---|
| `actions` (assign, raise, sendTo) | Context updates, logging, internal events | None — actions must not fail |
| `invoke` with `fromPromise` | CLI commands, socket calls, precondition checks | `onDone` / `onError` transitions |
| `invoke` with `fromCallback` | Long-running subscriptions (cmux reconnect, SSE) | Cleanup on state exit |

This means the machine has **intermediate states** between major phases:

```
reviewing
  → "review.approved" → checkingPreconditions (invoke: checkWorktreeClean)
    → onDone → implementing.setup (invoke: createAgentSession)
      → onDone → implementing.applyingView (invoke: reconcileView)
        → onDone → implementing.working (waiting for agent events)
        → onError → implementing.working (view is non-critical)
      → onError → implementing.setupFailed (notify, retry, or abort)
    → onError → reviewing (bounce back with error)
```

### Event Shape Translation

External interfaces (MCP tools, CLI) use `{ event: string, payload?: {} }`. XState uses `{ type: string, ...flatPayload }`. The engine translates at the boundary — see C6 Event Translation Layer.

### Machine Definition via `setup()`

All machines are created via `setup({ types, guards, actors, actions }).createMachine({ states })`. The `setup()` function:
- Provides type-safe event/context/guard/action/actor definitions
- Separates machine structure from implementations
- Enables `.provide()` overrides at actor creation time

### Snapshot Persistence

The engine uses `actor.getPersistedSnapshot()` for persistence and `createActor(machine, { snapshot })` for rehydration. The snapshot is **opaque** — the engine never destructures it except for deriving display values.

---

## Implementation Sequence

```
Phase 1: Foundation
  C4 (Schema Context)     — read-only, schema YAML already exists
  C6 (MCP Tools)          — core engine MCP server + daemon (C8)
  C8 (Daemon Lifecycle)   — socket, PID, state persistence

Phase 2: Session Integration
  C1 (Session Mgmt)       — agent-deck CLI wrapper (launch, send, stop, remove)
  C7 (Conductor)          — conductor setup/teardown, engine CLAUDE.md/POLICY.md,
                             transition notifier awareness, instruction templates,
                             bridge daemon config guidance

Phase 3: Schema + Conductor Policy
  C3 (OpenSpec conformist) — read schema YAML, precondition checks via openspec status
  C4 (Schema Context)      — parse schema definitions for artifact graph
  C5 (Board)               — conductor POLICY.md with board polling guidance
                              (no engine-side adapter — conductor uses tools directly)
  Nix flake                — conductor policy customization per workspace

Phase 4: Surface Integration
  C2 (Dev Surface)        — cmux socket client + view engine reconciliation
  Wire all contracts as XState invoked service actors (fromPromise)
```

---

## Open Contract Questions

1. **C1 environment injection.** How does the engine set `WFE_INSTANCE_ID` in agent-deck sessions? Agent-deck doesn't have a `--env` flag. Options: inject via CLAUDE.md, set in the initial message, or propose the feature to agent-deck.

2. **C2 surface tracking.** cmux surface IDs are session-scoped (reset on app restart). The engine needs to re-discover surfaces after cmux restarts. Strategy: re-apply full desired view state on reconnect, let the view engine rebuild mappings.

3. **C2 socket mode.** If the engine daemon runs outside cmux, it needs `CMUX_SOCKET_MODE=allowAll`. This is a security tradeoff — document it and make it configurable.

4. **C3 verification gap.** `openspec` has no `verify` command. The engine needs to either: (a) treat verification as pure agent work via C1, or (b) implement its own verification logic using `openspec status` + filesystem checks. Option (a) is more aligned with the domain model.

5. **C7 timeout policy.** What is the appropriate timeout for conductor instructions? Too short = false alarms. Too long = stuck workflows. Should be configurable per instruction type.

6. **C8 event durability.** v1 accepts event loss during daemon downtime. For v2, consider a write-ahead log or event journal that agents write to directly, which the daemon replays on restart.

7. **C1 session title conflicts.** If a workflow is started, aborted, and restarted with the same ID, the session title `cc-{id}-elaboration` already exists. Engine needs to either: (a) use a sequence number suffix, (b) remove old sessions before creating new ones, or (c) reuse the existing session.

---

## Review Decision Coverage

| Decision | Contract | Notes |
|---|---|---|
| D1 (deterministic naming) | C1 | Titles, not tmux names. `cc-{id}-{phase}` pattern. |
| D2 (worktree ownership) | C1 | Agent-deck owns worktrees. Engine queries via `session show --json`. |
| D3 (field naming) | C6 | `changeName` in context (maps to openspec change name). |
| D4 (transition pseudocode) | — | Deferred to workflow definition spec, not contracts. |
| D5 (branding) | C6, C8 | CLI is `codecorral`. Session prefix is `cc-`. |
| D6 (managed session naming) | C1 | Dropped `managedSessions` array. Discovery by title pattern. |
| D7 (dynamic browser URLs) | C2, C6 | `workflow.setBrowserUrl` → engine calls `cmux browser navigate`. |
| D8 (agent-based reviews) | C6 | Events are source-agnostic. |
| D9 (PR via hooks) | C6 | `codecorral transition pr.created` from hook. |
| D10 (LLM code reviews) | C1 | Review agent is an agent-deck session. |
| D11 (child lifecycle) | C1 | Engine implements recursive stop (no atomic agent-deck support). |
| D12 (profile layout) | C1 | Groups map to `codecorral/{workflowId}`. Conductor uses `set-parent`. |
| D13 (conductor.instruct) | C7 | Full conductor lifecycle: setup/teardown, instruction templates, two feedback paths (MCP + transition notifier), bridge integration. |
| D14 (managed sessions) | C1 | Use agent-deck for everything (consistent lifecycle). |
| D15 (multi-repo board) | C5, C7 | Conductor POLICY.md configures per-repo board sources. No engine-side adapter. |
| D16 (pull semantics) | C5, C7 | Conductor interprets work items via LLM. Engine receives `UnitBriefRef`. |
| D17 (distribution) | — | Out of scope for contracts. |
| D18 (surface driven by actions) | C2 | View engine reconciles desired state, not just phase mapping. |
| D19 (definition precedence) | C4 | Schema resolution: project > user > package. |
| D20 (project vs user config) | C8 | `~/.codecorral/config.yaml` + `.codecorral/config.yaml` merge. |
| D21 (composition) | C6 | `.provide()` for implementation overrides in v1. Build-time structural composition in v2. |
| D22 (schema-to-definition) | C4 | Many schemas → one workflow definition. |
| D23 (agent-controlled panes) | C2 | Agents use cmux directly. Engine tracks only its own surfaces. |
| D24 (retrospective) | C6 | Needs RETROSPECTIVE state in workflow definition. Event history supports it. |
| D25 (daemon mode) | C8 | Auto-start on first `codecorral` command. Socket-based discovery. |
