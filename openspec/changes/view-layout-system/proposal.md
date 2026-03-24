## Why

The engine needs a declarative way to define what developers see in cmux during each workflow phase — and the command center needs the same system. Today, the view engine brief (Unit 5) describes a reconciliation algorithm and `ViewState` data shapes, but there's no unified layout definition format. Without one, each consumer (command center, unit workflow, intent workflow) will invent its own ad-hoc layout representation. A shared `defineLayout` / `defineOverlay` system gives all views the same syntax, makes views customizable by end users, and lets embedded state machines ship default views that users can override without forking.

## What Changes

- **`defineLayout()` builder** — TypeScript function that declares a view layout: panes (split regions in the workspace), panels (surfaces/tabs within panes), and workspace metadata (name, pinned, position). Panel lists can be static or dynamic functions that receive workspace/workflow context.
- **Pane grouping** — Multiple panels with the same `pane` value become tabs/surfaces within a single split region. Enables N conductors sharing one pane, or a review pane with both a terminal tab and a browser tab.
- **`defineOverlay()` builder** — TypeScript function that declares add/remove/override deltas against a base layout. Overlays compose on top of base layouts without replacing them, so base updates still flow through.
- **Layout resolution** — `resolveLayout(base, overlay, ctx)` merges a base layout with an optional overlay, evaluating dynamic panel functions against the provided context.
- **`LayoutContext` type** — Union context providing `workspace` config (always) and optional `workflow` runtime state (session titles, PR URLs, branch names) for workflow phase views.
- **`codecorral view fork` command** — Scaffolds an overlay file into `.codecorral/views/` for a named layout. Defaults to an empty overlay (user adds deltas); `--full` copies the complete base for full ownership.
- **Overlay resolution order** — Project-local (`.codecorral/views/`), then user-global (`~/.codecorral/views/`), then embedded default. First match wins.
- **State machine view integration** — Workflow state machines reference layouts via `state.meta.view`. The view engine reads this on transitions and reconciles via the existing own-state algorithm.
- **State machine view overrides** — Users can override views defined in embedded state machines without forking the machine. Overlay files target `{machineId}:{stateName}` to override specific phase views.

## Capabilities

### New Capabilities
- `view-layout`: The `defineLayout` / `defineOverlay` / `resolveLayout` system — layout declaration, pane grouping, overlay composition, context-driven dynamic panels, resolution order, and the `codecorral view fork` command.

### Modified Capabilities

## Impact

- `src/cmux/` — new `layout.ts` (types + builders), `resolve.ts` (resolution logic), `overlay-loader.ts` (file discovery)
- `src/cli/` — new `view` command with `fork` subcommand
- View engine (Unit 5) — reconciliation algorithm consumes `resolveLayout` output instead of hand-built `ViewState`
- Command center change — refactored to use `defineLayout` for its layout config
- All workflow state machines — reference layouts via `state.meta.view`
- C2 contract — requires `createWorkspace` extension for `pinned` and `position` options (proposed in command-center change D8)
