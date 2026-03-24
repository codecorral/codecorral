## MODIFIED Requirements

### Requirement: Daemon auto-start for mutating commands
Mutating CLI commands (`codecorral transition`, `codecorral activate`) SHALL auto-detect and connect to the engine daemon via `~/.codecorral/daemon.sock`. If no daemon is running, the CLI SHALL auto-start one in the background before executing the command.

#### Scenario: Daemon is running
- **WHEN** the user runs a mutating CLI command and `~/.codecorral/daemon.sock` exists and is responsive
- **THEN** the CLI connects to the daemon and executes the command

#### Scenario: Daemon is not running
- **WHEN** the user runs a mutating CLI command and no daemon socket exists
- **THEN** the CLI starts the daemon in the background, waits for the socket to become available, then executes the command

#### Scenario: Stale socket file
- **WHEN** the user runs a mutating CLI command and the socket file exists but connection is refused
- **THEN** the CLI removes the stale socket, starts a new daemon, and executes the command

## ADDED Requirements

### Requirement: codecorral activate command
The CLI SHALL provide `codecorral activate` to bootstrap a command center workspace in the current cmux window. The command SHALL detect the cmux environment, connect to the daemon, and create or verify the command center workspace.

#### Scenario: Activate inside cmux
- **WHEN** the user runs `codecorral activate` inside a cmux terminal
- **THEN** the CLI detects `CMUX_WORKSPACE_ID`, resolves the window ID via `system.identify()`, connects to the daemon, and either creates the command center or reports that it already exists

#### Scenario: Activate outside cmux
- **WHEN** the user runs `codecorral activate` outside cmux (no `CMUX_WORKSPACE_ID`)
- **THEN** the CLI prints a message: "Not inside cmux (CMUX_WORKSPACE_ID not set). Start cmux first, then run 'codecorral activate' from any terminal pane." and exits with code 1

#### Scenario: Activate when already active
- **WHEN** the user runs `codecorral activate` and a command center already exists for the current window
- **THEN** the CLI prints the current command center status (workspace name, panel count, conductor status) and exits with code 0

### Requirement: codecorral view fork command
The CLI SHALL provide `codecorral view fork <layout-name> [--full]` to scaffold a view overlay file into `.codecorral/views/`. By default, the command SHALL create an empty overlay with correct imports and comments showing available roles. With `--full`, it SHALL copy the complete base layout.

#### Scenario: Fork creates overlay scaffold
- **WHEN** the user runs `codecorral view fork command-center`
- **THEN** the CLI creates `.codecorral/views/command-center.ts` with an empty `defineOverlay` export and comments listing available panel roles

#### Scenario: Fork with --full copies base
- **WHEN** the user runs `codecorral view fork command-center --full`
- **THEN** the CLI creates `.codecorral/views/command-center.ts` with the complete base `defineLayout` content

#### Scenario: Fork for workflow machine
- **WHEN** the user runs `codecorral view fork unit-workflow`
- **THEN** the CLI creates `.codecorral/views/unit-workflow.ts` with empty overlays keyed by each state name that has a `meta.view`

#### Scenario: Fork target already exists
- **WHEN** the user runs `codecorral view fork command-center` and `.codecorral/views/command-center.ts` already exists
- **THEN** the CLI prints a warning and exits without overwriting
