## Context

The engine drives workflow workspaces in cmux via the C2 contract — creating workspaces, reconciling surfaces on phase transitions, updating status pills. But there is no persistent "home" workspace. When a developer opens cmux, CodeCorral is invisible until a workflow starts. The developer needs a command center: a pinned workspace that shows conductor activity, the tracking board, and — eventually — additional high-level views.

Cmux exposes environment variables to every process running inside it (`CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID`). The presence of `CMUX_WORKSPACE_ID` is a reliable signal that the CLI is running inside cmux. The C2 contract provides most primitives needed (workspace creation, surface splitting, browser panes, sendText), though workspace pinning requires a contract extension.

The view engine (Unit 5) uses own-state reconciliation (D23) — tracking what it created and diffing against desired state. The command center should use the same mechanism, treating the command center as a special-case "view config" that never transitions phases and never closes.

## Goals / Non-Goals

**Goals:**
- `codecorral activate` command that bootstraps a command center workspace in cmux
- Environment detection via `CMUX_WORKSPACE_ID` to determine inside/outside cmux context
- Idempotent activation — safe to run repeatedly
- Declarative command center layout using the same view config pattern as workflow phase views
- Initial layout: conductor terminal pane + tracking board browser pane
- One command center per cmux window, pinned to sidebar position 0
- Extensible: new panel types can be added to the layout declaration over time

**Non-Goals:**
- Building cmux itself (though we require a C2 contract extension for workspace pinning)
- Auto-starting cmux when running outside it — the CLI explains what to do
- Implementing the full view engine reconciliation (Unit 5) — this change defines the command center's layout config and activation logic; reconciliation comes from Unit 5
- Conductor lifecycle management — `activate` attaches to an existing conductor session (or leaves the pane empty if none exists)
- Making the tracking board URL DRY with conductor polling config — they're declared separately in workspace config; coupling them creates more problems than it solves

## Decisions

### D1: Environment detection via `CMUX_WORKSPACE_ID`, window resolution via `system.identify()`

The `activate` command checks `CMUX_WORKSPACE_ID` to determine if it's running inside cmux. If present, it calls `system.identify()` via the cmux socket to resolve the current window ID (needed for the "one command center per window" rule). The C2 contract guarantees `system.identify()` returns `{ window_id, workspace_id, surface_id }`.

```
codecorral activate
  ├── $CMUX_WORKSPACE_ID set?
  │     ├── YES → inside cmux
  │     │     └── cmux_rpc("system.identify") → get window_id
  │     │           └── proceed with activation for this window
  │     └── NO  → print: "Not inside cmux. Start cmux, then run this command."
  └── exit
```

**Why two steps:** The C2 contract exposes `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` as env vars but not `CMUX_WINDOW_ID`. The env var is sufficient for detection (are we in cmux?), while the RPC call resolves the window context (which window are we in?). This is one extra call at activation time — acceptable since activation is infrequent.

**Alternative considered:** Using only the env var and keying state by workspace ID instead of window ID. Rejected — a window can have many workspaces, and the command center is per-window, not per-workspace. Two terminals in different workspaces of the same window should share one command center.

### D2: Command center as a declarative view config

The command center layout is declared the same way workflow phase view configs are declared in the view engine brief (Unit 5):

```typescript
interface CommandCenterLayout {
  workspace: {
    pinned: true
    position: 0
    name: "Command Center"
  }
  panels: PanelConfig[]
}

type PanelConfig =
  | { role: string; type: "terminal"; position: SplitPosition; command: string }
  | { role: string; type: "browser"; position: SplitPosition; url: string }

type SplitPosition = "main" | "right" | "down" | "left" | "up"
```

The initial command center layout:

```typescript
const commandCenterLayout: CommandCenterLayout = {
  workspace: { pinned: true, position: 0, name: "Command Center" },
  panels: [
    {
      role: "conductor",
      type: "terminal",
      position: "main",
      command: "agent-deck session attach conductor-{profile}"
    },
    {
      role: "board",
      type: "browser",
      position: "right",
      url: "{workspace.board}"  // resolved from workspace config
    }
  ]
}
```

This reuses the same reconciliation machinery that workflow workspaces use. The command center is just a layout that happens to be permanent.

**Alternative considered:** Hard-coding the command center layout in the activate command. Rejected — declarative layout enables future extensibility (user-configured panels, additional built-in views) without changing activation logic.

### D3: One command center per cmux window, tracked by window ID from `system.identify()`

The engine persists a mapping of `windowId → commandCenterWorkspaceId` in the daemon's in-memory state (and in the persistence layer for recovery). The window ID is obtained via `system.identify()` at activation time (see D1). This enables:
- Idempotency: `activate` resolves the current window ID and checks if a command center already exists for it
- Recovery: if cmux restarts, the stale workspace ID is detected (cmux returns error on operations targeting it) and the command center is rebuilt — same recovery mechanism as workflow workspaces (D23)

```typescript
interface CommandCenterState {
  windowId: string             // from system.identify(), not an env var
  workspaceId: string | null   // null = needs rebuild
  panels: Map<string, string>  // role → surfaceId
}
```

### D4: Workspace config gains optional `board` and `conductor` fields

```yaml
# ~/.codecorral/config.yaml
workspaces:
  codecorral:
    path: ~/Code/github_codecorral/codecorral
    board: https://github.com/orgs/codecorral/projects/1
    conductor:
      name: conductor-codecorral
      # profile defaults to workspace name if omitted
```

The `board` URL is intentionally decoupled from the conductor's polling configuration. The conductor may poll a board API, an issue tracker, or multiple sources — the browser panel URL is purely a developer convenience for visual access. Keeping them separate avoids coupling the visual experience to the conductor's internal configuration.

If `board` is omitted, the browser panel is not created. If `conductor.name` is omitted, the terminal pane opens a shell instead of attaching.

### D5: `codecorral activate` is a mutating command — auto-starts daemon

Following the existing CLI pattern (cli spec), `activate` is a mutating command that requires the daemon. It follows the same auto-start logic: check `~/.codecorral/daemon.sock`, start daemon if missing, then proceed.

The activation flow:

```
1. Detect cmux context ($CMUX_WORKSPACE_ID present?)
2. Resolve window ID via cmux_rpc("system.identify")
3. Connect to daemon (auto-start if needed)
4. Send "activate" command to daemon with windowId
5. Daemon checks: command center exists for this window?
   ├── YES → return current status (idempotent)
   └── NO  →
       a. Resolve workspace config (match workspace by path or use default)
       b. Create cmux workspace (pinned, position 0 — requires C2 extension, see D8)
       c. Build panels from layout config:
          - Terminal panel: sendText with conductor attach command
          - Browser panel: openBrowserSplit with board URL
       d. Persist CommandCenterState
       e. Return activation result
6. CLI prints status
```

### D6: Outside cmux is a clear, helpful error — not silent

```
$ codecorral activate
⚠ Not inside cmux (CMUX_WORKSPACE_ID not set).

  Start cmux first, then run 'codecorral activate' from any terminal pane.

  Other commands (status, workspaces, history) work anywhere.
```

No attempt to start cmux. The Excel analogy: you open Excel first, then open your workbook. CodeCorral doesn't own the platform.

### D7: Multiple conductors get multiple terminal panes/tabs

If a workspace configuration specifies multiple conductors (future), or if the developer has multiple conductor sessions running for the window's profile, the command center layout can declare multiple terminal panels. For v1, the layout has a single conductor panel. The declarative system naturally extends to multiple panels when needed.

### D8: C2 contract extension for workspace pinning

The current C2 contract defines `createWorkspace(): Promise<WorkspaceRef>` with no parameters. The command center requires a `pinned` option and a `position` hint to ensure it stays at sidebar position 0. This is a contract extension request to cmux:

```typescript
// Proposed C2 extension
createWorkspace(options?: {
  name?: string
  pinned?: boolean     // prevents engine from closing, stays in sidebar
  position?: number    // sidebar ordering hint (0 = first)
}): Promise<WorkspaceRef>
```

This is the only C2 extension this change requires. All other operations (splitSurface, sendText, openBrowserSplit) use existing primitives. If cmux doesn't support pinning at implementation time, the fallback is to create a regular workspace and have the engine never close it (soft pinning via engine convention).

## Risks / Trade-offs

**[cmux env vars not standardized yet]** → cmux is still being designed. The specific env var names (`CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID`) and the `system.identify()` response shape are from the exploration contracts. If they change, only the detection logic in `activate` needs updating. Mitigation: extract env var names and RPC method names to shared constants.

**[Command center workspace could be manually closed by user]** → The engine tracks the workspace ID. On any subsequent operation (or periodic health check), if the workspace ID returns an error from cmux, the engine nulls it out and the next `activate` rebuilds. This is identical to the cmux-restart recovery path.

**[Conductor session might not exist at activation time]** → If `agent-deck session attach conductor-{name}` fails because the conductor isn't set up yet, the terminal pane shows the error. This is acceptable — the developer sees the failure and can set up the conductor. The command center is useful even without the conductor (board is still visible, and the terminal pane can be used for other commands).

**[Board URL not validated]** → The browser panel opens whatever URL is in config. If it's wrong, the developer sees a browser error. No validation needed — same UX as typing a wrong URL in a browser.

**[View engine not yet implemented]** → The command center layout config and activation logic can be implemented before the full view engine (Unit 5). Initially, `activate` issues cmux primitives directly. When the view engine lands, the command center migrates to use reconciliation. The layout config format is designed to be compatible with both approaches.
