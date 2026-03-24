## Why

The engine can drive workflow workspaces in cmux, but there is no "home base" — no persistent workspace where the developer sees conductor activity, the tracking board, and high-level workflow status at a glance. When you open cmux today, CodeCorral has no presence until a workflow creates a workspace. Building the command center also requires a declarative view layout system — and that same system serves workflow phase views, so we build both together. A shared `defineLayout` / `defineOverlay` / `resolveLayout` TypeScript API gives all views the same syntax, makes views customizable by end users, and lets embedded state machines ship default views that users can override without forking.

## What Changes

- **Unified view layout system** — `defineLayout()` builder for declaring views (panes, panels, workspace metadata), `defineOverlay()` for add/remove/override deltas, `resolveLayout()` for merging base + overlay. TypeScript throughout, dynamic panel lists via context functions.
- **Pane grouping** — Multiple panels with the same `pane` value become tabs/surfaces within a single split region. Enables N conductors sharing one pane, or a review pane with both a terminal tab and a browser tab.
- **State machine view integration** — Workflow state machines reference layouts via `state.meta.view`. The view engine reads this on transitions and reconciles. Users override embedded machine views without forking via overlay files.
- **`codecorral view fork` command** — Scaffolds an overlay file into `.codecorral/views/`. Defaults to empty overlay (user adds deltas); `--full` copies complete base for full ownership.
- **Command center workspace** — `codecorral activate` bootstraps a pinned workspace per cmux window with conductor terminal pane(s) + tracking board browser pane, using the layout system as its first consumer.
- **Environment detection** via `CMUX_WORKSPACE_ID` env var + `system.identify()` RPC for window resolution.
- **Workspace config extension** — `board` URL and `conductors` configuration per workspace.

## Capabilities

### New Capabilities
- `view-layout`: The `defineLayout` / `defineOverlay` / `resolveLayout` system — layout declaration, pane grouping, overlay composition, context-driven dynamic panels, state machine integration, overlay file discovery, and the `codecorral view fork` command.
- `command-center`: The command center workspace lifecycle — activation, environment detection, pinned workspace management, conductor attachment, tracking board browser pane. First consumer of the view layout system.

### Modified Capabilities
- `cli`: New `codecorral activate` and `codecorral view fork` commands
- `workspace-config`: Workspace config gains optional `board` URL and `conductors` configuration

## Impact

- `src/cmux/` — new `layout-types.ts`, `layout.ts` (builders), `resolve.ts` (resolution), `overlay-loader.ts` (file discovery), `view-bridge.ts` (state machine integration), `env.ts` (cmux detection), `client.ts` (socket RPC), `layouts/command-center.ts` (built-in layout)
- `src/cli/` — new `activate` and `view` commands
- `src/config/` — workspace config schema extended with `board` and `conductors` fields
- View engine (Unit 5) — reconciliation algorithm consumes `resolveLayout` output
- All workflow state machines — reference layouts via `state.meta.view`
- C2 contract — requires `createWorkspace` extension for `pinned` and `position` options
