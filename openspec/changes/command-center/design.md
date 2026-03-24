## Context

The engine drives workflow workspaces in cmux via the C2 contract — creating workspaces, reconciling surfaces on phase transitions, updating status pills. But there is no persistent "home" workspace. When a developer opens cmux, CodeCorral is invisible until a workflow starts. The developer needs a command center: a pinned workspace that shows conductor activity, the tracking board, and — eventually — additional high-level views.

Cmux exposes environment variables to every process running inside it (`CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID`, `CMUX_WINDOW_ID`). This gives the CLI reliable context detection without querying the socket. The C2 contract already provides all the primitives needed (workspace creation, surface splitting, browser panes, sendText).

The view engine (Unit 5) uses own-state reconciliation (D23) — tracking what it created and diffing against desired state. The command center should use the same mechanism, treating the command center as a special-case "view config" that never transitions phases and never closes.

## Goals / Non-Goals

**Goals:**
- `codecorral activate` command that bootstraps a command center workspace in the current cmux window
- Environment detection via cmux env vars to determine inside/outside cmux context
- Idempotent activation — safe to run repeatedly
- Declarative command center layout using the same view config pattern as workflow phase views
- Initial layout: conductor terminal pane + tracking board browser pane
- One command center per cmux window, pinned to sidebar position 0
- Extensible: new panel types can be added to the layout declaration over time

**Non-Goals:**
- Building cmux itself or extending the C2 contract with new primitives
- Auto-starting cmux when running outside it — the CLI explains what to do
- Implementing the full view engine reconciliation (Unit 5) — this change defines the command center's layout config and activation logic; reconciliation comes from Unit 5
- Conductor lifecycle management — `activate` attaches to an existing conductor session (or leaves the pane empty if none exists)
- Making the tracking board URL DRY with conductor polling config — they're declared separately in workspace config; coupling them creates more problems than it solves

## Decisions

### D1: Environment detection via cmux env vars, not socket probing

The `activate` command reads `CMUX_WINDOW_ID` to determine if it's running inside cmux and which window it's in. No socket connection needed for detection.

```
codecorral activate
  ├── $CMUX_WINDOW_ID set?
  │     ├── YES → inside cmux, proceed with activation for this window
  │     └── NO  → print: "Not inside cmux. Start cmux, then run this command."
  └── exit
```

**Alternative considered:** Probing the cmux socket at `/tmp/cmux.sock`. Rejected — the socket tells you cmux is running somewhere, but not which window you're in. Env vars give positional context for free.

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
      command: "agent-deck attach conductor-{profile}"
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

### D3: One command center per cmux window, tracked by window ID

The engine persists a mapping of `windowId → commandCenterWorkspaceId` in the daemon's in-memory state (and in the persistence layer for recovery). This enables:
- Idempotency: `activate` checks if a command center already exists for `$CMUX_WINDOW_ID`
- Recovery: if cmux restarts, the stale workspace ID is detected (cmux returns error on operations targeting it) and the command center is rebuilt — same recovery mechanism as workflow workspaces (D23)

```typescript
interface CommandCenterState {
  windowId: string
  workspaceId: string | null  // null = needs rebuild
  panels: Map<string, string> // role → surfaceId
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
1. Detect cmux context ($CMUX_WINDOW_ID)
2. Connect to daemon (auto-start if needed)
3. Send "activate" command to daemon with windowId
4. Daemon checks: command center exists for this window?
   ├── YES → return current status (idempotent)
   └── NO  →
       a. Resolve workspace config (match workspace by path or use default)
       b. Create cmux workspace (pinned, position 0)
       c. Build panels from layout config:
          - Terminal panel: sendText with conductor attach command
          - Browser panel: openBrowserSplit with board URL
       d. Persist CommandCenterState
       e. Return activation result
5. CLI prints status
```

### D6: Outside cmux is a clear, helpful error — not silent

```
$ codecorral activate
⚠ Not inside cmux (CMUX_WINDOW_ID not set).

  Start cmux first, then run 'codecorral activate' from any terminal pane.

  Other commands (status, workspaces, history) work anywhere.
```

No attempt to start cmux. The Excel analogy: you open Excel first, then open your workbook. CodeCorral doesn't own the platform.

### D7: Multiple conductors get multiple terminal panes/tabs

If a workspace configuration specifies multiple conductors (future), or if the developer has multiple conductor sessions running for the window's profile, the command center layout can declare multiple terminal panels. For v1, the layout has a single conductor panel. The declarative system naturally extends to multiple panels when needed.

## Risks / Trade-offs

**[cmux env vars not standardized yet]** → cmux is still being designed. The specific env var names (`CMUX_WINDOW_ID`, `CMUX_WORKSPACE_ID`) are from the exploration contracts. If they change, only the detection logic in `activate` needs updating. Mitigation: extract env var names to a shared constant.

**[Command center workspace could be manually closed by user]** → The engine tracks the workspace ID. On any subsequent operation (or periodic health check), if the workspace ID returns an error from cmux, the engine nulls it out and the next `activate` rebuilds. This is identical to the cmux-restart recovery path.

**[Conductor session might not exist at activation time]** → If `agent-deck attach conductor-{name}` fails because the conductor isn't set up yet, the terminal pane shows the error. This is acceptable — the developer sees the failure and can set up the conductor. The command center is useful even without the conductor (board is still visible, and the terminal pane can be used for other commands).

**[Board URL not validated]** → The browser panel opens whatever URL is in config. If it's wrong, the developer sees a browser error. No validation needed — same UX as typing a wrong URL in a browser.

**[View engine not yet implemented]** → The command center layout config and activation logic can be implemented before the full view engine (Unit 5). Initially, `activate` issues cmux primitives directly. When the view engine lands, the command center migrates to use reconciliation. The layout config format is designed to be compatible with both approaches.
