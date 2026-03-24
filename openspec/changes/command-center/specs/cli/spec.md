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
- **THEN** the CLI detects `CMUX_WINDOW_ID`, connects to the daemon, and either creates the command center or reports that it already exists

#### Scenario: Activate outside cmux
- **WHEN** the user runs `codecorral activate` outside cmux (no `CMUX_WINDOW_ID`)
- **THEN** the CLI prints a message: "Not inside cmux (CMUX_WINDOW_ID not set). Start cmux first, then run 'codecorral activate' from any terminal pane." and exits with code 1

#### Scenario: Activate when already active
- **WHEN** the user runs `codecorral activate` and a command center already exists for the current window
- **THEN** the CLI prints the current command center status (workspace name, panel count, conductor status) and exits with code 0
