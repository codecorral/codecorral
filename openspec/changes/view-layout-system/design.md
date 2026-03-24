## Context

The view engine brief (Unit 5) defines a reconciliation algorithm that diffs `ViewState` objects and issues cmux primitives for the delta. The existing `ViewState` and `ManagedSurface` types in the C2 contract exploration describe the engine's internal tracking, but there's no standardized way to *declare* what a view should look like. The command-center change introduced the idea of `defineLayout` during exploration, and we discovered that the same syntax works for both the command center (permanent fixture) and workflow phase views (referenced from XState `state.meta.view`).

The key constraint from the user: state machines ship as embedded TypeScript (distributed via Nix flake), and users may not fork them. Users need a way to override views from embedded machines without copying the entire machine definition. This is the overlay system.

Cmux's hierarchy: Window → Workspace → Pane (split region) → Surface (tab within pane) → Panel (terminal | browser). The layout system maps to this: a layout declares panes and panels, where panels sharing a `pane` group become surfaces (tabs) within the same split region.

## Goals / Non-Goals

**Goals:**
- Unified `defineLayout` / `defineOverlay` / `resolveLayout` TypeScript API used by all view consumers
- Pane grouping: multiple panels in the same pane become tabs/surfaces
- Dynamic panel lists via context functions (react to conductor count, workspace config, workflow state)
- Overlay composition that preserves base layout updates
- State machine integration via `state.meta.view`
- User override of embedded state machine views without forking the machine
- `codecorral view fork` CLI command to scaffold overlay files

**Non-Goals:**
- Implementing the reconciliation algorithm (Unit 5 scope) — this change defines the layout *input* to reconciliation, not the reconciler itself
- Runtime layout editing (drag-and-drop in cmux) — views are declared in files, not manipulated live
- View configs for specific workflow schemas (intent, unit, t2d) — those changes define their own layouts using this system
- Status pills and progress indicators — those are part of ViewState but not part of the layout declaration (they're set by workflow actions, not declared in layouts)

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

**Alternative considered:** Flat panel list with `region` on each panel (the command-center change's original approach). Rejected — cannot express "these panels share one pane as tabs." The two-level structure handles both single-panel panes and multi-panel tabbed panes uniformly.

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

The view engine is responsible for constructing the context object before calling `resolveLayout`. For workflow views, it pulls runtime values from the XState machine context.

### D4: Overlays as add/remove/override deltas

An overlay composes on top of a base layout without replacing it. Three operations:

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

This means base layout updates (new panels, changed defaults) flow through unless the overlay explicitly removes or overrides them. A user who adds a "tests" tab and removes the "board" panel still gets any new panels added to future base versions.

**Alternative considered:** Full fork (copy entire base, user owns everything). Available via `codecorral view fork --full` but not the default — full forks block all base updates.

### D5: State machine view integration via `state.meta.view`

XState v5 supports arbitrary metadata on states via `meta`. Workflow machines reference layouts per state:

```typescript
const unitWorkflow = setup({ /* ... */ }).createMachine({
  id: "unit-workflow",
  states: {
    elaboration: {
      meta: { view: views.elaboration },
      // ...
    },
    review: {
      meta: { view: views.review },
      // ...
    },
  },
})
```

The view engine reads `state.meta.view` after each transition. If the view changed (different layout object reference or different state), it calls `resolveLayout(baseView, overlay, ctx)` and feeds the result to reconciliation.

The `view` property is a `LayoutConfig` — the same type returned by `defineLayout`. No special wrapping needed.

### D6: Overlay targeting for embedded state machine views

Users override views from embedded machines by creating overlay files that target `{machineId}:{stateName}`:

```typescript
// .codecorral/views/unit-workflow.ts
import { defineOverlay } from "codecorral/layout"

export default {
  // Override the implementation phase view
  "implementation": defineOverlay("unit-workflow:implementation", {
    add: [{
      role: "tests",
      type: "terminal",
      pane: "log",
      label: "Tests",
      command: "bun test --watch",
    }],
  }),

  // Override the review phase view
  "review": defineOverlay("unit-workflow:review", {
    override: {
      pr: { pane: "review" },
    },
  }),
}
```

The overlay file exports a record keyed by state name (or the special key `"*"` for all states). The view engine loads overlays by machine ID during workflow initialization.

**File discovery order:**
1. `.codecorral/views/{machineId}.ts` (project-local)
2. `~/.codecorral/views/{machineId}.ts` (user-global)
3. No overlay (base view from state machine used as-is)

First match wins. This matches how workspace config merging already works (project > user > default).

### D7: `codecorral view fork` scaffolds overlays

```bash
# Scaffold an empty overlay for the command center
codecorral view fork command-center
# → .codecorral/views/command-center.ts (empty overlay, add your customizations)

# Scaffold an empty overlay for a workflow's phase views
codecorral view fork unit-workflow
# → .codecorral/views/unit-workflow.ts (exports record keyed by state name)

# Full fork — copy base layout for complete ownership (blocks updates)
codecorral view fork command-center --full
# → .codecorral/views/command-center.ts (complete layout, you own it)
```

The `fork` command reads the embedded layout, generates the appropriate scaffold, and writes it. For overlay mode (default), it generates a file with the correct imports and an empty overlay structure with comments showing available roles. For full mode, it copies the base layout verbatim.

### D8: Layout files are loaded via dynamic import

Layout and overlay files are loaded at runtime via `import()`. Since they're TypeScript, Bun handles them natively (no compilation step needed). The loader:

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

Bun's native TypeScript support means no build step for overlay files. Users write `.ts`, the engine imports it directly.

## Risks / Trade-offs

**[TypeScript overlay files require TypeScript knowledge]** → The primary authors of overlays are agents and developers already working in a TypeScript codebase. The `codecorral view fork` command scaffolds the file with correct imports and types, reducing the barrier. If a non-TypeScript user needs customization, they can describe what they want and an agent generates the overlay.

**[Dynamic import of user files is a security surface]** → Overlay files execute arbitrary code at import time. Mitigation: overlays are loaded from known paths (`.codecorral/views/` and `~/.codecorral/views/`) that the user controls. This is the same trust model as `.claude/` config files, Nix flake expressions, or any project-local config that runs code.

**[Overlay composition can produce invalid layouts]** → An overlay could add a panel referencing a non-existent pane, or remove a pane that still has panels. Mitigation: `resolveLayout` validates the merged result — orphaned panels (referencing removed panes) are warnings, not hard errors. They're skipped with a logged message.

**[State machine view overrides may reference stale state names]** → If an embedded machine renames a state, overlay keys won't match. Mitigation: the view engine logs a warning when an overlay targets a state name that doesn't exist in the machine. The overlay is ignored for that state, and the base view is used. This is the same graceful degradation as CSS targeting a missing class.

**[Full fork blocks updates]** → By design. The `--full` flag is explicit opt-in. The default `fork` scaffolds an overlay that preserves base updates. Documentation should emphasize overlays as the preferred path.
