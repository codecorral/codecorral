## Context

The view engine brief (Unit 5) defines a reconciliation algorithm that diffs `ViewState` objects and issues cmux primitives for the delta. The existing `ViewState` and `ManagedSurface` types in the C2 contract exploration describe the engine's internal tracking, but there's no standardized way to *declare* what a view should look like. The command center needs a declarative layout, and workflow phase views need the same thing — so we build a unified layout system and the command center as its first consumer.

Cmux exposes environment variables to every process running inside it (`CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID`). The presence of `CMUX_WORKSPACE_ID` is a reliable signal that the CLI is running inside cmux. The C2 contract provides most primitives needed (workspace creation, surface splitting, browser panes, sendText), though workspace pinning requires a contract extension.

Cmux's hierarchy: Window → Workspace → Pane (split region) → Surface (tab within pane) → Panel (terminal | browser). The layout system maps to this: a layout declares panes and panels, where panels sharing a `pane` group become surfaces (tabs) within the same split region.

State machines ship as embedded TypeScript (distributed via Nix flake), and users may not fork them. Users need a way to override views from embedded machines without copying the entire machine definition. This is the overlay system.

## Goals / Non-Goals

**Goals:**
- Unified `defineLayout` / `defineOverlay` / `resolveLayout` TypeScript API used by all view consumers
- Pane grouping: multiple panels in the same pane become tabs/surfaces
- Dynamic panel lists via context functions (react to conductor count, workspace config, workflow state)
- Overlay composition that preserves base layout updates
- State machine integration via `state.meta.view`
- User override of embedded state machine views without forking the machine
- `codecorral view fork` CLI command to scaffold overlay files
- `codecorral activate` command that bootstraps a command center workspace in cmux
- Environment detection via `CMUX_WORKSPACE_ID` + `system.identify()` for window resolution
- One command center per cmux window, pinned to sidebar position 0

**Non-Goals:**
- Implementing the reconciliation algorithm (Unit 5 scope) — this change defines the layout *input* to reconciliation, not the reconciler itself
- Building cmux itself (though we require a C2 contract extension for workspace pinning)
- Runtime layout editing (drag-and-drop in cmux) — views are declared in files, not manipulated live
- View configs for specific workflow schemas (intent, unit, t2d) — those changes define their own layouts using this system
- Status pills and progress indicators — those are part of ViewState but not part of the layout declaration
- Auto-starting cmux when running outside it — the CLI explains what to do
- Conductor lifecycle management — `activate` attaches to existing conductor sessions
- Making the tracking board URL DRY with conductor polling config — declared separately in workspace config

## Decisions

### D1: TypeScript for layout definitions, not YAML

Layouts are TypeScript files using `defineLayout()` and `defineOverlay()` builder functions. This gives type safety, dynamic panel lists via functions, and consistency with state machine definitions (also TypeScript).

```typescript
import { defineLayout } from "codecorral/layout"

export default defineLayout({
  name: "Command Center",
  pinned: true,
  position: 0,
  panes: [
    { pane: "conductors", region: "main" },
    { pane: "board", region: "right" },
  ],
  panels: ({ workspace }) => [
    ...workspace.conductors.map(c => ({
      role: `conductor:${c.name}`,
      type: "terminal" as const,
      pane: "conductors",
      label: c.name,
      command: `agent-deck session attach ${c.name}`,
    })),
    ...(workspace.board ? [{
      role: "board",
      type: "browser" as const,
      pane: "board",
      url: workspace.board,
    }] : []),
  ],
})
```

**Alternative considered:** YAML config files. Rejected — cannot express dynamic panel lists (e.g., mapping N conductors to N panels), and would require a separate schema validator instead of leveraging TypeScript's type system. Agents authoring layouts benefit from IDE-level type checking.

### D2: Two-level structure — panes declare regions, panels declare content

A layout declares **panes** (named split regions with a position) and **panels** (typed content that goes into a pane). Panels reference their pane by name. Multiple panels with the same `pane` value become tabs/surfaces within that split region.

```typescript
interface PaneConfig {
  pane: string       // unique group name
  region: Region     // split position: "main" | "right" | "down" | "left" | "up"
}

interface PanelConfig {
  role: string       // unique identifier (used for state tracking + overlay targeting)
  type: "terminal" | "browser"
  pane: string       // which pane group this belongs to
  label?: string     // tab label (defaults to role)
  command?: string   // terminal panels
  url?: string       // browser panels
}
```

This maps cleanly to cmux's hierarchy:
| Layout concept | cmux primitive |
|---|---|
| Layout | Workspace |
| Pane | Split region (created via `splitSurface`) |
| Panel | Surface/tab within a pane |

**Alternative considered:** Flat panel list with `region` on each panel. Rejected — cannot express "these panels share one pane as tabs." The two-level structure handles both single-panel panes and multi-panel tabbed panes uniformly.

### D3: `LayoutContext` with workspace + optional workflow

Layout panel functions receive a context object. The context always includes workspace config and optionally includes workflow runtime state:

```typescript
interface LayoutContext {
  workspace: ResolvedWorkspaceConfig
  workflow?: WorkflowViewContext
}

interface WorkflowViewContext {
  workflowId: string
  instanceId: string
  phase: string
  sessionTitle: string
  changePath: string
  worktreePath: string
  branch: string
  baseBranch: string
  prUrl?: string
}
```

The command center uses `ctx.workspace` (conductor list, board URL). Workflow views use both `ctx.workspace` and `ctx.workflow` (session titles, PR URLs). The union type lets `defineLayout` serve both use cases with one function signature.

### D4: Overlays as add/remove/override deltas

An overlay composes on top of a base layout without replacing it:

```typescript
interface OverlayConfig {
  add?: PanelConfig[]                              // new panels
  remove?: string[]                                // roles to remove
  override?: Record<string, Partial<PanelConfig>>  // role → partial props
  panes?: {
    add?: PaneConfig[]                             // new panes (for added panels)
    remove?: string[]                              // panes to remove entirely
  }
}
```

Resolution order in `resolveLayout`:

```
1. Evaluate base panels (call function if dynamic)
2. Remove panels matching overlay.remove roles
3. Remove panes matching overlay.panes.remove
4. Apply overlay.override to matching panels by role
5. Add overlay.panes.add
6. Add overlay.add panels
```

Base layout updates flow through unless the overlay explicitly removes or overrides them.

**Alternative considered:** Full fork (copy entire base, user owns everything). Available via `codecorral view fork --full` but not the default — full forks block all base updates.

### D5: State machine view integration via `state.meta.view`

XState v5 supports arbitrary metadata on states via `meta`. Workflow machines reference layouts per state:

```typescript
const unitWorkflow = setup({ /* ... */ }).createMachine({
  id: "unit-workflow",
  states: {
    elaboration: {
      meta: { view: views.elaboration },
    },
    review: {
      meta: { view: views.review },
    },
  },
})
```

The view engine reads `state.meta.view` after each transition. If the view changed, it calls `resolveLayout(baseView, overlay, ctx)` and feeds the result to reconciliation.

### D6: Overlay targeting for embedded state machine views

Users override views from embedded machines by creating overlay files keyed by state name:

```typescript
// .codecorral/views/unit-workflow.ts
import { defineOverlay } from "codecorral/layout"

export default {
  "implementation": defineOverlay("unit-workflow:implementation", {
    add: [{
      role: "tests",
      type: "terminal",
      pane: "log",
      label: "Tests",
      command: "bun test --watch",
    }],
  }),
}
```

**File discovery order:**
1. `.codecorral/views/{machineId}.ts` (project-local)
2. `~/.codecorral/views/{machineId}.ts` (user-global)
3. No overlay (base view from state machine used as-is)

### D7: `codecorral view fork` scaffolds overlays

```bash
codecorral view fork command-center       # empty overlay scaffold
codecorral view fork unit-workflow        # record keyed by state name
codecorral view fork command-center --full # complete base copy (blocks updates)
```

Default scaffolds an overlay with correct imports and comments showing available roles. `--full` copies the base layout verbatim for full ownership.

### D8: Layout files loaded via dynamic import

Bun handles TypeScript natively — no build step for overlay files:

```typescript
async function loadOverlay(machineId: string): Promise<OverlayConfig | Record<string, OverlayConfig> | null> {
  const projectPath = `.codecorral/views/${machineId}.ts`
  const userPath = `~/.codecorral/views/${machineId}.ts`
  for (const filePath of [projectPath, userPath]) {
    if (await Bun.file(filePath).exists()) {
      const mod = await import(filePath)
      return mod.default
    }
  }
  return null
}
```

### D9: Environment detection via `CMUX_WORKSPACE_ID`, window resolution via `system.identify()`

The `activate` command checks `CMUX_WORKSPACE_ID` to determine if it's running inside cmux. If present, it calls `system.identify()` via the cmux socket to resolve the current window ID (needed for the "one command center per window" rule).

```
codecorral activate
  ├── $CMUX_WORKSPACE_ID set?
  │     ├── YES → inside cmux
  │     │     └── cmux_rpc("system.identify") → get window_id
  │     │           └── proceed with activation for this window
  │     └── NO  → print: "Not inside cmux. Start cmux, then run this command."
  └── exit
```

**Why two steps:** The C2 contract exposes `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` as env vars but not `CMUX_WINDOW_ID`. The env var is sufficient for detection (are we in cmux?), while the RPC call resolves the window context (which window are we in?).

### D10: One command center per cmux window, tracked by window ID

The engine persists a mapping of `windowId → commandCenterWorkspaceId`:

```typescript
interface CommandCenterState {
  windowId: string             // from system.identify()
  workspaceId: string | null   // null = needs rebuild
  panels: Map<string, string>  // role → surfaceId
}
```

Idempotency: `activate` resolves the current window ID and checks if a command center already exists. Recovery: stale workspace IDs detected when cmux returns errors, triggering rebuild on next activate.

### D11: Workspace config gains `board` and `conductors` fields

```yaml
workspaces:
  codecorral:
    path: ~/Code/github_codecorral/codecorral
    board: https://github.com/orgs/codecorral/projects/1
    conductors:
      - name: conductor-codecorral
```

Board URL is decoupled from conductor polling config. If `board` is omitted, no browser panel. If `conductors` is empty, terminal pane opens a shell.

### D12: `codecorral activate` is a mutating command — auto-starts daemon

```
1. Detect cmux context ($CMUX_WORKSPACE_ID present?)
2. Resolve window ID via cmux_rpc("system.identify")
3. Connect to daemon (auto-start if needed)
4. Send "activate" command to daemon with windowId
5. Daemon checks: command center exists for this window?
   ├── YES → return current status (idempotent)
   └── NO  →
       a. Resolve workspace config (match workspace by path or use default)
       b. Create cmux workspace (pinned, position 0 — requires C2 extension, see D13)
       c. Resolve command center layout via resolveLayout(base, overlay, ctx)
       d. Issue cmux primitives for each pane/panel
       e. Persist CommandCenterState
       f. Return activation result
6. CLI prints status
```

### D13: C2 contract extension for workspace pinning

```typescript
// Proposed C2 extension
createWorkspace(options?: {
  name?: string
  pinned?: boolean     // prevents engine from closing, stays in sidebar
  position?: number    // sidebar ordering hint (0 = first)
}): Promise<WorkspaceRef>
```

Fallback if cmux doesn't support pinning: create a regular workspace and have the engine never close it (soft pinning via convention).

## Risks / Trade-offs

**[TypeScript overlay files require TypeScript knowledge]** → Primary authors are agents and developers in a TypeScript codebase. The `view fork` command scaffolds files with correct imports/types.

**[Dynamic import of user files is a security surface]** → Overlays loaded from known paths (`.codecorral/views/`) that the user controls. Same trust model as `.claude/` config or Nix flake expressions.

**[Overlay composition can produce invalid layouts]** → `resolveLayout` validates the merged result — orphaned panels (referencing removed panes) are warnings, not hard errors.

**[State machine view overrides may reference stale state names]** → View engine logs a warning when an overlay targets a non-existent state. Overlay is ignored, base view used. Same graceful degradation as CSS targeting a missing class.

**[Full fork blocks updates]** → By design. `--full` is explicit opt-in. Default scaffolds overlay that preserves base updates.

**[cmux env vars not standardized yet]** → cmux is still being designed. If names change, only detection logic needs updating. Mitigation: shared constants.

**[Conductor session might not exist at activation time]** → Terminal pane shows the `agent-deck session attach` error. Command center is useful without it (board still visible).

**[Command center workspace could be manually closed]** → Engine tracks workspace ID. On error, nulls it out, next `activate` rebuilds.
