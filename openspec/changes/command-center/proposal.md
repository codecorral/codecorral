## Why

The engine can drive workflow workspaces in cmux, but there is no "home base" — no persistent workspace where the developer sees conductor activity, the tracking board, and high-level workflow status at a glance. When you open cmux today, CodeCorral has no presence until a workflow creates a workspace. The developer needs a command center: a pinned workspace per cmux window that bootstraps the CodeCorral experience, attaches to conductors, and provides an extensible dashboard that grows with the system.

## What Changes

- New `codecorral activate` CLI command that bootstraps a command center workspace in cmux
- Environment detection via `CMUX_WORKSPACE_ID` env var to determine if running inside cmux
- Idempotent activation: re-running `activate` is a no-op if the command center already exists
- Command center workspace is pinned to position 0 in the cmux sidebar, never closed by the engine
- Initial command center layout: conductor terminal pane (attached via `agent-deck session attach`) + tracking board browser pane
- Declarative layout system for the command center, reusing the same view engine reconciliation mechanism used for workflow workspaces
- One command center per cmux window (window = project/profile per C2 mapping)
- Outside cmux: `codecorral activate` prints a message directing the user to run it inside cmux

## Capabilities

### New Capabilities
- `command-center`: The command center workspace lifecycle — activation, layout declaration, environment detection, pinned workspace management, conductor attachment, and tracking board browser pane. Extensible panel system for future high-level views.

### Modified Capabilities
- `cli`: New `codecorral activate` command with cmux environment detection
- `workspace-config`: Workspace config gains an optional `board` URL field for the tracking board and conductor configuration per workspace

## Impact

- `src/cli/` — new `activate` command
- `src/config/` — workspace config schema extended with `board` and conductor fields
- View engine (when implemented) — command center layout becomes a first-class view config alongside workflow phase view configs
- C2 contract — uses existing cmux primitives (createWorkspace, splitSurface, openBrowserSplit, sendText) plus a new `pinned` option on `createWorkspace` (contract extension required)
- Depends on conductor sessions existing (Unit 3) for the terminal attachment; can scaffold without them initially
