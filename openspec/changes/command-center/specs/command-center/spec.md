## ADDED Requirements

### Requirement: Command center workspace lifecycle
The engine SHALL support a command center workspace per cmux window. The command center is a pinned workspace at sidebar position 0 that persists for the lifetime of the cmux window. The engine SHALL NOT close the command center during workflow transitions or cleanup.

#### Scenario: Command center created on activation
- **WHEN** `codecorral activate` is run inside cmux and no command center exists for the current window
- **THEN** the engine creates a new cmux workspace pinned at position 0 with the name "Command Center"

#### Scenario: Command center survives workflow lifecycle
- **WHEN** a workflow completes and its workspace is closed
- **THEN** the command center workspace remains open and unmodified

#### Scenario: Command center is not duplicated
- **WHEN** `codecorral activate` is run and a command center already exists for the current window
- **THEN** the engine returns the existing command center status without creating a new workspace

### Requirement: Cmux environment detection
The engine SHALL detect whether it is running inside cmux by checking for the `CMUX_WINDOW_ID` environment variable. The window ID SHALL be used to associate the command center with a specific cmux window.

#### Scenario: Running inside cmux
- **WHEN** `codecorral activate` is run and `CMUX_WINDOW_ID` is set
- **THEN** the engine proceeds with activation for the detected window

#### Scenario: Running outside cmux
- **WHEN** `codecorral activate` is run and `CMUX_WINDOW_ID` is not set
- **THEN** the engine prints a message directing the user to start cmux first, and exits with code 1

### Requirement: Declarative command center layout
The command center layout SHALL be declared as a structured configuration with a workspace section and an array of panel configurations. Each panel SHALL specify a role (unique identifier), type (`terminal` or `browser`), split position, and type-specific parameters (command for terminals, URL for browsers).

#### Scenario: Layout with conductor terminal and tracking board
- **WHEN** the command center is activated for a workspace with `board` URL and `conductor.name` configured
- **THEN** the command center creates two panels: a terminal panel running `agent-deck attach {conductor.name}` in the main position, and a browser panel showing the board URL split to the right

#### Scenario: Layout without board URL
- **WHEN** the command center is activated for a workspace where `board` is not configured
- **THEN** the command center creates only the conductor terminal panel (no browser panel)

#### Scenario: Layout without conductor
- **WHEN** the command center is activated for a workspace where `conductor.name` is not configured
- **THEN** the terminal panel opens a shell in the workspace path instead of attaching to a conductor

### Requirement: Command center state tracking
The engine SHALL persist a `CommandCenterState` record per window containing the window ID, workspace ID, and a mapping of panel roles to surface IDs. This state SHALL be used for idempotency checks and recovery.

#### Scenario: State persisted after activation
- **WHEN** the command center is successfully created
- **THEN** the engine persists `CommandCenterState` with the window ID, workspace ID, and surface IDs for all created panels

#### Scenario: Recovery after cmux restart
- **WHEN** the engine attempts an operation on a command center workspace and cmux returns an error for the stored workspace ID
- **THEN** the engine sets the workspace ID and all surface IDs to null, and the next `activate` rebuilds the command center from scratch

### Requirement: Workspace resolution
The engine SHALL resolve which workspace configuration to use for the command center by matching the current working directory against configured workspace paths. If no match is found, the engine SHALL use a default configuration with no board URL and no conductor.

#### Scenario: Workspace matched by path
- **WHEN** `codecorral activate` is run from `/home/user/projects/myapp` and a workspace is configured with `path: /home/user/projects/myapp`
- **THEN** the engine uses that workspace's `board` and `conductor` configuration for the command center

#### Scenario: No workspace match
- **WHEN** `codecorral activate` is run from a directory that does not match any configured workspace path
- **THEN** the engine creates a command center with a plain shell terminal and no browser panel
