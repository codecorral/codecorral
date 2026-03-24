## ADDED Requirements

### Requirement: Command center workspace lifecycle
The engine SHALL support a command center workspace per cmux window. The command center is a pinned workspace at sidebar position 0 that persists for the lifetime of the cmux window. The engine SHALL NOT close the command center during workflow transitions or cleanup. The command center layout SHALL be defined using `defineLayout` from the view layout system.

#### Scenario: Command center created on activation
- **WHEN** `codecorral activate` is run inside cmux and no command center exists for the current window
- **THEN** the engine resolves the command center layout via `resolveLayout`, creates a new cmux workspace pinned at position 0 with the name "Command Center", and creates panes and panels per the resolved layout

#### Scenario: Command center survives workflow lifecycle
- **WHEN** a workflow completes and its workspace is closed
- **THEN** the command center workspace remains open and unmodified

#### Scenario: Command center is not duplicated
- **WHEN** `codecorral activate` is run and a command center already exists for the current window
- **THEN** the engine returns the existing command center status without creating a new workspace

### Requirement: Cmux environment detection
The engine SHALL detect whether it is running inside cmux by checking for the `CMUX_WORKSPACE_ID` environment variable. When inside cmux, the engine SHALL call `system.identify()` via the cmux socket to resolve the current window ID. The window ID SHALL be used to associate the command center with a specific cmux window.

#### Scenario: Running inside cmux
- **WHEN** `codecorral activate` is run and `CMUX_WORKSPACE_ID` is set
- **THEN** the engine calls `system.identify()` to resolve the window ID and proceeds with activation for the detected window

#### Scenario: Running outside cmux
- **WHEN** `codecorral activate` is run and `CMUX_WORKSPACE_ID` is not set
- **THEN** the engine prints a message directing the user to start cmux first, and exits with code 1

### Requirement: Command center default layout
The built-in command center layout SHALL use `defineLayout` with pane grouping. Conductor panels SHALL share a "conductors" pane (appearing as tabs when multiple conductors are configured). The tracking board SHALL occupy a "board" pane. The panel list SHALL be a dynamic function that reads `workspace.conductors` and `workspace.board` from the context.

#### Scenario: Layout with multiple conductors and tracking board
- **WHEN** the command center is activated for a workspace with two conductors and a `board` URL
- **THEN** the command center creates a "conductors" pane (main region) with two terminal surface tabs (one per conductor running `agent-deck session attach {name}`), and a "board" pane (right region) with a browser surface showing the board URL

#### Scenario: Layout without board URL
- **WHEN** the command center is activated for a workspace where `board` is not configured
- **THEN** the command center creates only the conductors pane (no board pane)

#### Scenario: Layout without conductors
- **WHEN** the command center is activated for a workspace where no conductors are configured
- **THEN** the conductors pane contains a single terminal surface with a shell in the workspace path

### Requirement: Command center overlay support
The command center layout SHALL support user customization via `defineOverlay`. Users SHALL be able to add panels, remove panels, and override panel properties without modifying the built-in layout. The overlay SHALL be discovered at `.codecorral/views/command-center.ts` (project-local) or `~/.codecorral/views/command-center.ts` (user-global).

#### Scenario: User adds a panel via overlay
- **WHEN** a user creates `.codecorral/views/command-center.ts` with an overlay adding a "daemon-log" terminal panel
- **THEN** the resolved command center layout includes all base panels plus the "daemon-log" panel

#### Scenario: User removes the board panel
- **WHEN** a user creates an overlay with `remove: ["board"]`
- **THEN** the resolved command center layout excludes the board browser panel

### Requirement: Command center state tracking
The engine SHALL persist a `CommandCenterState` record per window containing the window ID (resolved via `system.identify()`), workspace ID, and a mapping of panel roles to surface IDs. This state SHALL be used for idempotency checks and recovery.

#### Scenario: State persisted after activation
- **WHEN** the command center is successfully created
- **THEN** the engine persists `CommandCenterState` with the window ID, workspace ID, and surface IDs for all created panels

#### Scenario: Recovery after cmux restart
- **WHEN** the engine attempts an operation on a command center workspace and cmux returns an error for the stored workspace ID
- **THEN** the engine sets the workspace ID and all surface IDs to null, and the next `activate` rebuilds the command center from scratch

### Requirement: Workspace resolution
The engine SHALL resolve which workspace configuration to use for the command center by matching the current working directory against configured workspace paths. If no match is found, the engine SHALL use a default configuration with no board URL and no conductors.

#### Scenario: Workspace matched by path
- **WHEN** `codecorral activate` is run from `/home/user/projects/myapp` and a workspace is configured with `path: /home/user/projects/myapp`
- **THEN** the engine uses that workspace's `board` and `conductors` configuration for the command center layout

#### Scenario: No workspace match
- **WHEN** `codecorral activate` is run from a directory that does not match any configured workspace path
- **THEN** the engine creates a command center with a plain shell terminal and no browser panel
